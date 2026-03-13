import { defineSiteConfig } from "./lib/typematter/config";
import type { SiteConfig } from "./lib/typematter/config";

const siteConfig: SiteConfig = defineSiteConfig({
  title: "My Docs",
  siteUrl: process.env.TYPEMATTER_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
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
        "总结这一页的重点。",
        "给我最短的部署步骤。",
        "这个功能适合什么场景？",
      ],
      en: [
        "Summarize the key points on this page.",
        "Give me the shortest deployment steps.",
        "What use case is this feature for?",
      ],
    },
  },
});

export default siteConfig;
