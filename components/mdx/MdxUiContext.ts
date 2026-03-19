export type MdxUiCopy = {
  calloutTitles: {
    note: string;
    tip: string;
    info: string;
    warning: string;
    deprecated: string;
  };
  detailsSummary: string;
  copyButton: {
    copy: string;
    copied: string;
  };
  codeBlock: {
    terminal: string;
    code: string;
  };
  commandGroup: {
    label: string;
  };
  previewFrame: {
    openSource: string;
  };
  doDont: {
    do: string;
    dont: string;
  };
  versionGate: {
    title: string;
    sinceTag: string;
    deprecatedTag: string;
    removedTag: string;
    availableSinceTemplate: string;
    deprecatedInTemplate: string;
    deprecatedTemplate: string;
    removedInTemplate: string;
    replacementTemplate: string;
  };
  apiDocs: {
    auth: string;
    since: string;
    deprecated: string;
    removedIn: string;
    name: string;
    type: string;
    required: string;
    default: string;
    description: string;
    yes: string;
    no: string;
    http: string;
    requiredBadge: string;
  };
};

const EN_COPY: MdxUiCopy = {
  calloutTitles: {
    note: "Note",
    tip: "Tip",
    info: "Info",
    warning: "Warning",
    deprecated: "Deprecated",
  },
  detailsSummary: "Details",
  copyButton: {
    copy: "Copy",
    copied: "Copied",
  },
  codeBlock: {
    terminal: "Terminal",
    code: "Code",
  },
  commandGroup: {
    label: "Commands",
  },
  previewFrame: {
    openSource: "Open source",
  },
  doDont: {
    do: "Do",
    dont: "Don't",
  },
  versionGate: {
    title: "Version policy",
    sinceTag: "Since",
    deprecatedTag: "Deprecated",
    removedTag: "Removed",
    availableSinceTemplate: "Available since {version}.",
    deprecatedInTemplate: "Deprecated in {version}.",
    deprecatedTemplate: "Deprecated.",
    removedInTemplate: "Removed in {version}.",
    replacementTemplate: "Use {replacement} instead.",
  },
  apiDocs: {
    auth: "Auth",
    since: "Since",
    deprecated: "Deprecated",
    removedIn: "Removed in",
    name: "Name",
    type: "Type",
    required: "Required",
    default: "Default",
    description: "Description",
    yes: "Yes",
    no: "No",
    http: "HTTP",
    requiredBadge: "required",
  },
};

const CN_COPY: MdxUiCopy = {
  calloutTitles: {
    note: "说明",
    tip: "提示",
    info: "信息",
    warning: "警告",
    deprecated: "弃用",
  },
  detailsSummary: "详情",
  copyButton: {
    copy: "复制",
    copied: "已复制",
  },
  codeBlock: {
    terminal: "终端",
    code: "代码",
  },
  commandGroup: {
    label: "命令",
  },
  previewFrame: {
    openSource: "打开源地址",
  },
  doDont: {
    do: "推荐做法",
    dont: "避免做法",
  },
  versionGate: {
    title: "版本策略",
    sinceTag: "自",
    deprecatedTag: "弃用",
    removedTag: "移除",
    availableSinceTemplate: "自 {version} 起可用。",
    deprecatedInTemplate: "已在 {version} 弃用。",
    deprecatedTemplate: "已弃用。",
    removedInTemplate: "将于 {version} 移除。",
    replacementTemplate: "建议改用 {replacement}。",
  },
  apiDocs: {
    auth: "认证",
    since: "自",
    deprecated: "弃用",
    removedIn: "移除版本",
    name: "名称",
    type: "类型",
    required: "必填",
    default: "默认值",
    description: "说明",
    yes: "是",
    no: "否",
    http: "HTTP",
    requiredBadge: "必填",
  },
};

function resolveLanguage(language?: string): "en" | "cn" {
  if (!language) {
    return "en";
  }

  const normalized = language.toLowerCase();
  if (normalized === "cn" || normalized === "zh" || normalized.startsWith("zh-")) {
    return "cn";
  }

  return "en";
}

export function resolveMdxUiCopy(language?: string): MdxUiCopy {
  return resolveLanguage(language) === "cn" ? CN_COPY : EN_COPY;
}
