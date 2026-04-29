import { defineSiteConfig } from "./lib/typematter/config";
import type { SiteConfig } from "./lib/typematter/config";
import { createDefaultValidationConfig } from "./lib/typematter/default-validation";

const repoUrl = process.env.TYPEMATTER_REPO_URL?.trim();
const repoBranch = process.env.TYPEMATTER_REPO_BRANCH?.trim() || "main";
const docsPath = process.env.TYPEMATTER_REPO_DOCS_PATH?.trim() || "content";
const editBaseUrl = process.env.TYPEMATTER_EDIT_BASE_URL?.trim();
const feedbackUrl = process.env.TYPEMATTER_FEEDBACK_URL?.trim();

const siteConfig: SiteConfig = defineSiteConfig({
  title: "Typematter",
  siteUrl: process.env.TYPEMATTER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  repo: repoUrl
    ? {
        url: repoUrl,
        branch: repoBranch,
        docsPath,
        editBaseUrl,
      }
    : undefined,
  feedback: feedbackUrl ? { url: feedbackUrl } : undefined,
  i18n: {
    defaultLanguage: "cn",
    languages: [
      { code: "cn", label: "简体中文" },
      { code: "en", label: "English" },
    ],
  },
  askAi: {
    defaultScope: "page",
    followupLimit: 3,
    examples: {
      cn: [
        "这个页面的核心结论是什么？",
        "基于文档给我一个最短可执行步骤。",
        "有哪些常见错误和排查方式？",
      ],
      en: [
        "What are the key takeaways from this page?",
        "Give me the shortest actionable steps from the docs.",
        "What are common mistakes and how to debug them?",
      ],
    },
  },
  validation: createDefaultValidationConfig(),
});

export default siteConfig;
