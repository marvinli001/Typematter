"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SearchItem = {
  title: string;
  href: string;
  section?: string;
  content?: string;
};

type SearchModalProps = {
  items: SearchItem[];
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

export default function SearchModal({ items }: SearchModalProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
      return;
    }

    setQuery("");
    setActiveIndex(0);
    document.body.classList.add("search-open");
    const focusInput = () => {
      inputRef.current?.focus({ preventScroll: true });
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
    if (!open) {
      return;
    }
    if (activeIndex >= results.length) {
      setActiveIndex(0);
    }
  }, [results.length, open, activeIndex]);

  useEffect(() => {
    if (!open) {
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
  }, [open, results, activeIndex, router]);

  useEffect(() => {
    if (open) {
      setOpen(false);
    }
  }, [pathname, searchParams?.toString()]);

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
        onClick={() => setOpen(false)}
      />
      <div className="search-panel">
        <div className="search-input-row">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
            <path d="M11 4a7 7 0 105.292 12.292l3.707 3.707 1.414-1.414-3.707-3.707A7 7 0 0011 4z" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search documentation..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <span className="key-hint">ESC</span>
        </div>

        <div className="search-results">
          <div className="search-section-label">Documentation</div>
          {results.length === 0 ? (
            <div className="search-empty">No results</div>
          ) : (
            results.map((item, index) => (
              <button
                type="button"
                key={`${item.href}-${item.title}`}
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
      </div>
    </div>
  );
}



