import crypto from "crypto";
import fs from "fs";
import path from "path";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import remarkDocsComponents from "../remark-docs-components";
import remarkCodeTabs from "../remark-code-tabs";
import siteConfig from "../../site.config";
import { getAllDocEntries } from "../docs";
import { getI18nConfig } from "../i18n";
import type { AskIndexItem } from "./ask";
import {
  createBuildContext,
  getConfiguredPlugins,
  runBuildHook,
} from "./plugin-runner";
import type { ContentPage, TypematterPlugin, BuildContext } from "./plugin";
import type { ContentRegistry, RegistryPage } from "./registry";
import type {
  SearchBucketFile,
  SearchDocRecord,
  SearchIndexItem,
  SearchManifest,
  SearchPosting,
} from "./search";

const CACHE_DIR = path.join(process.cwd(), ".typematter");
const REGISTRY_FILE = "registry.json";
const SEARCH_INDEX_FILE = "search-index.json";
const ASK_INDEX_FILE = "ask-index.json";
const SITEMAP_FILE = "sitemap.xml";
const ROBOTS_FILE = "robots.txt";
const PUBLIC_DIR = path.join(process.cwd(), "public");
const PUBLIC_TYPEMATTER_DIR = path.join(PUBLIC_DIR, "typematter");
const PUBLIC_ASK_INDEX_DIR = PUBLIC_TYPEMATTER_DIR;
const PUBLIC_ASK_INDEX_FILE = "ask-index.json";
const PUBLIC_SEARCH_DIR = path.join(PUBLIC_TYPEMATTER_DIR, "search");
const SEARCH_MANIFEST_FILE = "manifest.json";
const SEARCH_BUCKETS = 32;

const COMPONENT_ALIASES: Record<string, string> = {
  callout: "Callout",
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  deprecated: "Deprecated",
  diffblock: "DiffBlock",
  diffcolumn: "DiffColumn",
  columns: "Columns",
  column: "Column",
  codetabs: "CodeTabs",
  codetab: "CodeTab",
  "code-group": "CodeTabs",
  tab: "CodeTab",
  featurematrix: "FeatureMatrix",
  "feature-matrix": "FeatureMatrix",
  steps: "Steps",
  step: "Step",
  details: "Details",
  accordion: "Details",
  filetree: "FileTree",
  "file-tree": "FileTree",
  filetreeitem: "FileTreeItem",
  cards: "Cards",
  card: "Card",
  "card-grid": "Cards",
  "card-group": "Cards",
  linkbutton: "LinkButton",
  badge: "Badge",
  annotation: "Annotation",
  pre: "CodeBlock",
};

type StandardSearchArtifacts = {
  manifest: SearchManifest;
  docsByLanguage: Record<string, SearchDocRecord[]>;
  shardBucketsByLanguage: Record<string, Array<SearchBucketFile>>;
};

type BuildRegistryResult = {
  registry: ContentRegistry;
  searchIndex: SearchIndexItem[];
  askIndex: AskIndexItem[];
  standardSearch: StandardSearchArtifacts;
};

type BuildRegistryOptions = {
  plugins?: TypematterPlugin[];
  context?: BuildContext;
};

let cachedRegistry: ContentRegistry | null = null;
let cachedSearchIndex: SearchIndexItem[] | null = null;
let cachedAskIndex: AskIndexItem[] | null = null;

function hashPayload(payload: unknown) {
  const json = JSON.stringify(payload);
  return crypto.createHash("sha1").update(json).digest("hex");
}

function getPackageVersion() {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function pascalCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join("");
}

function normalizeComponentName(name: string) {
  const raw = String(name).trim();
  if (!raw) {
    return "";
  }

  const normalizedKey = raw.toLowerCase();
  if (COMPONENT_ALIASES[normalizedKey]) {
    return COMPONENT_ALIASES[normalizedKey];
  }

  if (/^[A-Z]/.test(raw)) {
    return raw;
  }

  if (/^[a-z][a-z0-9-]*$/.test(raw)) {
    return "";
  }

  return pascalCase(raw);
}

function collectComponents(source: string) {
  const names = new Set<string>();
  const processor = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeTabs)
    .use(remarkDocsComponents);
  const parsed = processor.parse(source);
  const tree = processor.runSync(parsed);

  visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
    if (node?.name) {
      const resolved = normalizeComponentName(String(node.name));
      if (resolved) {
        names.add(resolved);
      }
    }
  });

  visit(tree, ["containerDirective", "textDirective", "leafDirective"], (node: any) => {
    if (node?.name) {
      const resolved = normalizeComponentName(String(node.name));
      if (resolved) {
        names.add(resolved);
      }
    }
  });

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function resolveSiteUrl() {
  return normalizeSiteUrl(
    siteConfig.siteUrl ??
      process.env.TYPEMATTER_SITE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.DOCS_ORIGIN
  );
}

function toPublicRouteUrl(siteUrl: string, route: string) {
  if (route === "/") {
    return `${siteUrl}/`;
  }
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return `${siteUrl}${normalized}/`;
}

function buildSitemapXml(registry: ContentRegistry, siteUrl: string) {
  const seen = new Set<string>();
  const urls = registry.pages
    .filter((page) => !page.hidden)
    .map((page) => toPublicRouteUrl(siteUrl, page.route))
    .filter((url) => {
      if (seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });

  const lastmod = registry.meta.generatedAt;
  const entries = urls
    .map(
      (url) =>
        `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function buildRobotsTxt(siteUrl: string | null) {
  const lines = ["User-agent: *", "Allow: /", ""];
  if (siteUrl) {
    lines.push(`Sitemap: ${siteUrl}/${SITEMAP_FILE}`);
  } else {
    lines.push(
      "# Set TYPEMATTER_SITE_URL (or site.config.ts siteUrl) to emit absolute sitemap URL."
    );
    lines.push(`Sitemap: https://example.com/${SITEMAP_FILE}`);
  }
  lines.push("");
  return lines.join("\n");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitForAskIndex(text: string, maxLength = 420) {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + maxLength);
    if (end < text.length) {
      const slice = text.slice(cursor, end);
      const sentenceBreak = Math.max(
        slice.lastIndexOf("。"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("！"),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("？"),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("；"),
        slice.lastIndexOf("; ")
      );
      if (sentenceBreak > Math.floor(maxLength * 0.4)) {
        end = cursor + sentenceBreak + 1;
      }
    }

    const chunk = text.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end <= cursor) {
      break;
    }
    cursor = end;
  }

  return chunks;
}

function extractAskChunks(source: string) {
  const tree = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(source) as any;

  const slugger = new GithubSlugger();
  const chunks: Array<{ anchor: string; heading?: string; content: string }> = [];
  let currentAnchor = "top";
  let currentHeading: string | undefined;
  const nodes = Array.isArray(tree.children) ? tree.children : [];

  nodes.forEach((node: any) => {
    if (node?.type === "heading") {
      const headingText = normalizeText(toString(node));
      if (!headingText) {
        return;
      }
      currentHeading = headingText;
      currentAnchor = slugger.slug(headingText) || "top";
      return;
    }

    const text = normalizeText(toString(node));
    if (!text) {
      return;
    }

    splitForAskIndex(text).forEach((piece) => {
      chunks.push({
        anchor: currentAnchor,
        heading: currentHeading,
        content: piece,
      });
    });
  });

  if (chunks.length === 0) {
    const fallback = normalizeText(toString(tree));
    if (fallback) {
      splitForAskIndex(fallback).forEach((piece) => {
        chunks.push({ anchor: "top", content: piece });
      });
    }
  }

  return chunks;
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForSearch(value: string) {
  const normalized = normalizeForSearch(value);
  if (!normalized) {
    return [];
  }

  const tokens: string[] = [];
  const latin = normalized.match(/[a-z0-9]+/g) ?? [];
  tokens.push(...latin);

  const cjkSequences =
    normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu) ??
    [];
  cjkSequences.forEach((seq) => {
    const chars = Array.from(seq);
    chars.forEach((char) => tokens.push(char));
    for (let i = 0; i < chars.length - 1; i += 1) {
      tokens.push(`${chars[i]}${chars[i + 1]}`);
    }
  });

  return tokens.filter((token) => token.length > 0);
}

function countTokens(value: string) {
  const counts = new Map<string, number>();
  tokenizeForSearch(value).forEach((token) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  });
  return counts;
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

function createContentPagesFromDocs() {
  const docs = getAllDocEntries();
  return docs.map((doc) => ({
    route: doc.route,
    contentRoute: doc.contentRoute,
    contentPath: doc.contentPath,
    language: doc.language,
    title: doc.frontmatter.title,
    order: doc.frontmatter.order,
    section: doc.frontmatter.section,
    status: doc.frontmatter.status,
    version: doc.frontmatter.version,
    tags: doc.frontmatter.tags,
    description: doc.frontmatter.description,
    hidden: doc.frontmatter.hidden,
    pager: doc.frontmatter.pager,
    toc: doc.headings,
    components: collectComponents(doc.content),
    filePath: doc.filePath,
    relativePath: doc.relativePath,
    content: doc.content,
    plainText: doc.plainText,
  })) as ContentPage[];
}

function buildStandardSearch(pages: ContentPage[], contentHash: string): StandardSearchArtifacts {
  const generatedAt = new Date().toISOString();
  const i18n = getI18nConfig();
  const languageKeys = i18n.enabled
    ? i18n.languages.map((language) => language.code)
    : ["default"];

  const docsByLanguage: Record<string, SearchDocRecord[]> = {};
  const shardBucketsByLanguage: Record<string, Array<SearchBucketFile>> = {};

  languageKeys.forEach((language) => {
    const pageDocs = pages.filter((page) =>
      language === "default" ? !page.language : page.language === language
    );

    const docs: SearchDocRecord[] = [];
    const bucketMaps: Array<Map<string, Map<number, SearchPosting>>> = Array.from(
      { length: SEARCH_BUCKETS },
      () => new Map()
    );

    const addPosting = (
      token: string,
      docId: number,
      key: "t" | "h" | "s" | "g" | "b",
      count: number
    ) => {
      const bucket = bucketForToken(token, SEARCH_BUCKETS);
      const tokenMap = bucketMaps[bucket];
      let postings = tokenMap.get(token);
      if (!postings) {
        postings = new Map();
        tokenMap.set(token, postings);
      }

      const existing = postings.get(docId) ?? { id: docId };
      existing[key] = (existing[key] ?? 0) + count;
      postings.set(docId, existing);
    };

    pageDocs.forEach((page, index) => {
      const snippet = page.plainText.slice(0, 280);
      const headingText = (page.toc ?? []).map((item) => item.title).join(" ");
      const tagsText = (page.tags ?? []).join(" ");
      const searchText = [page.title, headingText, page.section, tagsText, snippet]
        .filter(Boolean)
        .join(" ");

      docs.push({
        id: index,
        title: page.title,
        href: page.route,
        section: page.section,
        tags: page.tags,
        headings: (page.toc ?? []).map((item) => item.title),
        snippet,
        language: page.language,
        titleNormalized: normalizeForSearch(page.title),
        headingNormalized: normalizeForSearch(headingText),
        searchNormalized: normalizeForSearch(searchText),
      });

      countTokens(page.title).forEach((count, token) => {
        addPosting(token, index, "t", count);
      });
      countTokens(headingText).forEach((count, token) => {
        addPosting(token, index, "h", count);
      });
      countTokens(page.section).forEach((count, token) => {
        addPosting(token, index, "s", count);
      });
      countTokens(tagsText).forEach((count, token) => {
        addPosting(token, index, "g", count);
      });
      countTokens(page.plainText.slice(0, 5000)).forEach((count, token) => {
        addPosting(token, index, "b", count);
      });
    });

    docsByLanguage[language] = docs;
    shardBucketsByLanguage[language] = bucketMaps.map((bucketMap) => {
      const tokens: Record<string, SearchPosting[]> = {};
      bucketMap.forEach((postingMap, token) => {
        tokens[token] = Array.from(postingMap.values()).sort((a, b) => a.id - b.id);
      });
      return { tokens };
    });
  });

  const docsPathMap: Record<string, string> = {};
  const shardsPathMap: Record<string, string> = {};
  languageKeys.forEach((language) => {
    docsPathMap[language] = `/typematter/search/docs.${language}.json`;
    shardsPathMap[language] = `/typematter/search/shards/${language}`;
  });

  const manifest: SearchManifest = {
    version: getPackageVersion(),
    generatedAt,
    contentHash,
    buckets: SEARCH_BUCKETS,
    languages: languageKeys,
    docs: docsPathMap,
    shards: shardsPathMap,
  };

  return {
    manifest,
    docsByLanguage,
    shardBucketsByLanguage,
  };
}

function buildRegistryCore(pages: ContentPage[]): BuildRegistryResult {
  const i18nConfig = getI18nConfig();
  const generatedAt = new Date().toISOString();
  const pagesForRegistry: RegistryPage[] = pages.map((page) => ({
    route: page.route,
    contentRoute: page.contentRoute,
    contentPath: page.contentPath,
    language: page.language,
    title: page.title,
    order: page.order,
    section: page.section,
    status: page.status,
    version: page.version,
    tags: page.tags,
    description: page.description,
    hidden: page.hidden,
    pager: page.pager,
    toc: page.toc,
    components: page.components,
  }));

  const byRoute: Record<string, number> = {};
  pagesForRegistry.forEach((page, index) => {
    byRoute[page.route] = index;
  });

  const contentHash = hashPayload(
    pagesForRegistry.map((page) => ({
      route: page.route,
      title: page.title,
      order: page.order,
      section: page.section,
      status: page.status,
      version: page.version,
      tags: page.tags,
      components: page.components,
    }))
  );

  const registry: ContentRegistry = {
    meta: {
      version: getPackageVersion(),
      generatedAt,
      contentHash,
      i18n: {
        enabled: i18nConfig.enabled,
        defaultLanguage: i18nConfig.defaultLanguage ?? undefined,
        languages: i18nConfig.enabled
          ? i18nConfig.languages.map((lang) => lang.code)
          : undefined,
      },
    },
    pages: pagesForRegistry,
    byRoute,
  };

  const searchIndex: SearchIndexItem[] = pages.map((page) => ({
    title: page.title,
    href: page.route,
    section: page.section,
    content: page.plainText,
    language: page.language,
  }));

  const askIndex: AskIndexItem[] = pages.flatMap((page) =>
    extractAskChunks(page.content).map((chunk, index) => ({
      id: `${page.route}#${chunk.anchor}-${index + 1}`,
      title: page.title,
      section: page.section,
      href: page.route,
      route: page.route,
      contentRoute: page.contentRoute,
      contentPath: page.contentPath,
      language: page.language,
      anchor: chunk.anchor || "top",
      heading: chunk.heading,
      content: chunk.content,
    }))
  );

  const standardSearch = buildStandardSearch(pages, contentHash);
  return { registry, searchIndex, askIndex, standardSearch };
}

export function buildRegistry(): BuildRegistryResult {
  const pages = createContentPagesFromDocs();
  return buildRegistryCore(pages);
}

export async function buildRegistryWithPlugins(
  options?: BuildRegistryOptions
): Promise<BuildRegistryResult> {
  const plugins = getConfiguredPlugins(options?.plugins);
  const context = options?.context ?? createBuildContext();
  const pages = createContentPagesFromDocs();

  await runBuildHook("contentCollected", context, plugins, pages);
  for (const page of pages) {
    await runBuildHook("pageParsed", context, plugins, page);
  }

  const result = buildRegistryCore(pages);
  await runBuildHook("registryReady", context, plugins, result.registry);
  return result;
}

function writeStandardSearchArtifacts(artifacts: StandardSearchArtifacts) {
  fs.rmSync(PUBLIC_SEARCH_DIR, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC_SEARCH_DIR, { recursive: true });
  fs.mkdirSync(path.join(PUBLIC_SEARCH_DIR, "shards"), { recursive: true });

  const manifestPath = path.join(PUBLIC_SEARCH_DIR, SEARCH_MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(artifacts.manifest, null, 2));

  const docsPaths: string[] = [];
  const shardDirPaths: string[] = [];

  Object.entries(artifacts.docsByLanguage).forEach(([language, docs]) => {
    const docsPath = path.join(PUBLIC_SEARCH_DIR, `docs.${language}.json`);
    fs.writeFileSync(docsPath, JSON.stringify(docs, null, 2));
    docsPaths.push(docsPath);
  });

  Object.entries(artifacts.shardBucketsByLanguage).forEach(([language, buckets]) => {
    const langDir = path.join(PUBLIC_SEARCH_DIR, "shards", language);
    fs.mkdirSync(langDir, { recursive: true });
    shardDirPaths.push(langDir);
    buckets.forEach((bucket, index) => {
      const bucketPath = path.join(langDir, `${index}.json`);
      fs.writeFileSync(bucketPath, JSON.stringify(bucket, null, 2));
    });
  });

  return { manifestPath, docsPaths, shardDirPaths };
}

export function writeRegistryFiles(result: BuildRegistryResult, cacheDir = CACHE_DIR) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const registryPath = path.join(cacheDir, REGISTRY_FILE);
  fs.writeFileSync(registryPath, JSON.stringify(result.registry, null, 2));

  const searchPath = path.join(cacheDir, SEARCH_INDEX_FILE);
  fs.writeFileSync(searchPath, JSON.stringify(result.searchIndex, null, 2));

  const askPath = path.join(cacheDir, ASK_INDEX_FILE);
  fs.writeFileSync(askPath, JSON.stringify(result.askIndex, null, 2));

  fs.mkdirSync(PUBLIC_ASK_INDEX_DIR, { recursive: true });
  const publicAskPath = path.join(PUBLIC_ASK_INDEX_DIR, PUBLIC_ASK_INDEX_FILE);
  fs.writeFileSync(publicAskPath, JSON.stringify(result.askIndex, null, 2));

  const { manifestPath: searchManifestPath, docsPaths, shardDirPaths } =
    writeStandardSearchArtifacts(result.standardSearch);

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  const siteUrl = resolveSiteUrl();
  if (!siteUrl) {
    console.warn(
      "[typematter] Missing site URL. Set TYPEMATTER_SITE_URL (or site.config.ts siteUrl) for correct robots/sitemap links."
    );
  }
  const robotsPath = path.join(PUBLIC_DIR, ROBOTS_FILE);
  fs.writeFileSync(robotsPath, buildRobotsTxt(siteUrl));

  const sitemapPath = path.join(PUBLIC_DIR, SITEMAP_FILE);
  if (siteUrl) {
    fs.writeFileSync(sitemapPath, buildSitemapXml(result.registry, siteUrl));
  } else if (!fs.existsSync(sitemapPath)) {
    fs.writeFileSync(sitemapPath, buildSitemapXml(result.registry, "https://example.com"));
  }

  return {
    registryPath,
    searchPath,
    askPath,
    publicAskPath,
    robotsPath,
    sitemapPath,
    searchManifestPath,
    searchDocsPaths: docsPaths,
    searchShardDirs: shardDirPaths,
  };
}

export function getRegistryPath(cacheDir = CACHE_DIR) {
  return path.join(cacheDir, REGISTRY_FILE);
}

export function getSearchIndexPath(cacheDir = CACHE_DIR) {
  return path.join(cacheDir, SEARCH_INDEX_FILE);
}

export function getAskIndexPath(cacheDir = CACHE_DIR) {
  return path.join(cacheDir, ASK_INDEX_FILE);
}

export function loadRegistry(options?: { cacheDir?: string; buildIfMissing?: boolean }) {
  if (cachedRegistry) {
    return cachedRegistry;
  }
  const cacheDir = options?.cacheDir ?? CACHE_DIR;
  const registryPath = getRegistryPath(cacheDir);
  if (!fs.existsSync(registryPath)) {
    if (options?.buildIfMissing) {
      const result = buildRegistry();
      writeRegistryFiles(result, cacheDir);
      cachedRegistry = result.registry;
      cachedSearchIndex = result.searchIndex;
      cachedAskIndex = result.askIndex;
      return result.registry;
    }
    throw new Error(
      `Registry not found at ${registryPath}. Run typematter export-registry or typematter build.`
    );
  }

  const raw = fs.readFileSync(registryPath, "utf8");
  cachedRegistry = JSON.parse(raw) as ContentRegistry;
  return cachedRegistry;
}

export function loadSearchIndex(options?: { cacheDir?: string; buildIfMissing?: boolean }) {
  if (cachedSearchIndex) {
    return cachedSearchIndex;
  }
  const cacheDir = options?.cacheDir ?? CACHE_DIR;
  const searchPath = getSearchIndexPath(cacheDir);
  if (!fs.existsSync(searchPath)) {
    if (options?.buildIfMissing) {
      const result = buildRegistry();
      writeRegistryFiles(result, cacheDir);
      cachedRegistry = result.registry;
      cachedSearchIndex = result.searchIndex;
      cachedAskIndex = result.askIndex;
      return result.searchIndex;
    }
    return [];
  }

  const raw = fs.readFileSync(searchPath, "utf8");
  cachedSearchIndex = JSON.parse(raw) as SearchIndexItem[];
  return cachedSearchIndex;
}

export function loadAskIndex(options?: { cacheDir?: string; buildIfMissing?: boolean }) {
  if (cachedAskIndex) {
    return cachedAskIndex;
  }
  const cacheDir = options?.cacheDir ?? CACHE_DIR;
  const askPath = getAskIndexPath(cacheDir);
  if (!fs.existsSync(askPath)) {
    if (options?.buildIfMissing) {
      const result = buildRegistry();
      writeRegistryFiles(result, cacheDir);
      cachedRegistry = result.registry;
      cachedSearchIndex = result.searchIndex;
      cachedAskIndex = result.askIndex;
      return result.askIndex;
    }
    return [];
  }

  const raw = fs.readFileSync(askPath, "utf8");
  cachedAskIndex = JSON.parse(raw) as AskIndexItem[];
  return cachedAskIndex;
}
