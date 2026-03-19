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
  FrontmatterFieldRule,
  FrontmatterSchemaRule,
  FrontmatterTypeRule,
  LocalizedText,
  ValidationRuleId,
  ValidationRuleLevel,
  ValidationConfig,
} from "./config";
import type { TypematterPlugin } from "./plugin";
import { collectComponents } from "./mdx-components";
import { createBuildContext, getConfiguredPlugins } from "./plugin-runner";
import { isLikelySharedNavTitle } from "./search-utils";

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
  "type",
  "status",
  "version",
  "tags",
  "slug",
  "description",
  "aliases",
  "versionGroup",
  "changelog",
  "supersedes",
  "diffWith",
  "deprecatedIn",
  "removedIn",
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
  missingTranslations: "error",
  headingDepth: "error",
  frontmatterSchema: "error",
  docTypeConventions: "error",
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

function globToRegExp(glob: string) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "__DOUBLE_STAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__DOUBLE_STAR__/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchPath(pathname: string, patterns?: string[]) {
  if (!patterns || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => globToRegExp(pattern).test(pathname));
}

function isIgnoredTranslationPath(pathname: string, config?: ValidationConfig) {
  return matchPath(pathname, config?.translation?.ignorePaths);
}

const DEFAULT_FRONTMATTER_SCHEMA: Record<string, FrontmatterFieldRule> = {
  title: { required: true, type: "string" },
  order: { required: true, type: "number" },
  section: { required: true, type: "string" },
  type: { type: "string" },
  status: { type: "string" },
  version: { type: "string|number" },
  tags: { type: "string[]" },
  slug: { type: "string" },
  description: { type: "string" },
  aliases: { type: "string[]" },
  versionGroup: { type: "string" },
  changelog: { type: "string" },
  supersedes: { type: "string" },
  diffWith: { type: "string" },
  deprecatedIn: { type: "string|number" },
  removedIn: { type: "string|number" },
  hidden: { type: "boolean" },
  pager: { type: "boolean" },
};

function getRequiredTranslationFields(config?: ValidationConfig) {
  return config?.translation?.requiredFields ?? ["title", "section", "description", "type"];
}

function getRequiredTranslationLanguages(config?: ValidationConfig) {
  const configured = config?.translation?.requiredLanguages;
  const requested =
    configured && configured.length > 0
      ? configured
      : i18nConfig.languages.map((language) => language.code);
  return requested.filter((code) =>
    i18nConfig.languages.some((language) => language.code === code)
  );
}

function validateLocalizedTitleValue(
  value: LocalizedText | undefined,
  label: string,
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  const requiredLanguages = getRequiredTranslationLanguages(config);
  if (requiredLanguages.length <= 1) {
    return;
  }

  const sharedTitles = config?.translation?.sharedNavTitles ?? [];
  if (typeof value === "string") {
    if (!isLikelySharedNavTitle(value, sharedTitles)) {
      reportIssue(
        "missingTranslations",
        {
          type: "i18n-nav-title",
          message: `${label} 必须提供多语言标题映射`,
          file: "nav.config.ts",
        },
        report,
        config,
        options
      );
    }
    return;
  }

  if (!value || typeof value !== "object") {
    reportIssue(
      "missingTranslations",
      {
        type: "i18n-nav-title",
        message: `${label} 缺少标题配置`,
        file: "nav.config.ts",
      },
      report,
      config,
      options
    );
    return;
  }

  requiredLanguages.forEach((language) => {
    const candidate = value[language];
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      reportIssue(
        "missingTranslations",
        {
          type: "i18n-nav-title",
          message: `${label} 缺少语言标题: ${language}`,
          file: "nav.config.ts",
        },
        report,
        config,
        options
      );
    }
  });
}

function validateLocalizedNavTitles(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!i18nConfig.enabled || config?.translation?.requireLocalizedNavTitles === false) {
    return;
  }

  navConfig?.groups?.forEach((group, groupIndex) => {
    validateLocalizedTitleValue(
      group.title,
      `导航分组 #${groupIndex + 1}`,
      report,
      config,
      options
    );

    group.items.forEach((item, itemIndex) => {
      if (item.type === "external") {
        validateLocalizedTitleValue(
          item.title,
          `导航外链 #${groupIndex + 1}.${itemIndex + 1}`,
          report,
          config,
          options
        );
        return;
      }

      if (item.title !== undefined) {
        validateLocalizedTitleValue(
          item.title,
          `导航文档标题 #${groupIndex + 1}.${itemIndex + 1}`,
          report,
          config,
          options
        );
      }
    });
  });
}

function matchesDocTypeRule(pathname: string, rule: NonNullable<ValidationConfig["docTypes"]>[string]) {
  const included =
    !rule.include || rule.include.length === 0 ? true : matchPath(pathname, rule.include);
  const excluded = matchPath(pathname, rule.exclude);
  return included && !excluded;
}

function getSchemaRulesForPath(pathname: string, rules: FrontmatterSchemaRule[]) {
  return rules.filter((rule) => {
    const included =
      !rule.include || rule.include.length === 0
        ? true
        : matchPath(pathname, rule.include);
    const excluded = matchPath(pathname, rule.exclude);
    return included && !excluded;
  });
}

function mergeSchemaRules(
  pathname: string,
  rules: FrontmatterSchemaRule[]
): Record<string, FrontmatterFieldRule> {
  const merged = { ...DEFAULT_FRONTMATTER_SCHEMA };
  const matched = getSchemaRulesForPath(pathname, rules);
  matched.forEach((rule) => {
    Object.entries(rule.fields).forEach(([key, fieldRule]) => {
      merged[key] = { ...(merged[key] ?? {}), ...fieldRule };
    });
  });
  return merged;
}

function normalizeFieldTypes(typeRule?: FrontmatterTypeRule | FrontmatterTypeRule[]) {
  if (!typeRule) {
    return [];
  }
  return Array.isArray(typeRule) ? typeRule : [typeRule];
}

function isValueOfType(
  value: unknown,
  typeRule: FrontmatterTypeRule,
  itemType?: FrontmatterTypeRule
): boolean {
  if (typeRule === "string") {
    return typeof value === "string";
  }
  if (typeRule === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (typeRule === "boolean") {
    return typeof value === "boolean";
  }
  if (typeRule === "array") {
    if (!Array.isArray(value)) {
      return false;
    }
    if (!itemType) {
      return true;
    }
    return value.every((item) => isValueOfType(item, itemType));
  }
  if (typeRule === "object") {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  if (typeRule === "string[]") {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }
  if (typeRule === "number[]") {
    return (
      Array.isArray(value) &&
      value.every((item) => typeof item === "number" && Number.isFinite(item))
    );
  }
  if (typeRule === "string|number") {
    return typeof value === "string" || typeof value === "number";
  }

  return false;
}

function validateSchemaFieldValue(
  value: unknown,
  fieldRule: FrontmatterFieldRule
): { valid: boolean; detail?: string } {
  const types = normalizeFieldTypes(fieldRule.type);
  if (types.length > 0) {
    const typeMatched = types.some((typeRule) =>
      isValueOfType(value, typeRule, fieldRule.itemType)
    );
    if (!typeMatched) {
      return { valid: false, detail: `类型不匹配，期望 ${types.join(" | ")}` };
    }
  }

  if (fieldRule.enum && fieldRule.enum.length > 0) {
    const enumMatched = fieldRule.enum.some((candidate) => candidate === value);
    if (!enumMatched) {
      return { valid: false, detail: `值必须属于枚举: ${fieldRule.enum.join(", ")}` };
    }
  }

  return { valid: true };
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

function validateFrontmatterSchema(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("frontmatterSchema", config, options)) {
    return;
  }

  const schemaRules = config?.frontmatterSchemas ?? [];
  const docs = getAllDocEntries();

  docs.forEach((doc) => {
    const schema = mergeSchemaRules(doc.relativePath, schemaRules);
    const data = doc.frontmatter as Record<string, unknown>;

    Object.entries(schema).forEach(([field, fieldRule]) => {
      const value = data[field];
      const exists = value !== undefined && value !== null;

      if (fieldRule.required && !exists) {
        reportIssue(
          "frontmatterSchema",
          {
            type: "frontmatter-schema",
            message: `frontmatter 字段缺失: ${field}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
        return;
      }

      if (!exists) {
        return;
      }

      const result = validateSchemaFieldValue(value, fieldRule);
      if (!result.valid) {
        reportIssue(
          "frontmatterSchema",
          {
            type: "frontmatter-schema",
            message: `frontmatter 字段 ${field} 校验失败: ${result.detail ?? "无效值"}`,
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

function validateHeadingDepth(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("headingDepth", config, options)) {
    return;
  }

  const maxDepth = Math.min(6, Math.max(2, config?.heading?.maxDepth ?? 6));
  const allowSkip = config?.heading?.allowSkip ?? false;
  const docs = getAllDocEntries();

  docs.forEach((doc) => {
    const tree = remark()
      .use(remarkMdx)
      .use(remarkGfm)
      .use(remarkDirective)
      .parse(doc.content);

    let previousDepth = 0;
    visit(tree, "heading", (node: { depth: number }) => {
      const depth = node.depth;
      if (depth > maxDepth) {
        reportIssue(
          "headingDepth",
          {
            type: "heading-depth",
            message: `标题深度超出上限 h${maxDepth}: 当前为 h${depth}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }

      if (!allowSkip && previousDepth > 0 && depth - previousDepth > 1) {
        reportIssue(
          "headingDepth",
          {
            type: "heading-depth",
            message: `标题层级跳跃: h${previousDepth} -> h${depth}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }

      previousDepth = depth;
    });
  });
}

function validateMissingTranslations(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("missingTranslations", config, options)) {
    return;
  }

  const i18n = getI18nConfig();
  if (!i18n.enabled || !i18n.defaultLanguage) {
    return;
  }

  const docs = getAllDocEntries();
  const docsByLanguage = new Map<string, Map<string, (typeof docs)[number]>>();

  i18n.languages.forEach((language) => {
    docsByLanguage.set(language.code, new Map());
  });

  docs.forEach((doc) => {
    if (!doc.language) {
      return;
    }
    const bucket = docsByLanguage.get(doc.language);
    if (!bucket) {
      return;
    }
    bucket.set(doc.contentPath, doc);
  });

  const baseline = docsByLanguage.get(i18n.defaultLanguage);
  if (!baseline) {
    return;
  }
  const requiredFields = getRequiredTranslationFields(config);

  baseline.forEach((baseDoc, contentPath) => {
    if (isIgnoredTranslationPath(contentPath, config)) {
      return;
    }

    i18n.languages.forEach((language) => {
      const map = docsByLanguage.get(language.code);
      const translated = map?.get(contentPath);

      if (!translated) {
        reportIssue(
          "missingTranslations",
          {
            type: "i18n-missing",
            message: `缺失翻译页面: ${contentPath} (lang: ${language.code})`,
            file: baseDoc.relativePath,
          },
          report,
          config,
          options
        );
        return;
      }

      requiredFields.forEach((field) => {
        const value = translated.frontmatter[field as keyof typeof translated.frontmatter];
        if (value === undefined || value === null || value === "") {
          reportIssue(
            "missingTranslations",
            {
              type: "i18n-missing-frontmatter",
              message: `翻译页面缺少关键字段 ${String(field)}: ${contentPath} (lang: ${language.code})`,
              file: translated.relativePath,
            },
            report,
            config,
            options
          );
        }
      });
    });
  });

  i18n.languages.forEach((language) => {
    if (language.code === i18n.defaultLanguage) {
      return;
    }

    const map = docsByLanguage.get(language.code);
    if (!map) {
      return;
    }

    map.forEach((doc, contentPath) => {
      if (isIgnoredTranslationPath(contentPath, config)) {
        return;
      }
      if (!baseline.has(contentPath)) {
        reportIssue(
          "missingTranslations",
          {
            type: "i18n-extra",
            message: `仅存在于非默认语言的页面: ${contentPath} (lang: ${language.code})`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    });
  });

  validateLocalizedNavTitles(report, config, options);
}

function validateDocTypeConventions(
  report: ValidationReport,
  config?: ValidationConfig,
  options?: ValidateOptions
) {
  if (!shouldRunRule("docTypeConventions", config, options)) {
    return;
  }

  const docTypes = config?.docTypes ?? {};
  const docs = getAllDocEntries();

  docs.forEach((doc) => {
    const docType = typeof doc.frontmatter.type === "string" ? doc.frontmatter.type.trim() : "";
    const matchedEntries = Object.entries(docTypes).filter(([, rule]) =>
      matchesDocTypeRule(doc.relativePath, rule)
    );

    if (matchedEntries.length > 0 && docType) {
      const allowed = matchedEntries.some(([type]) => type === docType);
      if (!allowed) {
        reportIssue(
          "docTypeConventions",
          {
            type: "doc-type",
            message: `文档类型与路径模板不匹配: ${docType}`,
            file: doc.relativePath,
          },
          report,
          config,
          options
        );
      }
    }

    const activeRule =
      (docType && docTypes[docType]) ??
      (matchedEntries.length === 1 ? matchedEntries[0][1] : undefined);
    if (!activeRule) {
      return;
    }

    const usedComponents = collectComponents(doc.content);

    if (
      activeRule.requiredComponentsAnyOf &&
      activeRule.requiredComponentsAnyOf.length > 0 &&
      !activeRule.requiredComponentsAnyOf.some((component) =>
        usedComponents.includes(component)
      )
    ) {
      const resolvedDocType = docType || matchedEntries[0]?.[0] || "unknown";
      reportIssue(
        "docTypeConventions",
        {
          type: "doc-type-components",
          message: `文档类型 ${resolvedDocType} 需要至少一个推荐结构组件: ${activeRule.requiredComponentsAnyOf.join(", ")}`,
          file: doc.relativePath,
        },
        report,
        config,
        options
      );
    }

    if (
      activeRule.recommendedComponentsAnyOf &&
      activeRule.recommendedComponentsAnyOf.length > 0 &&
      !activeRule.recommendedComponentsAnyOf.some((component) =>
        usedComponents.includes(component)
      )
    ) {
      const resolvedDocType = docType || matchedEntries[0]?.[0] || "unknown";
      report.warn({
        type: "doc-type-components",
        message: `文档类型 ${resolvedDocType} 建议使用至少一个语义组件: ${activeRule.recommendedComponentsAnyOf.join(", ")}`,
        file: doc.relativePath,
      });
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

export async function validateDocs(options?: ValidateOptions): Promise<ValidationResult> {
  const report = createReport();
  const validationConfig = siteConfig.validation;

  validateFrontmatter(report, validationConfig, options);
  validateFrontmatterSchema(report, validationConfig, options);
  validateDuplicates(report, validationConfig, options);
  validateHeadingDepth(report, validationConfig, options);
  validateEmptyDirs(report, validationConfig, options);
  validateI18nStructure(report, validationConfig, options);
  validateMissingTranslations(report, validationConfig, options);
  validateDocTypeConventions(report, validationConfig, options);
  validateLinks(report, validationConfig, options);
  validateNavConfig(report, validationConfig, options);
  validateOrphanDocs(report, validationConfig, options);

  const plugins = getConfiguredPlugins(options?.plugins);
  const ctx = createBuildContext();
  for (const plugin of plugins) {
    if (plugin.hooks?.validate) {
      const pluginReport = {
        ...report,
        error: (issue: ValidationIssue) =>
          report.error({
            ...issue,
            type: `${plugin.name}:${issue.type}`,
          }),
        warn: (issue: ValidationIssue) =>
          report.warn({
            ...issue,
            type: `${plugin.name}:${issue.type}`,
          }),
      };

      try {
        await plugin.hooks.validate(ctx, pluginReport);
      } catch (error) {
        report.error({
          type: `${plugin.name}:validate`,
          message:
            error instanceof Error
              ? error.message
              : `插件校验异常: ${String(error)}`,
        });
      }
    }
  }

  const hasErrors = report.errors.length > 0;
  return { report, hasErrors };
}
