import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DocsShell from "../../components/docs/DocsShell";
import {
  getAllDocEntries,
  getDocByLanguageAndPath,
  getDocBySlugSegments,
} from "../../lib/docs";
import { getNavData } from "../../lib/nav";
import { getI18nConfig } from "../../lib/i18n";
import { renderMdx } from "../../lib/mdx";

export const dynamicParams = false;
export const dynamic = "force-static";

export async function generateStaticParams() {
  const docs = getAllDocEntries();
  const params = docs.map((doc) => ({ slug: doc.slugSegments }));
  const i18nConfig = getI18nConfig();

  if (i18nConfig.enabled && !params.some((item) => item.slug.length === 0)) {
    params.push({ slug: [] });
  }

  return params;
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
  const allDocs = i18nConfig.enabled ? getAllDocEntries() : [];
  const languages = i18nConfig.enabled
    ? i18nConfig.languages.map((lang) => {
        const docsForLanguage = allDocs.filter(
          (item) => item.language === lang.code
        );
        const fallbackDoc =
          docsForLanguage.find((item) => item.contentRoute === "/") ??
          docsForLanguage[0];
        const targetDoc = doc.language
          ? getDocByLanguageAndPath(lang.code, doc.contentPath)
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
  const docsForSearch = i18nConfig.enabled
    ? allDocs.filter((entry) => entry.language === doc.language)
    : getAllDocEntries();
  const docMap = new Map(docsForSearch.map((entry) => [entry.route, entry]));
  const searchItems = groups.flatMap((group) =>
    group.items
      .filter((item) => item.type === "doc")
      .map((item) => {
        const entry = docMap.get(item.href);
        return {
          title: item.title,
          href: item.href,
          section: group.title,
          content: entry?.plainText,
        };
      })
  );
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
      currentRoute={doc.route}
      docPath={doc.relativePath}
      languages={languages}
      pager={resolvedPager}
    >
      {content}
    </DocsShell>
  );
}
