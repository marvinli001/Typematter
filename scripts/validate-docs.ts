import fs from "fs";
import path from "path";
import navConfig from "../nav.config";
import {
  getAllDocEntries,
  getContentDir,
  normalizeRoute,
} from "../lib/docs";
import { getNavData } from "../lib/nav";
import { getI18nConfig } from "../lib/i18n";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

const REQUIRED_FIELDS = ["title", "order", "section"];
const ALLOWED_FIELDS = new Set([
  "title",
  "order",
  "section",
  "status",
  "version",
  "tags",
  "slug",
  "description",
  "hidden",
  "pager",
]);

type ValidationError = {
  type: string;
  message: string;
  file?: string;
};

const errors: ValidationError[] = [];
const i18nConfig = getI18nConfig();
const languageCodes = i18nConfig.enabled
  ? i18nConfig.languages.map((lang) => lang.code)
  : [null];

function getDocsForLanguage(language: string | null) {
  const docs = getAllDocEntries();
  if (!i18nConfig.enabled) {
    return docs;
  }
  return docs.filter((doc) => doc.language === language);
}

function report(error: ValidationError) {
  errors.push(error);
}

function isExternalLink(url: string) {
  return /^(https?:|mailto:|tel:|sms:)/.test(url) || url.startsWith("//");
}

function stripExtension(target: string) {
  return target.replace(/\.mdx?$/i, "");
}

function resolveInternalLink(currentRoute: string, url: string) {
  const [pathPart, hash] = url.split("#");
  let resolvedRoute = currentRoute;

  if (pathPart && pathPart.trim().length > 0) {
    const stripped = stripExtension(pathPart);
    if (stripped.startsWith("/")) {
      resolvedRoute = normalizeRoute(stripped);
    } else {
      const base = currentRoute === "/" ? "/" : path.posix.dirname(currentRoute);
      resolvedRoute = normalizeRoute(path.posix.resolve(base, stripped));
    }
  }

  return { route: resolvedRoute, hash };
}

function validateFrontmatter() {
  const docs = getAllDocEntries();
  docs.forEach((doc) => {
    const data = doc.frontmatter as Record<string, unknown>;
    REQUIRED_FIELDS.forEach((field) => {
      if (!(field in data)) {
        report({
          type: "frontmatter",
          message: `缺少必填字段: ${field}`,
          file: doc.relativePath,
        });
      }
    });

    Object.keys(data).forEach((field) => {
      if (!ALLOWED_FIELDS.has(field)) {
        report({
          type: "frontmatter",
          message: `未知字段: ${field}`,
          file: doc.relativePath,
        });
      }
    });

    if (data.title && typeof data.title !== "string") {
      report({
        type: "frontmatter",
        message: "title 必须为字符串",
        file: doc.relativePath,
      });
    }

    if (data.order !== undefined && typeof data.order !== "number") {
      report({
        type: "frontmatter",
        message: "order 必须为数字",
        file: doc.relativePath,
      });
    }

    if (data.section && typeof data.section !== "string") {
      report({
        type: "frontmatter",
        message: "section 必须为字符串",
        file: doc.relativePath,
      });
    }

    if (data.status && typeof data.status !== "string") {
      report({
        type: "frontmatter",
        message: "status 必须为字符串",
        file: doc.relativePath,
      });
    }

    if (
      data.version !== undefined &&
      typeof data.version !== "string" &&
      typeof data.version !== "number"
    ) {
      report({
        type: "frontmatter",
        message: "version 必须为字符串或数字",
        file: doc.relativePath,
      });
    }

    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        report({
          type: "frontmatter",
          message: "tags 必须为字符串数组",
          file: doc.relativePath,
        });
      } else if (!data.tags.every((tag) => typeof tag === "string")) {
        report({
          type: "frontmatter",
          message: "tags 仅支持字符串数组",
          file: doc.relativePath,
        });
      }
    }

    if (data.pager !== undefined && typeof data.pager !== "boolean") {
      report({
        type: "frontmatter",
        message: "pager 必须为布尔值",
        file: doc.relativePath,
      });
    }
  });
}

function validateDuplicates() {
  const docs = getAllDocEntries();
  const routeSet = new Set<string>();
  const titleSet = new Map<string, string>();

  docs.forEach((doc) => {
    if (routeSet.has(doc.route)) {
      report({
        type: "duplicate-route",
        message: `重复路由: ${doc.route}`,
        file: doc.relativePath,
      });
    }
    routeSet.add(doc.route);

    const normalizedTitle = doc.frontmatter.title?.toLowerCase();
    if (normalizedTitle) {
      const languageKey = doc.language ?? "default";
      const titleKey = `${languageKey}:${normalizedTitle}`;
      if (titleSet.has(titleKey)) {
        report({
          type: "duplicate-title",
          message: `重复标题: ${doc.frontmatter.title}`,
          file: doc.relativePath,
        });
      } else {
        titleSet.set(titleKey, doc.relativePath);
      }
    }
  });
}

function validateEmptyDirs() {
  const contentDir = getContentDir();

  function hasMdxFile(dir: string): boolean {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let found = false;

    entries.forEach((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
        found = true;
      } else if (entry.isDirectory()) {
        if (hasMdxFile(fullPath)) {
          found = true;
        }
      }
    });

    return found;
  }

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (!entry.isDirectory()) {
        return;
      }

      const fullPath = path.join(dir, entry.name);
      if (!hasMdxFile(fullPath)) {
        report({
          type: "empty-dir",
          message: `空目录: ${path.relative(contentDir, fullPath)}`,
        });
      }

      walk(fullPath);
    });
  }

  if (fs.existsSync(contentDir)) {
    walk(contentDir);
  }
}

function validateI18nStructure() {
  if (!i18nConfig.enabled) {
    return;
  }

  const contentDir = getContentDir();
  if (!fs.existsSync(contentDir)) {
    return;
  }

  const entries = fs.readdirSync(contentDir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
      report({
        type: "i18n",
        message: `多语言开启时 content 根目录不应包含 mdx: ${entry.name}`,
      });
    }
  });
}

function validateLinks() {
  const docs = getAllDocEntries();
  const docMap = new Map(docs.map((doc) => [doc.route, doc]));

  docs.forEach((doc) => {
    const tree = remark()
      .use(remarkMdx)
      .use(remarkGfm)
      .use(remarkDirective)
      .parse(doc.content);

    visit(tree, "link", (node: { url: string }) => {
      const url = node.url;
      if (!url || isExternalLink(url)) {
        return;
      }

      const { route, hash } = resolveInternalLink(doc.route, url);
      const target = docMap.get(route);

      if (!target) {
        report({
          type: "broken-link",
          message: `链接目标不存在: ${url} -> ${route}`,
          file: doc.relativePath,
        });
        return;
      }

      if (hash) {
        const match = target.headings.find((heading) => heading.id === hash);
        if (!match) {
          report({
            type: "broken-anchor",
            message: `锚点不存在: ${url}`,
            file: doc.relativePath,
          });
        }
      }
    });
  });
}

function validateNavConfig() {
  const docRoutesByLanguage = new Map<string, Set<string>>();
  languageCodes.forEach((language) => {
    const key = language ?? "default";
    const docsForLanguage = getDocsForLanguage(language);
    docRoutesByLanguage.set(
      key,
      new Set(docsForLanguage.map((doc) => doc.contentRoute))
    );
  });

  const seenRoutes = new Set<string>();

  navConfig?.groups?.forEach((group) => {
    group.items.forEach((item) => {
      if (item.hidden) {
        return;
      }

      if (item.type === "external") {
        if (!/^https?:\/\//.test(item.href)) {
          report({
            type: "nav",
            message: `外链必须是 http/https: ${item.href}`,
          });
        }
        return;
      }

      const contentRoute = normalizeRoute(item.slug);
      if (seenRoutes.has(contentRoute)) {
        report({
          type: "nav",
          message: `导航重复路由: ${contentRoute}`,
        });
      }
      seenRoutes.add(contentRoute);

      languageCodes.forEach((language) => {
        const key = language ?? "default";
        const docRoutes = docRoutesByLanguage.get(key);
        if (!docRoutes?.has(contentRoute)) {
          const suffix = language ? ` (lang: ${language})` : "";
          report({
            type: "nav",
            message: `导航项不存在: ${item.slug}${suffix}`,
          });
        }
      });
    });
  });
}

function validateOrphanDocs() {
  languageCodes.forEach((language) => {
    const { groups } = getNavData(language ?? undefined);
    const docs = getDocsForLanguage(language);
    const navRoutes = new Set<string>();

    groups.forEach((group) => {
      group.items.forEach((item) => {
        if (item.type === "doc") {
          navRoutes.add(item.href);
        }
      });
    });

    docs.forEach((doc) => {
      if (doc.frontmatter.hidden) {
        return;
      }

      if (!navRoutes.has(doc.route)) {
        const suffix = language ? ` (lang: ${language})` : "";
        report({
          type: "orphan",
          message: `页面未出现在导航中: ${doc.route}${suffix}`,
          file: doc.relativePath,
        });
      }
    });
  });
}

function run() {
  validateFrontmatter();
  validateDuplicates();
  validateEmptyDirs();
  validateI18nStructure();
  validateLinks();
  validateNavConfig();
  validateOrphanDocs();

  if (errors.length > 0) {
    console.error("\n文档校验失败:\n");
    errors.forEach((error) => {
      const location = error.file ? ` (${error.file})` : "";
      console.error(`- [${error.type}] ${error.message}${location}`);
    });
    console.error(`\n共 ${errors.length} 项错误。`);
    process.exit(1);
  }

  console.log("文档校验通过。");
}

run();
