import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { resolveMdxComponents } from "../components/mdx/component-registry";
import type { BuildContext, ContentPage, TypematterPlugin } from "./typematter/plugin";
import {
  collectMdxPlugins,
  createBuildContext,
  getConfiguredPlugins,
  runBuildHook,
} from "./typematter/plugin-runner";
import remarkCodeTabs from "./remark-code-tabs";
import remarkDocsComponents from "./remark-docs-components";
import rehypeCodeDiff from "./rehype-code-diff";

type RenderMdxOptions = {
  components?: string[];
  plugins?: TypematterPlugin[];
  context?: BuildContext;
  page?: ContentPage;
};

export async function renderMdx(source: string, options?: RenderMdxOptions) {
  const plugins = getConfiguredPlugins(options?.plugins);
  const context = options?.context ?? createBuildContext();
  const mdxPluginConfig = collectMdxPlugins(plugins);
  const components = await resolveMdxComponents(
    options?.components ?? options?.page?.components,
    mdxPluginConfig.components,
    options?.page?.language
  );

  const { default: MDXContent } = await evaluate(source, {
    ...runtime,
    remarkPlugins: [
      remarkGfm,
      remarkDirective,
      remarkMath,
      remarkCodeTabs,
      remarkDocsComponents,
      ...mdxPluginConfig.remark,
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      rehypeKatex,
      [rehypeHighlight, { ignoreMissing: true }],
      rehypeCodeDiff,
      ...mdxPluginConfig.rehype,
    ],
  });

  const rendered = runtime.jsx(MDXContent, { components });
  if (options?.page) {
    await runBuildHook("pageRendered", context, plugins, options.page);
  }
  return rendered;
}
