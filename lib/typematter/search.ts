export type SearchIndexItem = {
  title: string;
  href: string;
  section?: string;
  type?: string;
  version?: string | number;
  aliases?: string[];
  content?: string;
  language?: string;
};

export type SearchDocRecord = {
  id: number;
  title: string;
  href: string;
  section?: string;
  type?: string;
  version?: string | number;
  tags?: string[];
  aliases?: string[];
  headings?: string[];
  snippet?: string;
  language?: string;
  titleNormalized: string;
  headingNormalized: string;
  aliasesNormalized: string;
  searchNormalized: string;
};

export type SearchPosting = {
  id: number;
  t?: number;
  h?: number;
  s?: number;
  g?: number;
  a?: number;
  b?: number;
};

export type SearchBucketFile = {
  tokens: Record<string, SearchPosting[]>;
};

export type SearchManifest = {
  version: string;
  generatedAt: string;
  contentHash: string;
  buckets: number;
  languages: string[];
  docs: Record<string, string>;
  shards: Record<string, string>;
};
