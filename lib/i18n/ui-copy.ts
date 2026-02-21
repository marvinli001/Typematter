import siteConfig from "../../site.config";

export type UiLanguage = "en" | "cn";

export type UiCopy = {
  metadata: {
    shellTitle: string;
    shellDescription: string;
    docDescriptionFallback: string;
    notFoundTitle: string;
  };
  theme: {
    light: string;
    dark: string;
    system: string;
  };
  docsShell: {
    brandMeta: string;
    docs: string;
    components: string;
    changelog: string;
    language: string;
    navigation: string;
    searchPlaceholder: string;
    onThisPage: string;
    previous: string;
    next: string;
    docPagination: string;
  };
  copyPage: {
    defaultLabel: string;
    copiedLabel: string;
  };
  toc: {
    noSections: string;
  };
  aria: {
    toggleNavigation: string;
    closeNavigation: string;
    closeSearch: string;
    searchModes: string;
    themeMenu: string;
    searchInput: string;
    askInput: string;
    languageMenu: string;
  };
  search: {
    searchPlaceholder: string;
    askPlaceholder: string;
    noSearchResults: string;
    noAnswerYet: string;
    sourcesTitle: string;
    examplesTitle: string;
    followupsTitle: string;
    retrievingSources: string;
    askButton: string;
    askTab: string;
    searchTab: string;
    searchSection: string;
    pageScope: string;
    sectionScope: string;
    siteScope: string;
    copyAnswer: string;
    copiedAnswer: string;
    askError: string;
    askTimeout: string;
    showErrorDetails: string;
    hideErrorDetails: string;
    copyErrorDetails: string;
    copiedErrorDetails: string;
    assistantGreeting: string;
    assistantIntro: string;
    assistantPrompt: string;
    thinking: string;
    loadingSearchIndex: string;
    loadingSearchResults: string;
    searchUnavailable: string;
  };
};

const EN_COPY: UiCopy = {
  metadata: {
    shellTitle: "Typematter Docs Shell",
    shellDescription: "Static-first docs shell with MDX and component semantics.",
    docDescriptionFallback: "Typematter documentation",
    notFoundTitle: "Not Found",
  },
  theme: {
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  docsShell: {
    brandMeta: "Internal Docs",
    docs: "Docs",
    components: "Components",
    changelog: "Changelog",
    language: "Language",
    navigation: "Navigation",
    searchPlaceholder: "Search",
    onThisPage: "On this page",
    previous: "Previous",
    next: "Next",
    docPagination: "Doc pagination",
  },
  copyPage: {
    defaultLabel: "Copy page",
    copiedLabel: "Copied",
  },
  toc: {
    noSections: "No sections",
  },
  aria: {
    toggleNavigation: "Toggle navigation",
    closeNavigation: "Close navigation",
    closeSearch: "Close search",
    searchModes: "Search modes",
    themeMenu: "Theme options",
    searchInput: "Search query",
    askInput: "Ask AI question",
    languageMenu: "Language options",
  },
  search: {
    searchPlaceholder: "Search documentation...",
    askPlaceholder: "Ask about this documentation...",
    noSearchResults: "No results",
    noAnswerYet: "Ask a question to get a cited answer.",
    sourcesTitle: "Sources",
    examplesTitle: "Example questions",
    followupsTitle: "Suggested follow-ups",
    retrievingSources: "Retrieving sources...",
    askButton: "Ask",
    askTab: "Ask AI",
    searchTab: "Search",
    searchSection: "Documentation",
    pageScope: "Current page",
    sectionScope: "Current section",
    siteScope: "Entire site",
    copyAnswer: "Copy answer with citations",
    copiedAnswer: "Copied",
    askError: "Ask AI failed. Please try again.",
    askTimeout: "Ask AI request timed out.",
    showErrorDetails: "Show details",
    hideErrorDetails: "Hide details",
    copyErrorDetails: "Copy full error",
    copiedErrorDetails: "Copied",
    assistantGreeting: "Hi!",
    assistantIntro:
      "I'm an AI assistant trained on this documentation and related pages.",
    assistantPrompt: "Ask me anything about this page or the docs.",
    thinking: "Thinking...",
    loadingSearchIndex: "Loading search index...",
    loadingSearchResults: "Loading matching documents...",
    searchUnavailable: "Search index is unavailable.",
  },
};

const CN_COPY: UiCopy = {
  metadata: {
    shellTitle: "Typematter 文档壳层",
    shellDescription: "基于 MDX 的静态优先文档壳层，强调组件语义一致性。",
    docDescriptionFallback: "Typematter 文档",
    notFoundTitle: "未找到页面",
  },
  theme: {
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
  },
  docsShell: {
    brandMeta: "内部文档",
    docs: "文档",
    components: "组件",
    changelog: "更新日志",
    language: "语言",
    navigation: "导航",
    searchPlaceholder: "搜索",
    onThisPage: "本页目录",
    previous: "上一页",
    next: "下一页",
    docPagination: "文档翻页",
  },
  copyPage: {
    defaultLabel: "复制页面",
    copiedLabel: "已复制",
  },
  toc: {
    noSections: "暂无章节",
  },
  aria: {
    toggleNavigation: "切换导航",
    closeNavigation: "关闭导航",
    closeSearch: "关闭搜索",
    searchModes: "搜索模式",
    themeMenu: "主题选项",
    searchInput: "搜索关键词",
    askInput: "Ask AI 问题",
    languageMenu: "语言选项",
  },
  search: {
    searchPlaceholder: "搜索文档...",
    askPlaceholder: "基于文档提问...",
    noSearchResults: "没有结果",
    noAnswerYet: "输入问题后可获得带引用的答案。",
    sourcesTitle: "来源",
    examplesTitle: "示例问题",
    followupsTitle: "推荐追问",
    retrievingSources: "正在检索来源...",
    askButton: "提问",
    askTab: "Ask AI",
    searchTab: "搜索",
    searchSection: "文档",
    pageScope: "当前页",
    sectionScope: "当前分组",
    siteScope: "全站",
    copyAnswer: "复制回答（含引用）",
    copiedAnswer: "已复制",
    askError: "Ask AI 调用失败，请稍后重试。",
    askTimeout: "Ask AI 请求超时。",
    showErrorDetails: "展开详情",
    hideErrorDetails: "收起详情",
    copyErrorDetails: "复制完整报错",
    copiedErrorDetails: "已复制",
    assistantGreeting: "你好！",
    assistantIntro: "我是基于当前文档训练的 AI 助手，可以按证据回答问题。",
    assistantPrompt: "你可以直接提问当前页或全站内容。",
    thinking: "思考中...",
    loadingSearchIndex: "正在加载搜索索引...",
    loadingSearchResults: "正在加载匹配分片...",
    searchUnavailable: "搜索索引不可用。",
  },
};

function toUiLanguage(value: string | undefined | null): UiLanguage {
  if (!value) {
    return "en";
  }

  const normalized = value.toLowerCase();
  if (normalized === "cn" || normalized === "zh" || normalized.startsWith("zh-")) {
    return "cn";
  }
  return "en";
}

export function resolveUiLanguage(language?: string | null): UiLanguage {
  if (language) {
    return toUiLanguage(language);
  }
  return toUiLanguage(siteConfig.i18n?.defaultLanguage ?? "en");
}

export function getUiCopy(language?: string | null): UiCopy {
  return resolveUiLanguage(language) === "cn" ? CN_COPY : EN_COPY;
}
