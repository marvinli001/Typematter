import crypto from "crypto";
import fs from "fs";
import path from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { getAllDocEntries } from "../docs";
import { getI18nConfig } from "../i18n";
import type { ContentRegistry, RegistryPage } from "./registry";
import type { SearchIndexItem } from "./search";

const CACHE_DIR = path.join(process.cwd(), ".typematter");
const REGISTRY_FILE = "registry.json";
const SEARCH_INDEX_FILE = "search-index.json";

type BuildRegistryResult = {
  registry: ContentRegistry;
  searchIndex: SearchIndexItem[];
};

let cachedRegistry: ContentRegistry | null = null;
let cachedSearchIndex: SearchIndexItem[] | null = null;

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

function collectComponents(source: string) {
  const names = new Set<string>();
  const tree = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .parse(source);

  visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
    if (node?.name) {
      names.add(String(node.name));
    }
  });

  visit(tree, ["containerDirective", "textDirective", "leafDirective"], (node: any) => {
    if (node?.name) {
      names.add(String(node.name));
    }
  });

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}

export function buildRegistry(): BuildRegistryResult {
  const docs = getAllDocEntries();
  const i18nConfig = getI18nConfig();
  const pages: RegistryPage[] = docs.map((doc) => ({
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
  }));

  const byRoute: Record<string, number> = {};
  pages.forEach((page, index) => {
    byRoute[page.route] = index;
  });

  const registry: ContentRegistry = {
    meta: {
      version: getPackageVersion(),
      generatedAt: new Date().toISOString(),
      contentHash: hashPayload(
        pages.map((page) => ({
          route: page.route,
          title: page.title,
          order: page.order,
          section: page.section,
          status: page.status,
          version: page.version,
          tags: page.tags,
        }))
      ),
      i18n: {
        enabled: i18nConfig.enabled,
        defaultLanguage: i18nConfig.defaultLanguage ?? undefined,
        languages: i18nConfig.enabled
          ? i18nConfig.languages.map((lang) => lang.code)
          : undefined,
      },
    },
    pages,
    byRoute,
  };

  const searchIndex: SearchIndexItem[] = docs.map((doc) => ({
    title: doc.frontmatter.title,
    href: doc.route,
    section: doc.frontmatter.section,
    content: doc.plainText,
    language: doc.language,
  }));

  return { registry, searchIndex };
}

export function writeRegistryFiles(result: BuildRegistryResult, cacheDir = CACHE_DIR) {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const registryPath = path.join(cacheDir, REGISTRY_FILE);
  fs.writeFileSync(registryPath, JSON.stringify(result.registry, null, 2));

  const searchPath = path.join(cacheDir, SEARCH_INDEX_FILE);
  fs.writeFileSync(searchPath, JSON.stringify(result.searchIndex, null, 2));

  return { registryPath, searchPath };
}

export function getRegistryPath(cacheDir = CACHE_DIR) {
  return path.join(cacheDir, REGISTRY_FILE);
}

export function getSearchIndexPath(cacheDir = CACHE_DIR) {
  return path.join(cacheDir, SEARCH_INDEX_FILE);
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
      return result.searchIndex;
    }
    return [];
  }

  const raw = fs.readFileSync(searchPath, "utf8");
  cachedSearchIndex = JSON.parse(raw) as SearchIndexItem[];
  return cachedSearchIndex;
}
