import Link from "next/link";
import type { ReactNode } from "react";
import type { NavGroup } from "../../lib/nav";
import type { TocItem } from "../../lib/docs";
import siteConfig from "../../site.config";
import RouteTransition from "../RouteTransition";
import SearchModal from "../SearchModal";
import CopyPageButton from "./CopyPageButton";
import Toc from "./Toc";

const STATUS_LABELS: Record<string, string> = {
  experimental: "Experimental",
  stable: "Stable",
  beta: "Beta",
  draft: "Draft",
};

type DocsShellProps = {
  navGroups: NavGroup[];
  toc: TocItem[];
  title: string;
  section: string;
  status?: string;
  version?: string | number;
  tags?: string[];
  searchItems: Array<{
    title: string;
    href: string;
    section?: string;
    content?: string;
  }>;
  markdown?: string;
  currentRoute: string;
  docPath: string;
  languages?: Array<{
    code: string;
    label: string;
    href: string;
    active: boolean;
  }>;
  pager?: {
    prev?: { title: string; href: string };
    next?: { title: string; href: string };
  };
  askAi?: {
    enabled: boolean;
    endpoint?: string;
    timeoutMs: number;
    defaultScope: "page" | "section" | "site";
    recentLimit: number;
    followupLimit: number;
    examples: string[];
  };
  askContext?: {
    language: string;
    currentRoute: string;
    currentSection: string;
    title: string;
  };
  children: ReactNode;
};

export default function DocsShell({
  navGroups,
  toc,
  title,
  section,
  status,
  version,
  tags,
  searchItems,
  markdown,
  currentRoute,
  docPath,
  languages,
  pager,
  askAi,
  askContext,
  children,
}: DocsShellProps) {
  const resolvedStatus = status ? STATUS_LABELS[status] ?? status : undefined;
  const metaTags = [
    ...(resolvedStatus ? [resolvedStatus] : []),
    ...(version !== undefined ? [`v${version}`] : []),
    ...(tags ?? []),
  ];
  const showNavMeta = Boolean(resolvedStatus || version !== undefined);
  const repo = siteConfig.repo;
  const repoUrl = repo?.url?.replace(/\/$/, "");
  const editBaseUrl =
    repo?.editBaseUrl?.replace(/\/$/, "") ??
    (repoUrl && repo?.branch ? `${repoUrl}/edit/${repo.branch}` : "");
  const editUrl =
    editBaseUrl && docPath && repo?.docsPath
      ? `${editBaseUrl}/${repo.docsPath}/${docPath}`
      : "";
  const activeLanguage = languages?.find((lang) => lang.active) ?? languages?.[0];
  const languagePrefix = activeLanguage ? `/${activeLanguage.code}` : "";
  const buildLangHref = (path: string) => {
    if (!languagePrefix) {
      return path;
    }
    if (path === "/") {
      return languagePrefix;
    }
    return `${languagePrefix}${path.startsWith("/") ? path : `/${path}`}`;
  };
  return (
    <div className="docs-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="icon-button menu-toggle"
            type="button"
            aria-label="Toggle navigation"
            data-menu-toggle
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link className="brand" href={buildLangHref("/")}>
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3l8 15H4z" />
              </svg>
            </span>
            <span className="brand-text">
              <span className="brand-name">{siteConfig.title}</span>
              <span className="brand-meta">Internal Docs</span>
            </span>
          </Link>
          <nav className="top-links">
            <Link className="top-link" href={buildLangHref("/")}>
              Docs
            </Link>
            <Link
              className="top-link"
              href={buildLangHref("/core-concepts/components")}
            >
              Components
            </Link>
            <Link className="top-link" href={buildLangHref("/changelog")}>
              Changelog
            </Link>
          </nav>
        </div>
        <div className="topbar-right">
          <div className="topbar-controls">
            {languages && languages.length > 0 ? (
              <details className="dropdown">
                <summary className="dropdown-trigger">
                  <span className="dropdown-text">
                    {activeLanguage?.label ?? "Language"}
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                    <path d="M7 10l5 5 5-5" />
                  </svg>
                </summary>
                <div className="dropdown-menu">
                  {languages.map((lang) => (
                    <Link
                      className={`dropdown-item${lang.active ? " active" : ""}`}
                      href={lang.href}
                      key={lang.code}
                    >
                      <span>{lang.label}</span>
                      {lang.active ? (
                        <span className="dropdown-check">✓</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </details>
            ) : null}
            <details className="dropdown align-right" data-theme-menu>
              <summary className="dropdown-trigger">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                  <path d="M12 4a1 1 0 011 1v2a1 1 0 11-2 0V5a1 1 0 011-1z" />
                  <path d="M12 17a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z" />
                  <path d="M4 12a1 1 0 011-1h2a1 1 0 110 2H5a1 1 0 01-1-1z" />
                  <path d="M17 12a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" />
                  <path d="M6.343 6.343a1 1 0 011.414 0l1.415 1.415a1 1 0 11-1.414 1.414L6.343 7.757a1 1 0 010-1.414z" />
                  <path d="M14.828 14.828a1 1 0 011.414 0l1.415 1.415a1 1 0 01-1.414 1.414l-1.415-1.415a1 1 0 010-1.414z" />
                  <path d="M6.343 17.657a1 1 0 010-1.414l1.415-1.415a1 1 0 011.414 1.414L7.757 17.657a1 1 0 01-1.414 0z" />
                  <path d="M14.828 9.172a1 1 0 010-1.414l1.415-1.415a1 1 0 011.414 1.414l-1.415 1.415a1 1 0 01-1.414 0z" />
                  <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
                <span className="dropdown-text" data-theme-label suppressHydrationWarning>
                  System
                </span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                  <path d="M7 10l5 5 5-5" />
                </svg>
              </summary>
              <div className="dropdown-menu">
                <button className="dropdown-item" type="button" data-theme-option="light">
                  Light
                </button>
                <button className="dropdown-item" type="button" data-theme-option="dark">
                  Dark
                </button>
                <button className="dropdown-item" type="button" data-theme-option="system">
                  System
                </button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="overlay" data-overlay></div>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-title">Navigation</span>
            <button
              className="icon-button sidebar-close"
              type="button"
              aria-label="Close navigation"
              data-menu-close
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <path d="M6 6l12 12M18 6l-12 12" />
              </svg>
            </button>
          </div>
          <div className="sidebar-search">
            <label className="search compact">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <path d="M11 4a7 7 0 105.292 12.292l3.707 3.707 1.414-1.414-3.707-3.707A7 7 0 0011 4z" />
              </svg>
              <input
                type="search"
                placeholder="Search"
                data-search-trigger
                readOnly
              />
              <span className="key-hint">CTRL K</span>
            </label>
          </div>

          {navGroups.map((group) => (
            <div className="nav-group" key={group.title} data-nav-group>
              <div className="nav-title">{group.title}</div>
              {group.items.map((item) => {
                if (item.type === "external") {
                  return (
                    <a
                      className="nav-link"
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      key={item.href}
                      data-nav-item
                      data-nav-text={item.title}
                    >
                      {item.title}
                    </a>
                  );
                }

                const isActive = item.href === currentRoute;
                return (
                  <Link
                    className={`nav-link${isActive ? " active" : ""}`}
                    href={item.href}
                    key={item.href}
                    data-nav-item
                    data-nav-text={item.title}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          ))}

          {showNavMeta ? (
            <div className="nav-footer">
              {resolvedStatus ? <div className="pill">{resolvedStatus}</div> : null}
              {version !== undefined ? (
                <span className="nav-meta">Version {version}</span>
              ) : null}
            </div>
          ) : null}
        </aside>

        <main className="content">
          <div className="content-stage">
            <RouteTransition />
            <article className="doc">
              <header className="doc-header">
                <div className="doc-header-top">
                  <div className="eyebrow">{section}</div>
                  {markdown ? <CopyPageButton markdown={markdown} /> : null}
                </div>
                <h1>{title}</h1>
                {metaTags.length > 0 ? (
                  <div className="doc-meta">
                    {metaTags.map((tag, index) => (
                      <span className="tag" key={`${tag}-${index}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </header>
              <div className="doc-body mdx-content">{children}</div>
              {pager ? (
                <nav className="doc-pager" aria-label="Doc pagination">
                  {pager.prev ? (
                    <Link className="pager-card" href={pager.prev.href}>
                      <span className="pager-label">Previous</span>
                      <span className="pager-title">
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="pager-icon">
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                        {pager.prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div className="pager-spacer" />
                  )}
                  {pager.next ? (
                    <Link className="pager-card align-right" href={pager.next.href}>
                      <span className="pager-label">Next</span>
                      <span className="pager-title">
                        {pager.next.title}
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="pager-icon">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      </span>
                    </Link>
                  ) : (
                    <div className="pager-spacer" />
                  )}
                </nav>
              ) : null}
            </article>
          </div>
          <SearchModal items={searchItems} askAi={askAi} askContext={askContext} />
        </main>

        <aside className="toc">
          <div className="toc-title">On this page</div>
          <Toc items={toc} />
        </aside>
      </div>
    </div>
  );
}

