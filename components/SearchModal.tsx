"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AskScope } from "../lib/typematter/ask";
import type {
  SearchBucketFile,
  SearchDocRecord,
  SearchManifest,
  SearchPosting,
} from "../lib/typematter/search";
import {
  compressSearchSnippet,
  expandQueryTokens,
  normalizeForSearch,
} from "../lib/typematter/search-utils";
import type { UiCopy } from "../lib/i18n/ui-copy";

const AskPanel = dynamic(() => import("./search/AskPanel"), {
  ssr: false,
});

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
  currentType?: string;
  currentVersion?: string | number;
  currentVersionGroup?: string;
};

type SearchModalProps = {
  standardSearch: {
    language: string;
    manifestPath?: string;
    allowedRoutes?: string[];
  };
  askAi?: AskAiConfig;
  askContext?: AskContext;
  uiCopy: UiCopy;
};

type ModalTab = "search" | "ask";

type RankedSearchResult = {
  title: string;
  href: string;
  section?: string;
  snippet?: string;
  score: number;
};

const DEFAULT_MANIFEST_PATH = "/typematter/search/manifest.json";
const DEFAULT_TOP_RESULTS = 10;

function isModifiedKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
}

function hashToken(token: string) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function bucketForToken(token: string, bucketCount: number) {
  return hashToken(token) % bucketCount;
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

function toPostingValue(posting: SearchPosting, key: "t" | "h" | "s" | "g" | "a" | "b") {
  return posting[key] ?? 0;
}

function resolveManifestLanguage(manifest: SearchManifest, language: string) {
  if (manifest.languages.includes(language)) {
    return language;
  }
  if (manifest.languages.length > 0) {
    return manifest.languages[0];
  }
  return language;
}

function scorePhraseContinuity(text: string, tokens: string[]) {
  if (tokens.length < 2 || !text) {
    return 0;
  }

  let bonus = 0;
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const withSpace = `${tokens[i]} ${tokens[i + 1]}`;
    const compact = `${tokens[i]}${tokens[i + 1]}`;
    if (text.includes(withSpace)) {
      bonus += 34;
      continue;
    }
    if (text.includes(compact)) {
      bonus += 26;
    }
  }
  return bonus;
}

function rankResults(
  docs: SearchDocRecord[],
  accumulators: Map<number, { matched: Set<string>; posting: SearchPosting }>,
  query: string,
  tokens: string[]
) {
  const normalizedQuery = normalizeForSearch(query);
  const docsById = new Map(docs.map((doc) => [doc.id, doc]));

  return Array.from(accumulators.entries())
    .map<RankedSearchResult | null>(([docId, accumulator]) => {
      const doc = docsById.get(docId);
      if (!doc) {
        return null;
      }

      const posting = accumulator.posting;
      const titleWeight = toPostingValue(posting, "t") * 160;
      const headingWeight = toPostingValue(posting, "h") * 70;
      const tagsWeight = toPostingValue(posting, "g") * 48;
      const sectionWeight = toPostingValue(posting, "s") * 36;
      const aliasWeight = toPostingValue(posting, "a") * 54;
      const bodyWeight = Math.min(12, toPostingValue(posting, "b")) * 8;

      let score =
        titleWeight + headingWeight + tagsWeight + sectionWeight + aliasWeight + bodyWeight;
      if (normalizedQuery && doc.titleNormalized === normalizedQuery) {
        score += 1200;
      } else if (normalizedQuery && doc.titleNormalized.startsWith(normalizedQuery)) {
        score += 760;
      }

      const titleTokenCoverage =
        tokens.length === 0
          ? 0
          : tokens.filter((token) => doc.titleNormalized.includes(token)).length /
            tokens.length;
      score += titleTokenCoverage * 380;

      if (normalizedQuery && doc.headingNormalized.includes(normalizedQuery)) {
        score += 260;
      }

      if (normalizedQuery && doc.aliasesNormalized.includes(normalizedQuery)) {
        score += 320;
      }

      if (normalizedQuery && doc.searchNormalized.includes(normalizedQuery)) {
        score += 200;
      }

      const matchedCoverage =
        tokens.length === 0 ? 0 : accumulator.matched.size / tokens.length;
      score += matchedCoverage * 260;
      score += scorePhraseContinuity(doc.searchNormalized, tokens);

      return {
        title: doc.title,
        href: doc.href,
        section: doc.section,
        snippet: doc.snippet,
        score,
      } satisfies RankedSearchResult;
    })
    .filter((item): item is RankedSearchResult => item !== null)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.title !== b.title) {
        return a.title.localeCompare(b.title);
      }
      return a.href.localeCompare(b.href);
    });
}

export default function SearchModal({
  standardSearch,
  askAi,
  askContext,
  uiCopy,
}: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<ModalTab>("search");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);
  const [askMounted, setAskMounted] = useState(false);
  const [manifest, setManifest] = useState<SearchManifest | null>(null);
  const [manifestLanguage, setManifestLanguage] = useState<string>("");
  const [docs, setDocs] = useState<SearchDocRecord[]>([]);
  const [baseLoading, setBaseLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<RankedSearchResult[]>([]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const askEnabled = Boolean(askAi?.enabled && askAi.endpoint && askContext);
  const allowedRoutes = standardSearch.allowedRoutes ?? [];
  const allowedRoutesSet = useMemo(() => new Set(allowedRoutes), [allowedRoutes]);
  const manifestPath = standardSearch.manifestPath ?? DEFAULT_MANIFEST_PATH;
  const requestedLanguage = standardSearch.language;

  const manifestCacheRef = useRef(new Map<string, SearchManifest>());
  const docsCacheRef = useRef(new Map<string, SearchDocRecord[]>());
  const shardCacheRef = useRef(
    new Map<string, SearchBucketFile | Promise<SearchBucketFile>>()
  );

  const filteredDocs = useMemo(() => {
    if (allowedRoutesSet.size === 0) {
      return docs;
    }
    return docs.filter((doc) => allowedRoutesSet.has(doc.href));
  }, [docs, allowedRoutesSet]);

  useEffect(() => {
    setManifest(null);
    setManifestLanguage("");
    setDocs([]);
    setResults([]);
    setSearchError(null);
    setBaseLoading(false);
    setSearchLoading(false);
    shardCacheRef.current.clear();
  }, [manifestPath, requestedLanguage]);

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
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [open]);

  useEffect(() => {
    const openFromEvent = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest("[data-search-trigger]")) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    };

    document.addEventListener("click", openFromEvent);
    document.addEventListener("focusin", openFromEvent);

    return () => {
      document.removeEventListener("click", openFromEvent);
      document.removeEventListener("focusin", openFromEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setAskMounted(false);
      return;
    }

    setTab("search");
    setQuery("");
    setActiveIndex(0);
    setSessionKey((prev) => prev + 1);
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
  }, [open]);

  useEffect(() => {
    if (open && askEnabled && tab === "ask") {
      setAskMounted(true);
    }
  }, [open, askEnabled, tab]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (tab === "ask" && askEnabled) {
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
      setOpen(false);
    }
  }, [pathname, searchParams?.toString()]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;

    const loadBase = async () => {
      setBaseLoading(true);
      setSearchError(null);

      try {
        let manifestData = manifestCacheRef.current.get(manifestPath);
        if (!manifestData) {
          const response = await fetch(manifestPath, { cache: "force-cache" });
          if (!response.ok) {
            throw new Error(`manifest request failed: ${response.status}`);
          }
          manifestData = (await response.json()) as SearchManifest;
          manifestCacheRef.current.set(manifestPath, manifestData);
        }

        const resolvedLanguage = resolveManifestLanguage(
          manifestData,
          requestedLanguage
        );
        const docsPath = manifestData.docs[resolvedLanguage];
        if (!docsPath) {
          throw new Error(`missing docs path for language ${resolvedLanguage}`);
        }

        const docsKey = `${manifestData.contentHash}:${resolvedLanguage}`;
        let docsData = docsCacheRef.current.get(docsKey);
        if (!docsData) {
          const response = await fetch(docsPath, { cache: "force-cache" });
          if (!response.ok) {
            throw new Error(`docs request failed: ${response.status}`);
          }
          docsData = (await response.json()) as SearchDocRecord[];
          docsCacheRef.current.set(docsKey, docsData);
        }

        if (!cancelled) {
          setManifest(manifestData);
          setManifestLanguage(resolvedLanguage);
          setDocs(docsData);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchError(uiCopy.search.searchUnavailable);
          setManifest(null);
          setManifestLanguage("");
          setDocs([]);
        }
      } finally {
        if (!cancelled) {
          setBaseLoading(false);
        }
      }
    };

    void loadBase();
    return () => {
      cancelled = true;
    };
  }, [open, manifestPath, requestedLanguage, uiCopy.search.searchUnavailable]);

  useEffect(() => {
    if (!open || tab !== "search") {
      return;
    }

    const trimmed = query.trim();
    if (!manifest || filteredDocs.length === 0) {
      setResults([]);
      return;
    }

    if (!trimmed) {
      const seed = filteredDocs
        .slice()
        .sort((a, b) => a.title.localeCompare(b.title))
        .slice(0, DEFAULT_TOP_RESULTS)
        .map((doc) => ({
          title: doc.title,
          href: doc.href,
          section: doc.section,
          snippet: doc.snippet,
          score: 0,
        }));
      setResults(seed);
      setSearchLoading(false);
      return;
    }

    const tokens = Array.from(new Set(expandQueryTokens(trimmed)));
    if (tokens.length === 0) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;

    const loadShard = async (bucket: number) => {
      const shardBase = manifest.shards[manifestLanguage];
      if (!shardBase) {
        throw new Error(`missing shard base for language ${manifestLanguage}`);
      }
      const cacheKey = `${manifest.contentHash}:${manifestLanguage}:${bucket}`;
      const cached = shardCacheRef.current.get(cacheKey);
      if (cached) {
        if (cached instanceof Promise) {
          return cached;
        }
        return cached;
      }

      const request = fetch(`${shardBase.replace(/\/$/, "")}/${bucket}.json`, {
        cache: "force-cache",
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`shard request failed: ${response.status}`);
        }
        return (await response.json()) as SearchBucketFile;
      });
      shardCacheRef.current.set(cacheKey, request);
      try {
        const resolved = await request;
        shardCacheRef.current.set(cacheKey, resolved);
        return resolved;
      } catch (error) {
        shardCacheRef.current.delete(cacheKey);
        throw error;
      }
    };

    const runSearch = async () => {
      setSearchLoading(true);
      setSearchError(null);

      try {
        const bucketIds = Array.from(
          new Set(tokens.map((token) => bucketForToken(token, manifest.buckets)))
        );
        const shardEntries = await Promise.all(
          bucketIds.map(async (bucket) => [bucket, await loadShard(bucket)] as const)
        );
        const shardByBucket = new Map<number, SearchBucketFile>(shardEntries);
        const accumulators = new Map<number, { matched: Set<string>; posting: SearchPosting }>();

        tokens.forEach((token) => {
          const bucket = bucketForToken(token, manifest.buckets);
          const shard = shardByBucket.get(bucket);
          const postings = shard?.tokens[token] ?? [];

          postings.forEach((posting) => {
            const accumulator = accumulators.get(posting.id) ?? {
              matched: new Set<string>(),
              posting: { id: posting.id },
            };
            accumulator.matched.add(token);
            accumulator.posting.t =
              (accumulator.posting.t ?? 0) + (posting.t ?? 0);
            accumulator.posting.h =
              (accumulator.posting.h ?? 0) + (posting.h ?? 0);
            accumulator.posting.s =
              (accumulator.posting.s ?? 0) + (posting.s ?? 0);
            accumulator.posting.g =
              (accumulator.posting.g ?? 0) + (posting.g ?? 0);
            accumulator.posting.a =
              (accumulator.posting.a ?? 0) + (posting.a ?? 0);
            accumulator.posting.b =
              (accumulator.posting.b ?? 0) + (posting.b ?? 0);
            accumulators.set(posting.id, accumulator);
          });
        });

        const ranked = rankResults(filteredDocs, accumulators, trimmed, tokens);
        const topResults = ranked.slice(0, 30);

        if (!cancelled) {
          setResults(topResults);
          setActiveIndex(0);
        }
      } catch (error) {
        if (!cancelled) {
          setResults([]);
          setSearchError(uiCopy.search.searchUnavailable);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    };

    void runSearch();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    tab,
    query,
    manifest,
    manifestLanguage,
    filteredDocs,
    uiCopy.search.searchUnavailable,
  ]);

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
        aria-label={uiCopy.aria.closeSearch}
        onClick={() => {
          setOpen(false);
        }}
      />
      <div className={`search-panel${askEnabled && tab === "ask" ? " is-ask-expanded" : ""}`}>
        {askEnabled ? (
          <div className="search-tabs-row">
            <div
              className="search-tabs"
              role="tablist"
              aria-label={uiCopy.aria.searchModes}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "search"}
                className={`search-tab${tab === "search" ? " active" : ""}`}
                onClick={() => setTab("search")}
              >
                {uiCopy.search.searchTab}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ask"}
                className={`search-tab${tab === "ask" ? " active" : ""}`}
                onClick={() => setTab("ask")}
              >
                {uiCopy.search.askTab}
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
                placeholder={uiCopy.search.searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                aria-label={uiCopy.aria.searchInput}
              />
              {!askEnabled ? <span className="key-hint">ESC</span> : null}
            </div>

            <div className="search-results">
              <div className="search-section-label">{uiCopy.search.searchSection}</div>
              {baseLoading ? (
                <div className="search-empty">{uiCopy.search.loadingSearchIndex}</div>
              ) : searchLoading ? (
                <div className="search-empty">{uiCopy.search.loadingSearchResults}</div>
              ) : searchError ? (
                <div className="search-empty">{searchError}</div>
              ) : results.length === 0 ? (
                <div className="search-empty">{uiCopy.search.noSearchResults}</div>
              ) : (
                results.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.href}-${item.title}-${index}`}
                    className={`search-item${index === activeIndex ? " active" : ""}`}
                    onClick={() => {
                      setOpen(false);
                      router.push(item.href);
                    }}
                  >
                    <span className="search-item-main">
                      <span className="search-item-title">
                        {highlightText(item.title, query)}
                      </span>
                      {item.snippet ? (
                        <span className="search-item-snippet">
                          {highlightText(
                            compressSearchSnippet(item.snippet, query, 140),
                            query
                          )}
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
        ) : null}

        {askEnabled && askMounted ? (
          <AskPanel
            askAi={askAi}
            askContext={askContext}
            copy={uiCopy.search}
            ariaCopy={uiCopy.aria}
            active={tab === "ask"}
            sessionKey={sessionKey}
          />
        ) : null}
      </div>
    </div>
  );
}
