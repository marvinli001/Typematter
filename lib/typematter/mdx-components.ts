import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import remarkDocsComponents from "../remark-docs-components";
import remarkCodeTabs from "../remark-code-tabs";

export const COMPONENT_ALIASES: Record<string, string> = {
  callout: "Callout",
  note: "Note",
  tip: "Tip",
  info: "Info",
  warning: "Warning",
  deprecated: "Deprecated",
  diffblock: "DiffBlock",
  diffcolumn: "DiffColumn",
  columns: "Columns",
  column: "Column",
  codetabs: "CodeTabs",
  codetab: "CodeTab",
  "code-group": "CodeTabs",
  tab: "CodeTab",
  featurematrix: "FeatureMatrix",
  "feature-matrix": "FeatureMatrix",
  steps: "Steps",
  step: "Step",
  details: "Details",
  accordion: "Details",
  filetree: "FileTree",
  "file-tree": "FileTree",
  filetreeitem: "FileTreeItem",
  cards: "Cards",
  card: "Card",
  "card-grid": "Cards",
  "card-group": "Cards",
  linkbutton: "LinkButton",
  badge: "Badge",
  annotation: "Annotation",
  endpoint: "Endpoint",
  paramtable: "ParamTable",
  paramfield: "ParamField",
  responseschema: "ResponseSchema",
  schemafield: "SchemaField",
  dodont: "DoDont",
  doitem: "DoItem",
  dontitem: "DontItem",
  versiongate: "VersionGate",
  commandgroup: "CommandGroup",
  command: "Command",
  previewframe: "PreviewFrame",
  timeline: "Timeline",
  releaseitem: "ReleaseItem",
  pre: "CodeBlock",
};

function pascalCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join("");
}

function normalizeComponentName(name: string) {
  const raw = String(name).trim();
  if (!raw) {
    return "";
  }

  const normalizedKey = raw.toLowerCase();
  if (COMPONENT_ALIASES[normalizedKey]) {
    return COMPONENT_ALIASES[normalizedKey];
  }

  if (/^[A-Z]/.test(raw)) {
    return raw;
  }

  if (/^[a-z][a-z0-9-]*$/.test(raw)) {
    return "";
  }

  return pascalCase(raw);
}

export function collectComponents(source: string) {
  const names = new Set<string>();
  const processor = remark()
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkCodeTabs)
    .use(remarkDocsComponents);
  const parsed = processor.parse(source);
  const tree = processor.runSync(parsed);

  visit(tree, ["mdxJsxFlowElement", "mdxJsxTextElement"], (node: any) => {
    if (node?.name) {
      const resolved = normalizeComponentName(String(node.name));
      if (resolved) {
        names.add(resolved);
      }
    }
  });

  visit(tree, ["containerDirective", "textDirective", "leafDirective"], (node: any) => {
    if (node?.name) {
      const resolved = normalizeComponentName(String(node.name));
      if (resolved) {
        names.add(resolved);
      }
    }
  });

  return Array.from(names.values()).sort((a, b) => a.localeCompare(b));
}
