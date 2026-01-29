import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import { mdxComponents } from "../components/mdx/mdx-components";
import remarkCodeTabs from "./remark-code-tabs";
import remarkDocsComponents from "./remark-docs-components";
import rehypeCodeDiff from "./rehype-code-diff";

export async function renderMdx(source: string) {
  const { default: MDXContent } = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm, remarkDirective, remarkCodeTabs, remarkDocsComponents],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      [rehypeHighlight, { ignoreMissing: true }],
      rehypeCodeDiff,
    ],
  });

  return runtime.jsx(MDXContent, { components: mdxComponents });
}
