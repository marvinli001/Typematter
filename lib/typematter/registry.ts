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
  status?: string;
  version?: string | number;
  tags?: string[];
  description?: string;
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
