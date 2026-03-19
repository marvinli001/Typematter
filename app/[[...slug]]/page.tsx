import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DocsShell from "../../components/docs/DocsShell";
import { getDocBySlugSegments } from "../../lib/docs";
import { getNavData } from "../../lib/nav";
import { getI18nConfig } from "../../lib/i18n";
import { getUiCopy } from "../../lib/i18n/ui-copy";
import { renderMdx } from "../../lib/mdx";
import { loadRegistry } from "../../lib/typematter/build-registry";
import type { ContentPage } from "../../lib/typematter/plugin";
import { getPageVersionInfo } from "../../lib/typematter/versioning";
import siteConfig from "../../site.config";

export const dynamicParams = false;
export const dynamic = "force-static";

function resolveLanguageFromSlug(slug?: string[]) {
  const i18n = getI18nConfig();
  if (!i18n.enabled) {
    return undefined;
  }

  const first = slug?.[0];
  if (!first) {
    return i18n.defaultLanguage ?? undefined;
  }

  if (i18n.languages.some((language) => language.code === first)) {
    return first;
  }

  return i18n.defaultLanguage ?? undefined;
}

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
  const routeLanguage = resolveLanguageFromSlug(slug);
  const copy = getUiCopy(routeLanguage);
  const doc = getDocBySlugSegments(slug);
  if (!doc) {
    return { title: copy.metadata.notFoundTitle };
  }

  const docLanguage = doc.language ?? routeLanguage;
  const docCopy = getUiCopy(docLanguage);
  return {
    title: `${doc.frontmatter.title} | ${siteConfig.title}`,
    description: doc.frontmatter.description ?? docCopy.metadata.docDescriptionFallback,
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

  const i18nConfig = getI18nConfig();
  const registry = loadRegistry({
    buildIfMissing: process.env.NODE_ENV !== "production",
  });
  const registryIndex = registry.byRoute[doc.route];
  const registryPage =
    typeof registryIndex === "number" ? registry.pages[registryIndex] : undefined;
  const contentPage: ContentPage = {
    route: doc.route,
    contentRoute: doc.contentRoute,
    contentPath: doc.contentPath,
    language: doc.language,
    title: doc.frontmatter.title,
    order: doc.frontmatter.order,
    section: doc.frontmatter.section,
    type: doc.frontmatter.type,
    status: doc.frontmatter.status,
    version: doc.frontmatter.version,
    tags: doc.frontmatter.tags,
    description: doc.frontmatter.description,
    aliases: doc.frontmatter.aliases,
    versionGroup: doc.frontmatter.versionGroup,
    changelog: doc.frontmatter.changelog,
    supersedes: doc.frontmatter.supersedes,
    diffWith: doc.frontmatter.diffWith,
    deprecatedIn: doc.frontmatter.deprecatedIn,
    removedIn: doc.frontmatter.removedIn,
    hidden: doc.frontmatter.hidden,
    pager: doc.frontmatter.pager,
    toc: doc.headings,
    components: registryPage?.components,
    filePath: doc.filePath,
    relativePath: doc.relativePath,
    content: doc.content,
    plainText: doc.plainText,
  };
  const content = await renderMdx(doc.content, {
    components: registryPage?.components,
    page: contentPage,
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
          ? docsForLanguage.find((item) => item.contentPath === doc.contentPath)
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
  const uiCopy = getUiCopy(activeLanguage);
  const docRoutes = new Set(docItems.map((item) => item.href));
  const currentIndex = docItems.findIndex((item) => item.href === doc.route);
  const prevItem = currentIndex > 0 ? docItems[currentIndex - 1] : undefined;
  const nextItem =
    currentIndex >= 0 && currentIndex < docItems.length - 1
      ? docItems[currentIndex + 1]
      : undefined;
  const pager =
    doc.frontmatter.pager && currentIndex >= 0
      ? {
          prev: prevItem ? { title: prevItem.title, href: prevItem.href } : undefined,
          next: nextItem ? { title: nextItem.title, href: nextItem.href } : undefined,
        }
      : undefined;
  const resolvedPager = pager && (pager.prev || pager.next) ? pager : undefined;

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
    language: activeLanguage ?? i18nConfig.defaultLanguage ?? "en",
    currentRoute: doc.route,
    currentSection: doc.frontmatter.section,
    title: doc.frontmatter.title,
    currentType: doc.frontmatter.type,
    currentVersion: doc.frontmatter.version,
    currentVersionGroup: doc.frontmatter.versionGroup ?? doc.contentPath,
  };
  const versionInfo = registryPage ? getPageVersionInfo(registry, registryPage) : null;

  return (
    <DocsShell
      navGroups={groups}
      toc={doc.headings}
      title={doc.frontmatter.title}
      section={doc.frontmatter.section}
      status={doc.frontmatter.status}
      version={doc.frontmatter.version}
      tags={doc.frontmatter.tags}
      markdown={doc.content}
      currentRoute={doc.route}
      languages={languages}
      pager={resolvedPager}
      versionInfo={versionInfo ?? undefined}
      askAi={askAi}
      askContext={askContext}
      uiCopy={uiCopy}
      standardSearch={{
        language: activeLanguage ?? i18nConfig.defaultLanguage ?? "en",
        manifestPath: "/typematter/search/manifest.json",
        allowedRoutes: Array.from(docRoutes),
      }}
      usedComponents={registryPage?.components ?? []}
    >
      {content}
    </DocsShell>
  );
}
