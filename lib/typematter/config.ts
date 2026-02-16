import type { TypematterPlugin } from "./plugin";

export type ValidationRuleLevel = "error" | "warn" | "off";

export type ValidationRuleId =
  | "brokenLinks"
  | "brokenAnchors"
  | "duplicateTitles"
  | "duplicateRoutes"
  | "orphanPages"
  | "invalidFrontmatter"
  | "emptyDirs"
  | "navMissing"
  | "navDuplicates"
  | "i18nStructure";

export type ValidationConfig = {
  rules?: Partial<Record<ValidationRuleId, ValidationRuleLevel>>;
  strict?: boolean;
};

export type LanguageOption = {
  code: string;
  label: string;
};

export type I18nConfig = {
  defaultLanguage: string;
  languages: LanguageOption[];
};

export type RepoConfig = {
  url: string;
  branch: string;
  docsPath: string;
  editBaseUrl?: string;
};

export type AskAiUiConfig = {
  defaultScope?: "page" | "section" | "site";
  recentLimit?: number;
  followupLimit?: number;
  examples?: Record<string, string[]>;
};

export type SiteConfig = {
  title: string;
  siteUrl?: string;
  contentDir?: string;
  repo?: RepoConfig;
  feedback?: {
    url: string;
  };
  i18n?: I18nConfig;
  askAi?: AskAiUiConfig;
  plugins?: TypematterPlugin[];
  validation?: ValidationConfig;
};

type WithoutLeadingSlash<T extends string> = T extends `/${infer Rest}`
  ? Rest
  : T;

export type NavDocSlug<Route extends string> = Route extends "/"
  ? "/"
  : Route | WithoutLeadingSlash<Route>;

export type NavItemConfig<Route extends string = string> =
  | {
      type: "doc";
      slug: NavDocSlug<Route>;
      title?: string;
      hidden?: boolean;
    }
  | {
      type: "external";
      title: string;
      href: string;
      hidden?: boolean;
    };

export type NavGroupConfig<Route extends string = string> = {
  title: string;
  items: NavItemConfig<Route>[];
};

export type NavConfig<Route extends string = string> = {
  groups: NavGroupConfig<Route>[];
  appendUnlisted?: boolean;
};

export function defineSiteConfig<T extends SiteConfig>(config: T): T {
  return config;
}

export function defineNavConfig<Route extends string>() {
  return (config: NavConfig<Route>) => config;
}
