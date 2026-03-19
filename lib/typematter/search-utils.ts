const SYNONYM_GROUPS = [
  ["quickstart", "quick start", "getting started", "快速开始", "入门", "开始使用"],
  ["components", "component", "组件", "组件体系", "mdx 组件", "mdx components"],
  ["navigation", "nav", "导航", "导航规则"],
  ["architecture", "架构"],
  ["deployment", "deploy", "部署", "上线"],
  ["project structure", "structure", "项目结构", "目录结构"],
  ["build validation", "validation", "validate", "构建校验", "校验", "验证"],
  ["content registry", "registry", "内容注册表", "注册表"],
  ["authoring syntax", "syntax", "directive", "directives", "指令", "指令语法"],
  ["changelog", "release notes", "更新日志", "发行说明"],
  ["migration", "migrate", "迁移", "升级"],
  ["version", "versions", "release", "版本", "发版"],
  ["deprecated", "deprecation", "弃用", "废弃"],
  ["endpoint", "api endpoint", "接口", "接口头"],
  ["params", "parameters", "参数"],
  ["response", "responses", "响应"],
  ["schema", "结构", "响应结构"],
  ["search", "搜索"],
  ["ask ai", "docs ai", "文档问答", "问答"],
  ["callout", "note", "tip", "warning", "提示块"],
  ["details", "accordion", "折叠块", "详情"],
  ["file tree", "filetree", "文件树"],
  ["code group", "codegroup", "代码组", "代码切换"],
  ["preview frame", "previewframe", "预览框", "预览"],
  ["timeline", "release item", "时间线"],
];

export const DOC_TYPE_SEARCH_ALIASES: Record<string, string[]> = {
  guide: ["guide", "docs", "指南", "文档"],
  api: ["api", "reference", "接口", "参考"],
  migration: ["migration", "upgrade", "迁移", "升级"],
  changelog: ["changelog", "release notes", "更新日志", "发行说明"],
};

export const COMPONENT_SEARCH_ALIASES: Record<string, string[]> = {
  Callout: ["callout", "note", "tip", "warning", "deprecated", "提示块"],
  Columns: ["columns", "column", "分栏"],
  Cards: ["cards", "card", "卡片"],
  LinkButton: ["link button", "button", "链接按钮"],
  Badge: ["badge", "标签"],
  Annotation: ["annotation", "注释"],
  DiffBlock: ["diff block", "diff", "对比块", "差异"],
  CodeTabs: ["code tabs", "code group", "代码切换", "代码组"],
  Steps: ["steps", "step", "步骤"],
  Details: ["details", "accordion", "折叠块", "详情"],
  FileTree: ["file tree", "filetree", "文件树"],
  FeatureMatrix: ["feature matrix", "能力矩阵"],
  Endpoint: ["endpoint", "api endpoint", "接口头"],
  ParamTable: ["param table", "parameter table", "参数表"],
  ResponseSchema: ["response schema", "响应结构"],
  DoDont: ["do dont", "best practice", "建议对照", "最佳实践"],
  VersionGate: ["version gate", "version policy", "版本策略"],
  CommandGroup: ["command group", "commands", "命令切换"],
  PreviewFrame: ["preview frame", "iframe", "预览框"],
  Timeline: ["timeline", "release item", "时间线"],
};

function buildSynonymMap(groups: string[][]) {
  const map = new Map<string, Set<string>>();

  groups.forEach((group) => {
    const normalizedGroup = group
      .map((item) => normalizeForSearch(item))
      .filter(Boolean);
    normalizedGroup.forEach((entry) => {
      if (!map.has(entry)) {
        map.set(entry, new Set());
      }
      const bucket = map.get(entry)!;
      normalizedGroup.forEach((candidate) => {
        if (candidate !== entry) {
          bucket.add(candidate);
        }
      });
    });
  });

  return map;
}

const SYNONYM_MAP = buildSynonymMap(SYNONYM_GROUPS);

export function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function buildCharNgrams(text: string, size: number) {
  const chars = Array.from(text);
  if (chars.length <= size) {
    return [text];
  }

  const grams: string[] = [];
  for (let i = 0; i <= chars.length - size; i += 1) {
    grams.push(chars.slice(i, i + size).join(""));
  }
  return grams;
}

export function tokenizeForSearch(value: string) {
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
    tokens.push(...buildCharNgrams(seq, 2));
    if (chars.length <= 12) {
      tokens.push(...buildCharNgrams(seq, 3));
    }
  });

  return tokens.filter((token) => token.length > 0);
}

function addExpandedTerms(target: Set<string>, raw: string) {
  const normalized = normalizeForSearch(raw);
  if (!normalized) {
    return;
  }

  target.add(normalized);
  tokenizeForSearch(normalized).forEach((token) => target.add(token));

  const synonyms = SYNONYM_MAP.get(normalized);
  synonyms?.forEach((synonym) => {
    target.add(synonym);
    tokenizeForSearch(synonym).forEach((token) => target.add(token));
  });
}

export function expandQueryTokens(value: string, aliases: string[] = []) {
  const expanded = new Set<string>();
  addExpandedTerms(expanded, value);

  tokenizeForSearch(value).forEach((token) => {
    expanded.add(token);
    const synonyms = SYNONYM_MAP.get(token);
    synonyms?.forEach((synonym) => {
      expanded.add(synonym);
      tokenizeForSearch(synonym).forEach((derived) => expanded.add(derived));
    });
  });

  aliases.forEach((alias) => addExpandedTerms(expanded, alias));
  return Array.from(expanded).filter(Boolean);
}

export function derivePathAliases(contentPath: string, contentRoute: string) {
  const values = new Set<string>();
  [contentPath, contentRoute]
    .filter(Boolean)
    .forEach((raw) => {
      raw
        .replace(/\.mdx?$/i, "")
        .split(/[\/_-]+/g)
        .filter(Boolean)
        .forEach((part) => values.add(part));
    });

  return Array.from(values);
}

export function deriveComponentAliases(components?: string[]) {
  const aliases = new Set<string>();
  (components ?? []).forEach((name) => {
    aliases.add(name);
    (COMPONENT_SEARCH_ALIASES[name] ?? []).forEach((alias) => aliases.add(alias));
  });
  return Array.from(aliases);
}

export function deriveDocTypeAliases(type?: string) {
  if (!type) {
    return [];
  }
  return DOC_TYPE_SEARCH_ALIASES[type] ?? [type];
}

export function buildAliasList(options: {
  title?: string;
  section?: string;
  type?: string;
  contentPath: string;
  contentRoute: string;
  components?: string[];
  aliases?: string[];
}) {
  const values = new Set<string>();
  [
    options.title,
    options.section,
    ...deriveDocTypeAliases(options.type),
    ...derivePathAliases(options.contentPath, options.contentRoute),
    ...deriveComponentAliases(options.components),
    ...(options.aliases ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .forEach((value) => values.add(value));

  return Array.from(values);
}

export function scoreQueryCoverage(text: string, tokens: string[]) {
  if (!text || tokens.length === 0) {
    return 0;
  }

  const lower = text.toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (lower.includes(token)) {
      score += 1;
    }
  });
  return score;
}

export function compressSearchSnippet(text: string, query: string, maxLength = 280) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  if (clean.length <= maxLength) {
    return clean;
  }

  const tokens = expandQueryTokens(query);
  const lower = clean.toLowerCase();
  let index = -1;
  for (const token of tokens) {
    const found = lower.indexOf(token);
    if (found !== -1) {
      index = found;
      break;
    }
  }

  if (index === -1) {
    return `${clean.slice(0, maxLength)}...`;
  }

  const start = Math.max(0, index - Math.floor(maxLength * 0.35));
  const end = Math.min(clean.length, start + maxLength);
  let snippet = clean.slice(start, end).trim();
  if (start > 0) {
    snippet = `...${snippet}`;
  }
  if (end < clean.length) {
    snippet = `${snippet}...`;
  }
  return snippet;
}

export function isLikelySharedNavTitle(value: string, sharedTitles: string[] = []) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  if (sharedTitles.includes(normalized)) {
    return true;
  }
  return /^[A-Z0-9][A-Z0-9 /.+-]{0,11}$/.test(normalized);
}

export function containsVisibleCjk(value: string) {
  return containsCjk(value);
}
