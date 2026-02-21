import path from "path";
import navConfig from "../../nav.config";
import siteConfig from "../../site.config";
import { getContentDir } from "../docs";
import type { BuildContext, TypematterPlugin } from "./plugin";
import type { ContentRegistry } from "./registry";

type LoggerLike = Pick<Console, "info" | "warn" | "error">;

type BuildHookName =
  | "buildStart"
  | "contentCollected"
  | "pageParsed"
  | "pageRendered"
  | "registryReady"
  | "buildEnd";

export function getConfiguredPlugins(plugins?: TypematterPlugin[]) {
  return plugins ?? siteConfig.plugins ?? [];
}

export function createBuildContext(logger: LoggerLike = console): BuildContext {
  return {
    siteConfig,
    navConfig,
    contentDir: getContentDir(),
    cacheDir: path.join(process.cwd(), ".typematter"),
    logger,
  };
}

function formatError(plugin: TypematterPlugin, hook: BuildHookName, error: unknown) {
  if (error instanceof Error) {
    return new Error(`[typematter:${plugin.name}.${hook}] ${error.message}`);
  }
  return new Error(`[typematter:${plugin.name}.${hook}] ${String(error)}`);
}

export async function runBuildHook(
  hook: BuildHookName,
  context: BuildContext,
  plugins: TypematterPlugin[],
  payload?: unknown
) {
  for (const plugin of plugins) {
    try {
      switch (hook) {
        case "buildStart":
          if (plugin.hooks?.buildStart) {
            await plugin.hooks.buildStart(context);
          }
          break;
        case "contentCollected":
          if (plugin.hooks?.contentCollected) {
            await plugin.hooks.contentCollected(context, payload as any);
          }
          break;
        case "pageParsed":
          if (plugin.hooks?.pageParsed) {
            await plugin.hooks.pageParsed(context, payload as any);
          }
          break;
        case "pageRendered":
          if (plugin.hooks?.pageRendered) {
            await plugin.hooks.pageRendered(context, payload as any);
          }
          break;
        case "registryReady":
          if (plugin.hooks?.registryReady) {
            await plugin.hooks.registryReady(context, payload as ContentRegistry);
          }
          break;
        case "buildEnd":
          if (plugin.hooks?.buildEnd) {
            await plugin.hooks.buildEnd(
              context,
              payload as { registry: ContentRegistry }
            );
          }
          break;
      }
    } catch (error) {
      throw formatError(plugin, hook, error);
    }
  }
}

export function collectMdxPlugins(plugins: TypematterPlugin[]) {
  const remark = plugins.flatMap((plugin) => plugin.mdx?.remark ?? []);
  const rehype = plugins.flatMap((plugin) => plugin.mdx?.rehype ?? []);
  const components = plugins.reduce<Record<string, unknown>>((acc, plugin) => {
    if (plugin.mdx?.components) {
      Object.assign(acc, plugin.mdx.components);
    }
    return acc;
  }, {});

  return { remark, rehype, components };
}
