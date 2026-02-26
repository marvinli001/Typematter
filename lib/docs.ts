import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import { clearI18nCache, getI18nConfig } from "./i18n";
import siteConfig from "../site.config";

export type DocFrontmatter = {
  title: string;
  order: number;
  section: string;
  status?: string;
  version?: string | number;
  tags?: string[];
  slug?: string;
  description?: string;
  hidden?: boolean;
  pager?: boolean;
};

export type TocItem = {
  id: string;
  title: string;
  level: number;
};

export type DocEntry = {
  filePath: string;
  relativePath: string;
  contentPath: string;
  contentRoute: string;
  route: string;
  slugSegments: string[];
  frontmatter: DocFrontmatter;
  content: string;
  plainText: string;
  headings: TocItem[];
  language?: string;
};

const CONTENT_DIR = path.join(
  process.cwd(),
  siteConfig.contentDir ?? "content"
);
let cachedDocs: DocEntry[] | null = null;

export function getContentDir() {
  return CONTENT_DIR;
}

export function normalizeRoute(route: string) {
  if (!route || route === "/") {
    return "/";
  }

  const trimmed = route.replace(/^\/+|\/+$/g, "");
  return `/${trimmed}`;
}

function resolveRoute(relativePath: string, slug?: string) {
  if (slug) {
    return normalizeRoute(slug === "/" ? "/" : slug);
  }

  const withoutExt = relativePath.replace(/\.mdx$/i, "");
  const normalized = withoutExt.replace(/\\/g, "/");
  if (normalized === "index") {
    return "/";
  }

  if (normalized.endsWith("/index")) {
    return `/${normalized.slice(0, -"/index".length)}`;
  }

  return `/${normalized}`;
}

function normalizeSlugForLanguage(
  slug: string | undefined,
  language: string | undefined,
  i18nEnabled: boolean
) {
  if (!slug) {
    return undefined;
  }

  const normalized = normalizeRoute(slug === "/" ? "/" : slug);
  if (!i18nEnabled || !language) {
    return normalized;
  }

  const prefix = `/${language}`;
  if (normalized === prefix) {
    return "/";
  }

  if (normalized.startsWith(`${prefix}/`)) {
    return normalizeRoute(normalized.slice(prefix.length));
  }

  return normalized;
}

function prefixRoute(
  route: string,
  language: string | undefined,
  i18nEnabled: boolean
) {
  if (!i18nEnabled || !language) {
    return route;
  }

  if (route === "/") {
    return `/${language}`;
  }

  return `/${language}${route}`;
}

function walkDir(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, files);
      return;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
      files.push(fullPath);
    }
  });

  return files;
}

function extractHeadings(source: string): TocItem[] {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  const tree = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(source);

  visit(tree, "heading", (node: { depth: number }) => {
    const depth = node.depth;
    if (depth < 2 || depth > 6) {
      return;
    }

    const text = toString(node);
    if (!text) {
      return;
    }

    toc.push({
      id: slugger.slug(text),
      title: text,
      level: depth,
    });
  });

  return toc;
}

function extractPlainText(source: string) {
  const tree = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(source);
  return toString(tree).replace(/\s+/g, " ").trim();
}

export function getAllDocEntries() {
  if (cachedDocs) {
    return cachedDocs;
  }

  const i18nConfig = getI18nConfig();
  const contentDirs = i18nConfig.enabled
    ? i18nConfig.languages.map((lang) => path.join(CONTENT_DIR, lang.code))
    : [CONTENT_DIR];
  const files = contentDirs.flatMap((dir) => walkDir(dir));
  const docs = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(raw);
    const relativePath = path
      .relative(CONTENT_DIR, filePath)
      .replace(/\\/g, "/");
    const pathSegments = relativePath.split("/");
    const language = i18nConfig.enabled ? pathSegments[0] : undefined;
    const contentPath = i18nConfig.enabled
      ? pathSegments.slice(1).join("/")
      : relativePath;
    const normalizedSlug = normalizeSlugForLanguage(
      data.slug as string | undefined,
      language,
      i18nConfig.enabled
    );
    const contentRoute = resolveRoute(contentPath, normalizedSlug);
    const route = prefixRoute(contentRoute, language, i18nConfig.enabled);
    const slugSegments = route === "/" ? [] : route.slice(1).split("/");
    const headings = extractHeadings(content);
    const plainText = extractPlainText(content);

    return {
      filePath,
      relativePath,
      contentPath,
      contentRoute,
      route,
      slugSegments,
      frontmatter: data as DocFrontmatter,
      content,
      plainText,
      headings,
      language,
    };
  });

  cachedDocs = docs;
  return docs;
}

export function getDocByRoute(route: string) {
  const normalized = normalizeRoute(route);
  return getAllDocEntries().find((doc) => doc.route === normalized);
}

export function getDocBySlugSegments(slug?: string[]) {
  if (!slug || slug.length === 0) {
    const i18nConfig = getI18nConfig();
    if (i18nConfig.enabled && i18nConfig.defaultLanguage) {
      const fallback = getAllDocEntries().find(
        (doc) =>
          doc.language === i18nConfig.defaultLanguage &&
          doc.contentRoute === "/"
      );
      if (fallback) {
        return fallback;
      }
    }

    return getDocByRoute("/");
  }

  return getDocByRoute(`/${slug.join("/")}`);
}

export function getDocByLanguageAndPath(
  language: string,
  contentPath: string
) {
  return getAllDocEntries().find(
    (doc) => doc.language === language && doc.contentPath === contentPath
  );
}

export function clearDocsCache() {
  cachedDocs = null;
  clearI18nCache();
}
