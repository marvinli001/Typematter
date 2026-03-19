export type RegistryTocItem = {
  id: string;
  title: string;
  level: number;
};

export type RegistryPage = {
  route: string;
  contentRoute: string;
  contentPath: string;
  language?: string;
  title: string;
  order: number;
  section: string;
  type?: string;
  status?: string;
  version?: string | number;
  tags?: string[];
  description?: string;
  aliases?: string[];
  versionGroup?: string;
  changelog?: string;
  supersedes?: string;
  diffWith?: string;
  deprecatedIn?: string | number;
  removedIn?: string | number;
  hidden?: boolean;
  pager?: boolean;
  toc: RegistryTocItem[];
  components?: string[];
};

export type RegistryMeta = {
  version: string;
  generatedAt: string;
  contentHash: string;
  i18n: {
    enabled: boolean;
    defaultLanguage?: string;
    languages?: string[];
  };
};

export type ContentRegistry = {
  meta: RegistryMeta;
  pages: RegistryPage[];
  byRoute: Record<string, number>;
};
