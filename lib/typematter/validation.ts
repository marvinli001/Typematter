import fs from "fs";
import path from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import navConfig from "../../nav.config";
import siteConfig from "../../site.config";
import {
  getAllDocEntries,
  getContentDir,
  normalizeRoute,
} from "../docs";
import { getNavData } from "../nav";
import { getI18nConfig } from "../i18n";
import type {
  ValidationRuleId,
  ValidationRuleLevel,
  ValidationConfig,
} from "./config";
import type { TypematterPlugin } from "./plugin";

type ValidationIssue = {
  type: string;
  message: string;
  file?: string;
};

export type ValidationReport = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  error: (issue: ValidationIssue) => void;
  warn: (issue: ValidationIssue) => void;
};

export type ValidationResult = {
  report: ValidationReport;
  hasErrors: boolean;
};

export type ValidateOptions = {
  rules?: Partial<Record<ValidationRuleId, ValidationRuleLevel>>;
  strict?: boolean;
  plugins?: TypematterPlugin[];
};

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

const DEFAULT_RULES: Record<ValidationRuleId, ValidationRuleLevel> = {
  brokenLinks: "error",
  brokenAnchors: "error",
  duplicateTitles: "error",
  duplicateRoutes: "error",
  orphanPages: "error",
  invalidFrontmatter: "error",
  emptyDirs: "error",
  navMissing: "error",
  navDuplicates: "error",
  i18nStructure: "error",
};

const i18nConfig = getI18nConfig();
const languageCodes = i18nConfig.enabled
  ? i18nConfig.languages.map((lang) => lang.code)
  : [null];

function resolveRuleLevel(
  ruleId: ValidationRuleId,
  overrides?: ValidationConfig,
  options?: ValidateOptions
) {
  const configured =
    options?.rules?.[ruleId] ?? overrides?.rules?.[ruleId] ?? DEFAULT_RULES[ruleId];
  const strict = options?.strict ?? overrides?.strict ?? false;
  if (configured === "warn" && strict) {
    return "error";
  }
  return configured;
}

function createReport(): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  return {
    errors,
    warnings,
    error: (issue) => errors.push(issue),
    warn: (issue) => warnings.push(issue),
  };
}

function shouldRunRule(
  ruleId: ValidationRuleId,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  return resolveRuleLevel(ruleId, config, options) !== "off";
}

function reportIssue(
  ruleId: ValidationRuleId,
  issue: ValidationIssue,
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  const level = resolveRuleLevel(ruleId, config, options);
  if (level === "off") {
    return;
  }
  if (level === "warn") {
    report.warn(issue);
    return;
  }
  report.error(issue);
}

function getDocsForLanguage(language: string | null) {
  const docs = getAllDocEntries();
  if (!i18nConfig.enabled) {
    return docs;
  }
  return docs.filter((doc) => doc.language === language);
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

function validateFrontmatter(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("invalidFrontmatter", config, options)) {
    return;
  }

  const docs = getAllDocEntries();
  docs.forEach((doc) => {
    const data = doc.frontmatter as Record<string, unknown>;
    REQUIRED_FIELDS.forEach((field) => {
      if (!(field in data)) {
        reportIssue(
          "invalidFrontmatter",
          {
            type: "frontmatter",
            message: `缺少必填字段: ${field}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    });

    Object.keys(data).forEach((field) => {
      if (!ALLOWED_FIELDS.has(field)) {
        reportIssue(
          "invalidFrontmatter",
          {
            type: "frontmatter",
            message: `未知字段: ${field}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    });

    if (data.title && typeof data.title !== "string") {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "title 必须为字符串",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (data.order !== undefined && typeof data.order !== "number") {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "order 必须为数字",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (data.section && typeof data.section !== "string") {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "section 必须为字符串",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (data.status && typeof data.status !== "string") {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "status 必须为字符串",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (
      data.version !== undefined &&
      typeof data.version !== "string" &&
      typeof data.version !== "number"
    ) {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "version 必须为字符串或数字",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        reportIssue(
          "invalidFrontmatter",
          {
            type: "frontmatter",
            message: "tags 必须为字符串数组",
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      } else if (!data.tags.every((tag) => typeof tag === "string")) {
        reportIssue(
          "invalidFrontmatter",
          {
            type: "frontmatter",
            message: "tags 仅支持字符串数组",
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    }

    if (data.pager !== undefined && typeof data.pager !== "boolean") {
      reportIssue(
        "invalidFrontmatter",
        {
          type: "frontmatter",
          message: "pager 必须为布尔值",
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }
  });
}

function validateDuplicates(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (
    !shouldRunRule("duplicateRoutes", config, options) &&
    !shouldRunRule("duplicateTitles", config, options)
  ) {
    return;
  }

  const docs = getAllDocEntries();
  const routeSet = new Set<string>();
  const titleSet = new Map<string, string>();

  docs.forEach((doc) => {
    if (routeSet.has(doc.route)) {
      reportIssue(
        "duplicateRoutes",
        {
          type: "duplicate-route",
          message: `重复路由: ${doc.route}`,
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }
    routeSet.add(doc.route);

    const normalizedTitle = doc.frontmatter.title?.toLowerCase();
    if (normalizedTitle) {
      const languageKey = doc.language ?? "default";
      const titleKey = `${languageKey}:${normalizedTitle}`;
      if (titleSet.has(titleKey)) {
        reportIssue(
          "duplicateTitles",
          {
            type: "duplicate-title",
            message: `重复标题: ${doc.frontmatter.title}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      } else {
        titleSet.set(titleKey, doc.relativePath);
      }
    }
  });
}

function validateEmptyDirs(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("emptyDirs", config, options)) {
    return;
  }

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
        reportIssue(
          "emptyDirs",
          {
            type: "empty-dir",
            message: `空目录: ${path.relative(contentDir, fullPath)}`,
          },
          report,
          config,
          options
        );
      }

      walk(fullPath);
    });
  }

  if (fs.existsSync(contentDir)) {
    walk(contentDir);
  }
}

function validateI18nStructure(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("i18nStructure", config, options)) {
    return;
  }

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
      reportIssue(
        "i18nStructure",
        {
          type: "i18n",
          message: `多语言开启时 content 根目录不应包含 mdx: ${entry.name}`,
        },
        report,
        config,
        options
      );
    }
  });
}

function validateLinks(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (
    !shouldRunRule("brokenLinks", config, options) &&
    !shouldRunRule("brokenAnchors", config, options)
  ) {
    return;
  }

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
        reportIssue(
          "brokenLinks",
          {
            type: "broken-link",
            message: `链接目标不存在: ${url} -> ${route}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
        return;
      }

      if (hash) {
        const match = target.headings.find((heading) => heading.id === hash);
        if (!match) {
          reportIssue(
            "brokenAnchors",
            {
              type: "broken-anchor",
              message: `锚点不存在: ${url}`,
              file: doc.relativePath,
            },
            report,
            config,
            options
          );
        }
      }
    });
  });
}

function validateNavConfig(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (
    !shouldRunRule("navMissing", config, options) &&
    !shouldRunRule("navDuplicates", config, options)
  ) {
    return;
  }

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
          reportIssue(
            "navMissing",
            {
              type: "nav",
              message: `外链必须是 http/https: ${item.href}`,
            },
            report,
            config,
            options
          );
        }
        return;
      }

      const contentRoute = normalizeRoute(item.slug);
      if (seenRoutes.has(contentRoute)) {
        reportIssue(
          "navDuplicates",
          {
            type: "nav",
            message: `导航重复路由: ${contentRoute}`,
          },
          report,
          config,
          options
        );
      }
      seenRoutes.add(contentRoute);

      languageCodes.forEach((language) => {
        const key = language ?? "default";
        const docRoutes = docRoutesByLanguage.get(key);
        if (!docRoutes?.has(contentRoute)) {
          const suffix = language ? ` (lang: ${language})` : "";
          reportIssue(
            "navMissing",
            {
              type: "nav",
              message: `导航项不存在: ${item.slug}${suffix}`,
            },
            report,
            config,
            options
          );
        }
      });
    });
  });
}

function validateOrphanDocs(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("orphanPages", config, options)) {
    return;
  }

  languageCodes.forEach((language) => {
    const { groups } = getNavData(language ?? undefined, {
      buildIfMissing: true,
    });
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
        reportIssue(
          "orphanPages",
          {
            type: "orphan",
            message: `页面未出现在导航中: ${doc.route}${suffix}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    });
  });
}

export function validateDocs(options?: ValidateOptions): ValidationResult {
  const report = createReport();
  const validationConfig = siteConfig.validation;

  validateFrontmatter(report, validationConfig, options);
  validateDuplicates(report, validationConfig, options);
  validateEmptyDirs(report, validationConfig, options);
  validateI18nStructure(report, validationConfig, options);
  validateLinks(report, validationConfig, options);
  validateNavConfig(report, validationConfig, options);
  validateOrphanDocs(report, validationConfig, options);

  const plugins = options?.plugins ?? siteConfig.plugins ?? [];
  plugins.forEach((plugin) => {
    if (plugin.hooks?.validate) {
      plugin.hooks.validate(
        {
          siteConfig,
          navConfig,
          contentDir: getContentDir(),
          cacheDir: path.join(process.cwd(), ".typematter"),
          logger: console,
        },
        report
      );
    }
  });

  const hasErrors = report.errors.length > 0;
  return { report, hasErrors };
}
