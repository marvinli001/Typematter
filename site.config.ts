import { defineSiteConfig } from "./lib/typematter/config";

const siteConfig = defineSiteConfig({
  title: "Typematter",
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
});

export default siteConfig;
