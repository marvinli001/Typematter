import fs from "fs";
import path from "path";

const STYLES_DIR = path.join(process.cwd(), "components", "mdx", "styles");

const COMPONENT_STYLE_FILES: Record<string, string[]> = {
  CodeBlock: ["code-block.css"],
  CodeTabs: ["code-block.css"],
  CodeTab: ["code-block.css"],
  LinkButton: ["link-button.css"],
  Columns: ["columns.css"],
  Column: ["columns.css"],
  Badge: ["badge.css"],
  Cards: ["cards.css"],
  Card: ["cards.css"],
  Callout: ["callout.css"],
  Note: ["callout.css"],
  Tip: ["callout.css"],
  Info: ["callout.css"],
  Warning: ["callout.css"],
  Deprecated: ["callout.css"],
  DiffBlock: ["diff-block.css"],
  DiffColumn: ["diff-block.css"],
  Steps: ["steps.css"],
  Step: ["steps.css"],
  Details: ["details.css"],
  FileTree: ["file-tree.css"],
  FileTreeItem: ["file-tree.css"],
  Annotation: ["annotation.css"],
  FeatureMatrix: ["feature-matrix.css"],
};

const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
  DiffBlock: ["DiffColumn"],
  Columns: ["Column"],
  CodeTabs: ["CodeTab"],
  Steps: ["Step"],
  FileTree: ["FileTreeItem"],
  Cards: ["Card"],
};

const cssCache = new Map<string, string>();

function expandDependencies(components: Set<string>) {
  let changed = true;
  while (changed) {
    changed = false;
    Array.from(components).forEach((name) => {
      const deps = COMPONENT_DEPENDENCIES[name] ?? [];
      deps.forEach((dep) => {
        if (!components.has(dep)) {
          components.add(dep);
          changed = true;
        }
      });
    });
  }
}

function readCss(fileName: string) {
  const cached = cssCache.get(fileName);
  if (cached !== undefined) {
    return cached;
  }

  const filePath = path.join(STYLES_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    cssCache.set(fileName, "");
    return "";
  }

  const css = fs.readFileSync(filePath, "utf8").trim();
  cssCache.set(fileName, css);
  return css;
}

export function getMdxComponentCss(components?: string[]) {
  const required = new Set<string>(["CodeBlock"]);
  (components ?? []).forEach((name) => required.add(name));
  expandDependencies(required);

  const files = new Set<string>();
  required.forEach((componentName) => {
    (COMPONENT_STYLE_FILES[componentName] ?? []).forEach((fileName) =>
      files.add(fileName)
    );
  });

  return Array.from(files.values())
    .map((fileName) => readCss(fileName))
    .filter((css) => css.length > 0)
    .join("\n\n");
}
