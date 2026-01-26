export type SiteConfig = {
  title: string;
  repo: {
    url: string;
    branch: string;
    docsPath: string;
    editBaseUrl?: string;
  };
  feedbackUrl: string;
  i18n?: {
    defaultLanguage: string;
    languages: Array<{
      code: string;
      label: string;
    }>;
  };
};

const siteConfig: SiteConfig = {
  title: "Typematter",
  repo: {
    url: "https://example.com/typematter",
    branch: "main",
    docsPath: "content",
    editBaseUrl: "https://example.com/typematter/edit/main",
  },
  feedbackUrl: "mailto:docs@example.com",
  i18n: {
    defaultLanguage: "cn",
    languages: [
      { code: "cn", label: "简体中文" },
      { code: "en", label: "English" },
    ],
  },
};

export default siteConfig;
