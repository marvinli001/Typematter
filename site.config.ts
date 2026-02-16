import { defineSiteConfig } from "./lib/typematter/config";
import type { SiteConfig } from "./lib/typematter/config";

const siteConfig: SiteConfig = defineSiteConfig({
  title: "Typematter",
  siteUrl: process.env.TYPEMATTER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  repo: {
    url: "https://example.com/typematter",
    branch: "main",
    docsPath: "content",
    editBaseUrl: "https://example.com/typematter/edit/main",
  },
  feedback: { url: "mailto:docs@example.com" },
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
});

export default siteConfig;
