"use client";

import dynamic from "next/dynamic";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import remarkGfm from "remark-gfm";
import type {
  AskDonePayload,
  AskRequest,
  AskScope,
  AskSource,
} from "../../lib/typematter/ask";
import type { UiCopy } from "../../lib/i18n/ui-copy";

const ReactMarkdown = dynamic(() => import("react-markdown"), {
  ssr: false,
});

const COPY_FEEDBACK_MS = 1200;
const ERROR_SUMMARY_MAX_LENGTH = 140;

type AskAiConfig = {
  enabled: boolean;
  endpoint?: string;
  timeoutMs: number;
  defaultScope: AskScope;
  followupLimit: number;
  examples: string[];
};

type AskContext = {
  language: string;
  currentRoute: string;
  currentSection: string;
  title: string;
};

type AskUiError = {
  summary: string;
  detail: string;
};

export type AskPanelProps = {
  askAi?: AskAiConfig;
  askContext?: AskContext;
  copy: UiCopy["search"];
  ariaCopy: UiCopy["aria"];
  active: boolean;
  sessionKey: number;
};

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

function toErrorSummary(message: string, fallback: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  if (normalized.length <= ERROR_SUMMARY_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, ERROR_SUMMARY_MAX_LENGTH - 3)}...`;
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

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export default function AskPanel({
  askAi,
  askContext,
  copy,
  ariaCopy,
  active,
  sessionKey,
}: AskPanelProps) {
  const [askQuestion, setAskQuestion] = useState("");
  const [lastAskedQuestion, setLastAskedQuestion] = useState("");
  const [askScope, setAskScope] = useState<AskScope>(askAi?.defaultScope ?? "page");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState("");
  const [askSources, setAskSources] = useState<AskSource[]>([]);
  const [askFollowups, setAskFollowups] = useState<string[]>([]);
  const [askError, setAskError] = useState<AskUiError | null>(null);
  const [askErrorExpanded, setAskErrorExpanded] = useState(false);
  const [askErrorCopied, setAskErrorCopied] = useState(false);
  const [copied, setCopied] = useState(false);

  const askInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const errorCopyTimerRef = useRef<number | null>(null);

  const askEnabled = Boolean(askAi?.enabled && askAi.endpoint && askContext);
  const followupLimit = askAi?.followupLimit ?? 3;
  const askEndpoint = askAi?.endpoint ? resolveAskEndpoint(askAi.endpoint) : "";
  const hasConversation =
    lastAskedQuestion.length > 0 || askLoading || askAnswer.length > 0 || Boolean(askError);

  const askExamples = useMemo(() => {
    if (askAi?.examples && askAi.examples.length > 0) {
      return askAi.examples.slice(0, 4);
    }
    if (askContext?.language.toLowerCase().startsWith("cn")) {
      return [
        "这个页面的核心结论是什么？",
        "给我一个最短可执行步骤。",
        "有哪些常见错误与排查方式？",
      ];
    }
    return [
      "What are the key takeaways from this page?",
      "Give me the shortest actionable steps.",
      "What common mistakes should I avoid?",
    ];
  }, [askAi?.examples, askContext?.language]);

  useEffect(() => {
    setAskQuestion("");
    setLastAskedQuestion("");
    setAskScope(askAi?.defaultScope ?? "page");
    setAskLoading(false);
    setAskAnswer("");
    setAskSources([]);
    setAskFollowups([]);
    setAskError(null);
    setAskErrorExpanded(false);
    setAskErrorCopied(false);
    setCopied(false);
    abortRef.current?.abort();
  }, [sessionKey, askAi?.defaultScope]);

  useEffect(() => {
    if (!active) {
      return;
    }
    askInputRef.current?.focus({ preventScroll: true });
  }, [active]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (errorCopyTimerRef.current) {
        window.clearTimeout(errorCopyTimerRef.current);
      }
    };
  }, []);

  function applyAskError(message: string, debugContext?: Record<string, unknown>) {
    const detailSections = [message || copy.askError];
    if (debugContext) {
      detailSections.push("", "Debug context:", JSON.stringify(debugContext, null, 2));
    }
    setAskError({
      summary: toErrorSummary(message || copy.askError, copy.askError),
      detail: detailSections.join("\n"),
    });
    setAskErrorExpanded(false);
    setAskErrorCopied(false);
    if (errorCopyTimerRef.current) {
      window.clearTimeout(errorCopyTimerRef.current);
      errorCopyTimerRef.current = null;
    }
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
    setLastAskedQuestion(question);
    setAskLoading(true);
    setAskError(null);
    setAskErrorExpanded(false);
    setAskErrorCopied(false);
    setAskAnswer("");
    setAskSources([]);
    setAskFollowups([]);

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
    const debugContext = {
      endpoint: askEndpoint,
      request: payload,
      timestamp: new Date().toISOString(),
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
        const responseMessage = errorText || copy.askError;
        throw new Error(
          `HTTP ${response.status} ${response.statusText}\n${responseMessage}`
        );
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
          onError: (message) => applyAskError(message || copy.askError, debugContext),
        });
      }

      if (buffered.trim().length > 0) {
        processSseChunk(buffered, {
          onSources: (sources) => setAskSources(normalizeSources(sources)),
          onDelta: (delta) => setAskAnswer((prev) => prev + delta),
          onDone: (donePayload) =>
            setAskFollowups((donePayload.followups ?? []).slice(0, followupLimit)),
          onError: (message) => applyAskError(message || copy.askError, debugContext),
        });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        applyAskError(copy.askTimeout, debugContext);
      } else {
        const message =
          error instanceof Error && error.message ? error.message : copy.askError;
        applyAskError(message, debugContext);
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

  async function handleCopyErrorDetail() {
    if (!askError?.detail) {
      return;
    }

    try {
      await navigator.clipboard.writeText(askError.detail);
      setAskErrorCopied(true);
      if (errorCopyTimerRef.current) {
        window.clearTimeout(errorCopyTimerRef.current);
      }
      errorCopyTimerRef.current = window.setTimeout(() => {
        setAskErrorCopied(false);
      }, COPY_FEEDBACK_MS);
    } catch {
      setAskErrorCopied(false);
    }
  }

  if (!askEnabled) {
    return null;
  }

  return (
    <div className={`ask-panel${active ? " is-active" : ""}`} aria-hidden={!active}>
      <div className="ask-thread">
        <div className="ask-message ask-message-assistant ask-intro-message">
          <span className="ask-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="icon">
              <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM13 4h5.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H13V4z" />
            </svg>
          </span>
          <div className="ask-message-body">
            <p className="ask-intro-line">{copy.assistantGreeting}</p>
            <p className="ask-intro-line">{copy.assistantIntro}</p>
            <p className="ask-intro-line ask-intro-prompt">{copy.assistantPrompt}</p>
          </div>
        </div>

        {lastAskedQuestion ? (
          <div className="ask-message ask-message-user">
            <span className="ask-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="icon">
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" />
              </svg>
            </span>
            <div className="ask-message-body">
              <p className="ask-user-text">{lastAskedQuestion}</p>
            </div>
          </div>
        ) : null}

        {hasConversation ? (
          <div className="ask-message ask-message-assistant ask-response-message">
            <span className="ask-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="icon">
                <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM13 4h5.5A1.5 1.5 0 0120 5.5v13a1.5 1.5 0 01-1.5 1.5H13V4z" />
              </svg>
            </span>
            <div className="ask-message-body">
              {askError ? (
                <div className="ask-error-panel">
                  <div className="ask-error">{askError.summary}</div>
                  <div className="ask-error-actions">
                    <button
                      type="button"
                      className="ask-error-action"
                      onClick={() => setAskErrorExpanded((prev) => !prev)}
                    >
                      {askErrorExpanded ? copy.hideErrorDetails : copy.showErrorDetails}
                    </button>
                    <button
                      type="button"
                      className={`ask-error-action${askErrorCopied ? " copied" : ""}`}
                      onClick={handleCopyErrorDetail}
                    >
                      {askErrorCopied ? copy.copiedErrorDetails : copy.copyErrorDetails}
                    </button>
                  </div>
                  {askErrorExpanded ? (
                    <pre className="ask-error-detail">{askError.detail}</pre>
                  ) : null}
                </div>
              ) : askAnswer ? (
                <div className="ask-answer-text">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, ...props }) => (
                        <a
                          {...props}
                          href={href}
                          target={href && isExternalHref(href) ? "_blank" : undefined}
                          rel={href && isExternalHref(href) ? "noreferrer" : undefined}
                        />
                      ),
                    }}
                  >
                    {askAnswer}
                  </ReactMarkdown>
                </div>
              ) : askLoading ? (
                <div className="ask-thinking">{copy.thinking}</div>
              ) : (
                <div className="ask-empty">{copy.noAnswerYet}</div>
              )}

              {askLoading ? <div className="ask-inline-status">{copy.retrievingSources}</div> : null}

              {askSources.length > 0 ? (
                <div className="ask-sources">
                  <div className="search-section-label">{copy.sourcesTitle}</div>
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
                </div>
              ) : null}

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
          </div>
        ) : (
          <div className="ask-chip-group ask-example-group">
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
        )}
      </div>

      <div className="ask-footer">
        {hasConversation ? (
          <div className="ask-chip-group ask-example-group">
            <div className="search-section-label">{copy.examplesTitle}</div>
            <div className="ask-chip-list">
              {askExamples.map((example) => (
                <button
                  type="button"
                  key={`footer-${example}`}
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
        ) : null}

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
              aria-label={ariaCopy.askInput}
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
      </div>
    </div>
  );
}
