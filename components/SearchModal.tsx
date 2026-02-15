"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  AskDonePayload,
  AskRequest,
  AskScope,
  AskSource,
} from "../lib/typematter/ask";

export type SearchItem = {
  title: string;
  href: string;
  section?: string;
  content?: string;
};

type AskAiConfig = {
  enabled: boolean;
  endpoint?: string;
  timeoutMs: number;
  defaultScope: AskScope;
  recentLimit: number;
  followupLimit: number;
  examples: string[];
};

type AskContext = {
  language: string;
  currentRoute: string;
  currentSection: string;
  title: string;
};

type SearchModalProps = {
  items: SearchItem[];
  askAi?: AskAiConfig;
  askContext?: AskContext;
};

type ModalTab = "search" | "ask";

type UiCopy = {
  searchPlaceholder: string;
  askPlaceholder: string;
  noSearchResults: string;
  noAnswerYet: string;
  sourcesTitle: string;
  examplesTitle: string;
  recentTitle: string;
  followupsTitle: string;
  retrievingSources: string;
  askButton: string;
  askTab: string;
  searchTab: string;
  searchSection: string;
  pageScope: string;
  sectionScope: string;
  siteScope: string;
  copyAnswer: string;
  copiedAnswer: string;
  askError: string;
  askTimeout: string;
};

const RECENT_KEY_PREFIX = "typematter-ask-recent";
const COPY_FEEDBACK_MS = 1200;

const EN_COPY: UiCopy = {
  searchPlaceholder: "Search documentation...",
  askPlaceholder: "Ask about this documentation...",
  noSearchResults: "No results",
  noAnswerYet: "Ask a question to get a cited answer.",
  sourcesTitle: "Sources",
  examplesTitle: "Example questions",
  recentTitle: "Recent questions",
  followupsTitle: "Suggested follow-ups",
  retrievingSources: "Retrieving sources...",
  askButton: "Ask",
  askTab: "Ask AI",
  searchTab: "Search",
  searchSection: "Documentation",
  pageScope: "Current page",
  sectionScope: "Current section",
  siteScope: "Entire site",
  copyAnswer: "Copy answer with citations",
  copiedAnswer: "Copied",
  askError: "Ask AI failed. Please try again.",
  askTimeout: "Ask AI request timed out.",
};

const CN_COPY: UiCopy = {
  searchPlaceholder: "搜索文档...",
  askPlaceholder: "基于文档提问...",
  noSearchResults: "没有结果",
  noAnswerYet: "输入问题后可获得带引用的答案。",
  sourcesTitle: "来源",
  examplesTitle: "示例问题",
  recentTitle: "最近问题",
  followupsTitle: "推荐追问",
  retrievingSources: "正在检索来源...",
  askButton: "提问",
  askTab: "Ask AI",
  searchTab: "Search",
  searchSection: "文档",
  pageScope: "当前页",
  sectionScope: "当前分组",
  siteScope: "全站",
  copyAnswer: "复制回答（含引用）",
  copiedAnswer: "已复制",
  askError: "Ask AI 调用失败，请稍后重试。",
  askTimeout: "Ask AI 请求超时。",
};

function isModifiedKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}

function buildSnippet(content: string | undefined, query: string) {
  if (!content) {
    return "";
  }
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  const q = query.trim().toLowerCase();
  if (!q) {
    return clean.slice(0, 120) + (clean.length > 120 ? "..." : "");
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const lower = clean.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    const found = lower.indexOf(token);
    if (found !== -1) {
      index = found;
      break;
    }
  }
  if (index === -1) {
    return clean.slice(0, 120) + (clean.length > 120 ? "..." : "");
  }
  const start = Math.max(0, index - 40);
  const end = Math.min(clean.length, index + 80);
  let snippet = clean.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < clean.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(pattern);
  const tokenSet = new Set(tokens);

  return parts.map((part, index) =>
    tokenSet.has(part.toLowerCase()) ? (
      <mark className="search-highlight" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function toBooleanLanguageCN(language: string | undefined) {
  if (!language) {
    return false;
  }
  const normalized = language.toLowerCase();
  return normalized.startsWith("cn") || normalized.startsWith("zh");
}

function resolveAskEndpoint(endpoint: string) {
  const normalized = endpoint.trim().replace(/\/+$/, "");
  if (!normalized) {
    return "";
  }
  return normalized.endsWith("/v1/ask") ? normalized : `${normalized}/v1/ask`;
}

function safeParseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function processSseChunk(
  rawChunk: string,
  handlers: {
    onSources: (sources: AskSource[]) => void;
    onDelta: (delta: string) => void;
    onDone: (payload: AskDonePayload) => void;
    onError: (message: string) => void;
  }
) {
  const blocks = rawChunk.split(/\n\n+/).filter((block) => block.trim().length > 0);
  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    let eventName = "message";
    const payloadLines: string[] = [];
    lines.forEach((line) => {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
        return;
      }
      if (line.startsWith("data:")) {
        payloadLines.push(line.slice("data:".length).trimStart());
      }
    });
    const payloadText = payloadLines.join("\n").trim();
    if (!payloadText) {
      return;
    }

    if (eventName === "sources") {
      const parsed = safeParseJson<AskSource[]>(payloadText);
      if (Array.isArray(parsed)) {
        handlers.onSources(parsed);
      }
      return;
    }

    if (eventName === "delta") {
      const parsed = safeParseJson<{ delta?: string; text?: string }>(payloadText);
      const delta = parsed?.delta ?? parsed?.text ?? payloadText;
      if (delta) {
        handlers.onDelta(delta);
      }
      return;
    }

    if (eventName === "done") {
      const parsed = safeParseJson<AskDonePayload>(payloadText);
      handlers.onDone(parsed ?? {});
      return;
    }

    if (eventName === "error") {
      const parsed = safeParseJson<{ message?: string }>(payloadText);
      handlers.onError(parsed?.message ?? payloadText);
    }
  });
}

function buildSourceHref(source: AskSource) {
  const anchor = source.anchor?.trim() || "top";
  if (source.href.includes("#")) {
    return source.href;
  }
  return `${source.href}#${anchor}`;
}

function normalizeSources(sources: AskSource[]) {
  return sources
    .filter((source) => source && source.href && source.title)
    .map((source, index) => ({
      id: source.id || `source-${index + 1}`,
      title: source.title,
      href: source.href,
      anchor: source.anchor || "top",
      snippet: source.snippet || "",
      score: source.score,
    }));
}

export default function SearchModal({ items, askAi, askContext }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<ModalTab>("search");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [askQuestion, setAskQuestion] = useState("");
  const [askScope, setAskScope] = useState<AskScope>(askAi?.defaultScope ?? "page");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askSources, setAskSources] = useState<AskSource[]>([]);
  const [askFollowups, setAskFollowups] = useState<string[]>([]);
  const [askError, setAskError] = useState("");
  const [copied, setCopied] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const askInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const askEnabled = Boolean(askAi?.enabled && askAi.endpoint && askContext);
  const copy = toBooleanLanguageCN(askContext?.language) ? CN_COPY : EN_COPY;
  const recentLimit = askAi?.recentLimit ?? 6;
  const followupLimit = askAi?.followupLimit ?? 3;
  const askEndpoint = askAi?.endpoint ? resolveAskEndpoint(askAi.endpoint) : "";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.slice(0, 8);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    return items.filter((item) => {
      const title = item.title.toLowerCase();
      const section = item.section?.toLowerCase() ?? "";
      const content = item.content?.toLowerCase() ?? "";
      return tokens.every(
        (token) =>
          title.includes(token) ||
          section.includes(token) ||
          content.includes(token)
      );
    });
  }, [items, query]);

  const askExamples = useMemo(() => {
    if (askAi?.examples && askAi.examples.length > 0) {
      return askAi.examples.slice(0, 4);
    }
    return toBooleanLanguageCN(askContext?.language)
      ? [
          "这个页面的核心结论是什么？",
          "给我一个最短可执行步骤。",
          "有哪些常见错误与排查方式？",
        ]
      : [
          "What are the key takeaways from this page?",
          "Give me the shortest actionable steps.",
          "What common mistakes should I avoid?",
        ];
  }, [askAi?.examples, askContext?.language]);

  useEffect(() => {
    if (!askEnabled || !askContext?.language) {
      setRecentQuestions([]);
      return;
    }
    try {
      const storageKey = `${RECENT_KEY_PREFIX}:${askContext.language}`;
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        setRecentQuestions([]);
        return;
      }
      const parsed = safeParseJson<string[]>(stored);
      setRecentQuestions(Array.isArray(parsed) ? parsed.slice(0, recentLimit) : []);
    } catch {
      setRecentQuestions([]);
    }
  }, [askEnabled, askContext?.language, recentLimit]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        return;
      }

      if (!open) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        abortRef.current?.abort();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  useEffect(() => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-search-trigger]")
    );
    const openModal = (event: Event) => {
      event.preventDefault();
      setOpen(true);
    };

    triggers.forEach((element) => {
      element.addEventListener("click", openModal);
      element.addEventListener("focus", openModal);
    });

    return () => {
      triggers.forEach((element) => {
        element.removeEventListener("click", openModal);
        element.removeEventListener("focus", openModal);
      });
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      abortRef.current?.abort();
      return;
    }

    setTab("search");
    setQuery("");
    setActiveIndex(0);
    setAskQuestion("");
    setAskScope(askAi?.defaultScope ?? "page");
    setAskLoading(false);
    setAskAnswer("");
    setAskSources([]);
    setAskFollowups([]);
    setAskError("");
    setCopied(false);
    document.body.classList.add("search-open");
    const focusInput = () => {
      searchInputRef.current?.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => {
      setVisible(true);
      focusInput();
    });
    const focusTimer = window.setTimeout(focusInput, 50);

    return () => {
      document.body.classList.remove("search-open");
      window.clearTimeout(focusTimer);
    };
  }, [open, askAi?.defaultScope]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (tab === "ask" && askEnabled) {
      askInputRef.current?.focus({ preventScroll: true });
      return;
    }

    searchInputRef.current?.focus({ preventScroll: true });
  }, [tab, open, askEnabled]);

  useEffect(() => {
    if (!open || tab !== "search") {
      return;
    }
    if (activeIndex >= results.length) {
      setActiveIndex(0);
    }
  }, [results.length, open, tab, activeIndex]);

  useEffect(() => {
    if (!open || tab !== "search") {
      return;
    }

    const handleNavigate = (event: KeyboardEvent) => {
      if (isModifiedKey(event)) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) =>
          results.length === 0 ? 0 : (prev + 1) % results.length
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) =>
          results.length === 0
            ? 0
            : (prev - 1 + results.length) % results.length
        );
      }

      if (event.key === "Enter") {
        if (results.length === 0) {
          return;
        }
        event.preventDefault();
        const target = results[activeIndex];
        if (target) {
          abortRef.current?.abort();
          setOpen(false);
          router.push(target.href);
        }
      }
    };

    document.addEventListener("keydown", handleNavigate);
    return () => {
      document.removeEventListener("keydown", handleNavigate);
    };
  }, [open, tab, results, activeIndex, router]);

  useEffect(() => {
    if (open) {
      abortRef.current?.abort();
      setOpen(false);
    }
  }, [pathname, searchParams?.toString(), open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function persistRecentQuestion(question: string) {
    if (!askEnabled || !askContext?.language) {
      return;
    }
    const cleaned = question.trim();
    if (!cleaned) {
      return;
    }

    setRecentQuestions((prev) => {
      const deduped = [cleaned, ...prev.filter((item) => item !== cleaned)].slice(
        0,
        recentLimit
      );
      try {
        const storageKey = `${RECENT_KEY_PREFIX}:${askContext.language}`;
        localStorage.setItem(storageKey, JSON.stringify(deduped));
      } catch {
        // ignore storage write errors
      }
      return deduped;
    });
  }

  async function submitAsk(nextQuestion?: string) {
    if (!askEnabled || !askContext || !askEndpoint || askLoading) {
      return;
    }

    const question = (nextQuestion ?? askQuestion).trim();
    if (!question) {
      return;
    }

    setAskQuestion(question);
    setAskLoading(true);
    setAskError("");
    setAskAnswer("");
    setAskSources([]);
    setAskFollowups([]);
    persistRecentQuestion(question);

    const payload: AskRequest = {
      question,
      language: askContext.language,
      scope: askScope,
      currentRoute: askContext.currentRoute,
      currentSection: askContext.currentSection,
      siteContext: {
        title: askContext.title,
      },
    };

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), askAi?.timeoutMs ?? 25_000);

    try {
      const response = await fetch(askEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `${copy.askError} (${response.status})`);
      }

      if (!response.body) {
        throw new Error(copy.askError);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (!value) {
          continue;
        }
        buffered += decoder.decode(value, { stream: true });
        const boundary = buffered.lastIndexOf("\n\n");
        if (boundary === -1) {
          continue;
        }
        const chunk = buffered.slice(0, boundary);
        buffered = buffered.slice(boundary + 2);
        processSseChunk(chunk, {
          onSources: (sources) => setAskSources(normalizeSources(sources)),
          onDelta: (delta) => setAskAnswer((prev) => prev + delta),
          onDone: (donePayload) =>
            setAskFollowups((donePayload.followups ?? []).slice(0, followupLimit)),
          onError: (message) => setAskError(message || copy.askError),
        });
      }

      if (buffered.trim().length > 0) {
        processSseChunk(buffered, {
          onSources: (sources) => setAskSources(normalizeSources(sources)),
          onDelta: (delta) => setAskAnswer((prev) => prev + delta),
          onDone: (donePayload) =>
            setAskFollowups((donePayload.followups ?? []).slice(0, followupLimit)),
          onError: (message) => setAskError(message || copy.askError),
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        setAskError(copy.askTimeout);
      } else {
        const message =
          error instanceof Error && error.message ? error.message : copy.askError;
        setAskError(message);
      }
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setAskLoading(false);
    }
  }

  function handleAskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAsk();
  }

  async function handleCopyAnswer() {
    if (!askAnswer.trim()) {
      return;
    }
    const composed = [
      askAnswer.trim(),
      "",
      copy.sourcesTitle,
      ...askSources.map(
        (source, index) => `[S${index + 1}] ${source.title} - ${buildSourceHref(source)}`
      ),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(composed);
      setCopied(true);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, COPY_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className={`search-modal${visible ? " is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="search-backdrop"
        aria-label="Close search"
        onClick={() => {
          abortRef.current?.abort();
          setOpen(false);
        }}
      />
      <div className="search-panel">
        {askEnabled ? (
          <div className="search-tabs-row">
            <div className="search-tabs" role="tablist" aria-label="Search modes">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "search"}
                className={`search-tab${tab === "search" ? " active" : ""}`}
                onClick={() => setTab("search")}
              >
                {copy.searchTab}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ask"}
                className={`search-tab${tab === "ask" ? " active" : ""}`}
                onClick={() => setTab("ask")}
              >
                {copy.askTab}
              </button>
            </div>
            <span className="key-hint">ESC</span>
          </div>
        ) : null}

        {tab === "search" || !askEnabled ? (
          <>
            <div className="search-input-row">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <path d="M11 4a7 7 0 105.292 12.292l3.707 3.707 1.414-1.414-3.707-3.707A7 7 0 0011 4z" />
              </svg>
              <input
                ref={searchInputRef}
                className="search-input"
                placeholder={copy.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
              />
              {!askEnabled ? <span className="key-hint">ESC</span> : null}
            </div>

            <div className="search-results">
              <div className="search-section-label">{copy.searchSection}</div>
              {results.length === 0 ? (
                <div className="search-empty">{copy.noSearchResults}</div>
              ) : (
                results.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.href}-${item.title}`}
                    className={`search-item${index === activeIndex ? " active" : ""}`}
                    onClick={() => {
                      abortRef.current?.abort();
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <span className="search-item-main">
                      <span className="search-item-title">
                        {highlightText(item.title, query)}
                      </span>
                      {item.content ? (
                        <span className="search-item-snippet">
                          {highlightText(buildSnippet(item.content, query), query)}
                        </span>
                      ) : null}
                    </span>
                    {item.section ? (
                      <span className="search-item-meta">{item.section}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="ask-panel">
            <form className="ask-form" onSubmit={handleAskSubmit}>
              <div className="search-input-row ask-input-row">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                  <path d="M21 12a9 9 0 11-4.2-7.56M8 11h8M8 15h5" />
                </svg>
                <input
                  ref={askInputRef}
                  className="search-input"
                  placeholder={copy.askPlaceholder}
                  value={askQuestion}
                  onChange={(event) => setAskQuestion(event.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="ask-submit"
                  disabled={askLoading || askQuestion.trim().length === 0}
                >
                  {copy.askButton}
                </button>
              </div>

              <div className="ask-scope-row">
                <button
                  type="button"
                  className={`ask-scope${askScope === "page" ? " active" : ""}`}
                  onClick={() => setAskScope("page")}
                >
                  {copy.pageScope}
                </button>
                <button
                  type="button"
                  className={`ask-scope${askScope === "section" ? " active" : ""}`}
                  onClick={() => setAskScope("section")}
                >
                  {copy.sectionScope}
                </button>
                <button
                  type="button"
                  className={`ask-scope${askScope === "site" ? " active" : ""}`}
                  onClick={() => setAskScope("site")}
                >
                  {copy.siteScope}
                </button>
              </div>
            </form>

            <div className="ask-chip-group">
              <div className="search-section-label">{copy.examplesTitle}</div>
              <div className="ask-chip-list">
                {askExamples.map((example) => (
                  <button
                    type="button"
                    key={example}
                    className="ask-chip"
                    onClick={() => {
                      setAskQuestion(example);
                      void submitAsk(example);
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {recentQuestions.length > 0 ? (
              <div className="ask-chip-group">
                <div className="search-section-label">{copy.recentTitle}</div>
                <div className="ask-chip-list">
                  {recentQuestions.map((recent) => (
                    <button
                      type="button"
                      key={recent}
                      className="ask-chip"
                      onClick={() => {
                        setAskQuestion(recent);
                        void submitAsk(recent);
                      }}
                    >
                      {recent}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="ask-sources">
              <div className="search-section-label">{copy.sourcesTitle}</div>
              {askSources.length > 0 ? (
                <div className="ask-source-list">
                  {askSources.map((source, index) => (
                    <a
                      key={`${source.id}-${index}`}
                      className="ask-source-card"
                      href={buildSourceHref(source)}
                    >
                      <span className="ask-source-title">
                        [S{index + 1}] {source.title}
                      </span>
                      <span className="ask-source-snippet">{source.snippet}</span>
                    </a>
                  ))}
                </div>
              ) : askLoading ? (
                <div className="ask-inline-status">{copy.retrievingSources}</div>
              ) : null}
            </div>

            <div className="ask-answer">
              {askError ? (
                <div className="ask-error">{askError}</div>
              ) : askAnswer ? (
                <div className="ask-answer-text">{askAnswer}</div>
              ) : (
                <div className="ask-empty">{copy.noAnswerYet}</div>
              )}
            </div>

            {askFollowups.length > 0 ? (
              <div className="ask-chip-group">
                <div className="search-section-label">{copy.followupsTitle}</div>
                <div className="ask-chip-list">
                  {askFollowups.map((followup) => (
                    <button
                      type="button"
                      key={followup}
                      className="ask-chip"
                      onClick={() => {
                        setAskQuestion(followup);
                        void submitAsk(followup);
                      }}
                    >
                      {followup}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {askAnswer ? (
              <button
                type="button"
                className={`ask-copy${copied ? " copied" : ""}`}
                onClick={handleCopyAnswer}
              >
                {copied ? copy.copiedAnswer : copy.copyAnswer}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
