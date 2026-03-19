export type AskScope = "page" | "section" | "site";

export type AskIndexItem = {
  id: string;
  title: string;
  section: string;
  href: string;
  route: string;
  contentRoute: string;
  contentPath: string;
  language?: string;
  type?: string;
  version?: string | number;
  versionGroup?: string;
  aliases?: string[];
  anchor: string;
  heading?: string;
  content: string;
};

export type AskRequest = {
  question: string;
  language: string;
  scope: AskScope;
  currentRoute: string;
  currentSection: string;
  currentType?: string;
  currentVersion?: string | number;
  currentVersionGroup?: string;
  siteContext: {
    title: string;
  };
};

export type AskSource = {
  id: string;
  title: string;
  href: string;
  anchor: string;
  heading?: string;
  snippet: string;
  score?: number;
};

export type AskDonePayload = {
  followups?: string[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};
