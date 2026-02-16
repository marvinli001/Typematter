import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DocsShell from "../../components/docs/DocsShell";
import { getDocBySlugSegments } from "../../lib/docs";
import { getNavData } from "../../lib/nav";
import { getI18nConfig } from "../../lib/i18n";
import { renderMdx } from "../../lib/mdx";
import { loadRegistry, loadSearchIndex } from "../../lib/typematter/build-registry";
import siteConfig from "../../site.config";

export const dynamicParams = false;
export const dynamic = "force-static";

export async function generateStaticParams() {
  const registry = loadRegistry({
    buildIfMissing: process.env.NODE_ENV !== "production",
  });
  const params = new Map<string, { slug: string[] }>();

  registry.pages.forEach((page) => {
    const slugSegments = page.route === "/" ? [] : page.route.slice(1).split("/");
    params.set(slugSegments.join("/"), { slug: slugSegments });
  });

  if (!params.has("")) {
    params.set("", { slug: [] });
  }

  return Array.from(params.values());
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlugSegments(slug);
  if (!doc) {
    return { title: "Not Found" };
  }

  return {
    title: `${doc.frontmatter.title} | Typematter`,
    description: doc.frontmatter.description ?? "Typematter documentation",
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const doc = getDocBySlugSegments(slug);
  if (!doc) {
    notFound();
  }

  const content = await renderMdx(doc.content);
  const i18nConfig = getI18nConfig();
  const registry = loadRegistry({
    buildIfMissing: process.env.NODE_ENV !== "production",
  });
  const searchIndex = loadSearchIndex({
    buildIfMissing: process.env.NODE_ENV !== "production",
  });
  const allDocs = i18nConfig.enabled ? registry.pages : [];
  const languages = i18nConfig.enabled
    ? i18nConfig.languages.map((lang) => {
        const docsForLanguage = allDocs.filter(
          (item) => item.language === lang.code
        );
        const fallbackDoc =
          docsForLanguage.find((item) => item.contentRoute === "/") ??
          docsForLanguage[0];
        const targetDoc = doc.language
          ? docsForLanguage.find(
              (item) => item.contentPath === doc.contentPath
            )
          : fallbackDoc;
        return {
          code: lang.code,
          label: lang.label,
          href: targetDoc?.route ?? fallbackDoc?.route ?? doc.route,
          active: lang.code === doc.language,
        };
      })
    : undefined;
  const { groups } = getNavData(doc.language);
  const docItems = groups.flatMap((group) =>
    group.items.filter((item) => item.type === "doc")
  );
  const activeLanguage = doc.language ?? i18nConfig.defaultLanguage ?? undefined;
  const docRoutes = new Set(docItems.map((item) => item.href));
  const searchItems = searchIndex
    .filter((item) => docRoutes.has(item.href))
    .filter((item) =>
      i18nConfig.enabled ? item.language === activeLanguage : true
    )
    .map((item) => ({
      title: item.title,
      href: item.href,
      section: item.section,
      content: item.content,
    }));
  const currentIndex = docItems.findIndex((item) => item.href === doc.route);
  const prevItem =
    currentIndex > 0 ? docItems[currentIndex - 1] : undefined;
  const nextItem =
    currentIndex >= 0 && currentIndex < docItems.length - 1
      ? docItems[currentIndex + 1]
      : undefined;
  const pager =
    doc.frontmatter.pager && currentIndex >= 0
      ? {
          prev: prevItem
            ? { title: prevItem.title, href: prevItem.href }
            : undefined,
          next: nextItem
            ? { title: nextItem.title, href: nextItem.href }
            : undefined,
        }
      : undefined;
  const resolvedPager =
    pager && (pager.prev || pager.next) ? pager : undefined;

  const askEndpoint = process.env.NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT?.trim();
  const askEnabledEnv = process.env.NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENABLED?.trim();
  const askEnabled =
    askEnabledEnv === undefined || askEnabledEnv.length === 0
      ? Boolean(askEndpoint)
      : /^(1|true|yes|on)$/i.test(askEnabledEnv);
  const timeoutCandidate = Number.parseInt(
    process.env.NEXT_PUBLIC_TYPEMATTER_ASK_AI_TIMEOUT_MS ?? "",
    10
  );
  const timeoutMs =
    Number.isFinite(timeoutCandidate) && timeoutCandidate > 0
      ? timeoutCandidate
      : 25_000;
  const askUiConfig = siteConfig.askAi;
  const examples = askUiConfig?.examples?.[activeLanguage ?? ""] ?? [];
  const askAi = {
    enabled: askEnabled && Boolean(askEndpoint),
    endpoint: askEndpoint,
    timeoutMs,
    defaultScope: askUiConfig?.defaultScope ?? "page",
    followupLimit: askUiConfig?.followupLimit ?? 3,
    examples,
  };
  const askContext = {
    language: activeLanguage ?? "default",
    currentRoute: doc.route,
    currentSection: doc.frontmatter.section,
    title: doc.frontmatter.title,
  };

  return (
    <DocsShell
      navGroups={groups}
      toc={doc.headings}
      title={doc.frontmatter.title}
      section={doc.frontmatter.section}
      status={doc.frontmatter.status}
      version={doc.frontmatter.version}
      tags={doc.frontmatter.tags}
      searchItems={searchItems}
      markdown={doc.content}
      currentRoute={doc.route}
      docPath={doc.relativePath}
      languages={languages}
      pager={resolvedPager}
      askAi={askAi}
      askContext={askContext}
    >
      {content}
    </DocsShell>
  );
}
