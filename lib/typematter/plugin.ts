import type { NavConfig, SiteConfig } from "./config";
import type { ContentRegistry, RegistryPage } from "./registry";

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type BuildContext = {
  siteConfig: SiteConfig;
  navConfig?: NavConfig;
  contentDir: string;
  cacheDir: string;
  logger: Logger;
};

export type ContentPage = RegistryPage & {
  filePath: string;
  relativePath: string;
  content: string;
  plainText: string;
};

export type PluginValidationReport = {
  errors: Array<{ type: string; message: string; file?: string }>;
  warnings: Array<{ type: string; message: string; file?: string }>;
  error?: (issue: { type: string; message: string; file?: string }) => void;
  warn?: (issue: { type: string; message: string; file?: string }) => void;
};

export type TypematterPlugin = {
  name: string;
  mdx?: {
    remark?: any[];
    rehype?: any[];
  };
  hooks?: {
    buildStart?: (ctx: BuildContext) => void | Promise<void>;
    contentCollected?: (
      ctx: BuildContext,
      pages: ContentPage[]
    ) => void | Promise<void>;
    pageParsed?: (
      ctx: BuildContext,
      page: ContentPage
    ) => void | Promise<void>;
    pageRendered?: (
      ctx: BuildContext,
      page: ContentPage
    ) => void | Promise<void>;
    registryReady?: (
      ctx: BuildContext,
      registry: ContentRegistry
    ) => void | Promise<void>;
    validate?: (
      ctx: BuildContext,
      report: PluginValidationReport
    ) => void | Promise<void>;
    buildEnd?: (
      ctx: BuildContext,
      result: { registry: ContentRegistry }
    ) => void | Promise<void>;
  };
};
