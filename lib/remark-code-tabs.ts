import { visit } from "unist-util-visit";

type CodeNode = {
  type: "code";
  lang?: string | null;
  meta?: string | null;
  value: string;
};

type DirectiveNode = {
  type: "containerDirective";
  name?: string;
  attributes?: Record<string, string>;
  data?: { [key: string]: unknown };
  children?: Array<CodeNode | { type: string; [key: string]: unknown }>;
};

type ParagraphNode = {
  type: "paragraph";
  children?: Array<{ type: string; value?: string }>;
};

type TableNode = {
  type: "table";
  children?: Array<{ type: string; [key: string]: unknown }>;
};

type MdxAttribute = {
  type: "mdxJsxAttribute";
  name: string;
  value: string;
};

type MdxFlowElement = {
  type: "mdxJsxFlowElement";
  name: string;
  attributes?: MdxAttribute[];
  children?: Array<CodeNode | MdxFlowElement>;
};

const CODE_GROUP_NAME = "code-group";
const MATRIX_NAMES = new Set(["feature-matrix", "capability-matrix"]);
const TAB_NAMES = new Set(["tab", "code-tab", "code-group-tab"]);

function getParagraphText(node: ParagraphNode) {
  if (!node.children || node.children.length === 0) {
    return "";
  }
  return node.children
    .map((child) => (typeof child.value === "string" ? child.value : ""))
    .join("")
    .trim();
}

function getParagraphLines(node: ParagraphNode) {
  if (!node.children || node.children.length === 0) {
    return [];
  }
  const raw = node.children
    .map((child) => (typeof child.value === "string" ? child.value : ""))
    .join("");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function extractTextFromNodes(node: any): string {
  if (!node) {
    return "";
  }
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNodes).join("");
  }
  if (typeof node === "object" && Array.isArray(node.children)) {
    return node.children.map(extractTextFromNodes).join("");
  }
  return "";
}

function stripClosingMarkerFromTable(tableNode: TableNode) {
  const rows = tableNode.children ?? [];
  if (rows.length === 0) {
    return false;
  }

  const lastRow = rows[rows.length - 1] as { children?: Array<any> } | undefined;
  const cells = lastRow?.children ?? [];
  const rowText = extractTextFromNodes(cells).trim();
  if (!/^:::\s*$/.test(rowText)) {
    return false;
  }

  rows.pop();
  return true;
}

function splitRow(line: string) {
  let working = line.trim();
  if (working.startsWith("|")) {
    working = working.slice(1);
  }
  if (working.endsWith("|")) {
    working = working.slice(0, -1);
  }
  return working.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => {
    const normalized = cell.replace(/\s+/g, "");
    return /^:?-{3,}:?$/.test(normalized);
  });
}

function buildTableNode(lines: string[]) {
  if (lines.length < 2) {
    return null;
  }

  const headerCells = splitRow(lines[0]);
  const separatorCells = splitRow(lines[1]);
  if (headerCells.length === 0 || headerCells.length !== separatorCells.length) {
    return null;
  }
  if (!isSeparatorRow(separatorCells)) {
    return null;
  }

  const rows = lines.slice(2).map((line) => splitRow(line));

  const createCell = (value: string) => ({
    type: "tableCell",
    children: [{ type: "text", value }],
  });

  const headerRow = {
    type: "tableRow",
    children: headerCells.map((cell) => createCell(cell)),
  };

  const bodyRows = rows.map((cells) => ({
    type: "tableRow",
    children: headerCells.map((_, index) =>
      createCell(cells[index] ?? "")
    ),
  }));

  return {
    type: "table",
    children: [headerRow, ...bodyRows],
  };
}

function parseMeta(meta?: string | null) {
  if (!meta) {
    return { label: undefined as string | undefined, subtitle: undefined as string | undefined };
  }

  let rest = meta.trim();
  let label: string | undefined;
  const bracketMatch = rest.match(/^\[([^\]]+)\]\s*/);
  if (bracketMatch) {
    label = bracketMatch[1].trim();
    rest = rest.slice(bracketMatch[0].length).trim();
  }

  const attributes: Record<string, string> = {};
  const attrRegex = /(\w+)=(("[^"]*")|('[^']*')|([^\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rest))) {
    const key = match[1];
    const rawValue = match[3] || match[4] || match[5] || "";
    attributes[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  if (!label) {
    label = attributes.tab || attributes.label;
  }

  const subtitle = attributes.subtitle || attributes.title;

  return { label, subtitle };
}

export default function remarkCodeTabs() {
  return (tree: any) => {
    const getDirectiveLabel = (children: Array<any>) => {
      const labelIndex = children.findIndex(
        (child) => child?.type === "paragraph" && child?.data?.directiveLabel
      );
      if (labelIndex === -1) {
        return { label: undefined as string | undefined, children };
      }

      const labelNode = children[labelIndex] as ParagraphNode;
      const label = getParagraphText(labelNode);
      const nextChildren = children.slice();
      nextChildren.splice(labelIndex, 1);
      return { label, children: nextChildren };
    };

    const transformCodeNodes = (codeNodes: CodeNode[]) => {
      return codeNodes.map((codeNode, tabIndex) => {
        const { label, subtitle } = parseMeta(codeNode.meta);
        const tabLabel = label || codeNode.lang || `Code ${tabIndex + 1}`;
        const attributes: MdxAttribute[] = [
          { type: "mdxJsxAttribute", name: "label", value: tabLabel },
        ];

        if (subtitle) {
          attributes.push({
            type: "mdxJsxAttribute",
            name: "subtitle",
            value: subtitle,
          });
        }

        codeNode.meta = undefined;

        const tabNode: MdxFlowElement = {
          type: "mdxJsxFlowElement",
          name: "CodeTab",
          attributes,
          children: [codeNode],
        };

        return tabNode;
      });
    };

    const wrapCodeTabs = (codeTabs: MdxFlowElement[]) => {
      if (codeTabs.length === 0) {
        return null;
      }

      const groupNode: MdxFlowElement = {
        type: "mdxJsxFlowElement",
        name: "CodeTabs",
        children: codeTabs,
      };

      return groupNode;
    };

    const transformTabDirectives = (tabNodes: DirectiveNode[]) => {
      return tabNodes.map((tabNode, tabIndex) => {
        const rawAttributes = tabNode.attributes ?? {};
        const { label: directiveLabel, children: prunedChildren } =
          getDirectiveLabel(tabNode.children ?? []);
        const label =
          rawAttributes.label ||
          rawAttributes.tab ||
          rawAttributes.title ||
          directiveLabel ||
          `Tab ${tabIndex + 1}`;
        const subtitle = rawAttributes.subtitle;
        const attributes: MdxAttribute[] = [
          { type: "mdxJsxAttribute", name: "label", value: label },
        ];

        if (subtitle) {
          attributes.push({
            type: "mdxJsxAttribute",
            name: "subtitle",
            value: subtitle,
          });
        }

        const tabNodeElement: MdxFlowElement = {
          type: "mdxJsxFlowElement",
          name: "CodeTab",
          attributes,
          children: prunedChildren as any,
        };

        return tabNodeElement;
      });
    };

    visit(tree, "containerDirective", (node: DirectiveNode, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      if (node.name !== CODE_GROUP_NAME && !MATRIX_NAMES.has(node.name ?? "")) {
        return;
      }

      if (node.name === CODE_GROUP_NAME) {
        const directiveChildren = node.children ?? [];
        const tabDirectives = directiveChildren.filter((child) => {
          if (child?.type !== "containerDirective") {
            return false;
          }
          const name =
            typeof child.name === "string" ? child.name : "";
          return TAB_NAMES.has(name);
        }) as DirectiveNode[];
        const codeNodes = directiveChildren.filter(
          (child) => child.type === "code"
        ) as CodeNode[];

        const codeTabs =
          tabDirectives.length > 0
            ? transformTabDirectives(tabDirectives)
            : transformCodeNodes(codeNodes);

        const groupNode = wrapCodeTabs(codeTabs);

        if (!groupNode) {
          return;
        }

        parent.children[index] = groupNode as any;
        return;
      }

      let tableNode = (node.children ?? []).find(
        (child) => child.type === "table"
      ) as TableNode | undefined;

      if (!tableNode) {
        const tableLines = (node.children ?? []).flatMap((child) =>
          child?.type === "paragraph"
            ? getParagraphLines(child as ParagraphNode)
            : []
        );
        if (tableLines.length > 0) {
          const builtTable = buildTableNode(tableLines);
          if (builtTable) {
            tableNode = builtTable as TableNode;
          }
        }
      }

      if (!tableNode) {
        return;
      }

      parent.children[index] = {
        type: "mdxJsxFlowElement",
        name: "FeatureMatrix",
        children: [tableNode],
      } as any;
    });

    const children = tree.children;
    if (!Array.isArray(children) || children.length === 0) {
      return;
    }

    for (let i = 0; i < children.length; i += 1) {
      const node = children[i] as ParagraphNode;
      if (node?.type !== "paragraph") {
        continue;
      }

      const text = getParagraphText(node);
      if (!/^:::\s*code-group\s*$/.test(text)) {
        continue;
      }

      const codeNodes: CodeNode[] = [];
      let endIndex = -1;
      let valid = true;

      for (let j = i + 1; j < children.length; j += 1) {
        const child = children[j] as ParagraphNode | CodeNode;
        if (
          child?.type === "paragraph" &&
          /^:::\s*$/.test(getParagraphText(child))
        ) {
          endIndex = j;
          break;
        }
        if (child?.type === "code") {
          codeNodes.push(child as CodeNode);
          continue;
        }

        valid = false;
      }

      if (endIndex === -1 || codeNodes.length === 0 || !valid) {
        continue;
      }

      const codeTabs = transformCodeNodes(codeNodes);
      const groupNode = wrapCodeTabs(codeTabs);
      if (!groupNode) {
        continue;
      }

      children.splice(i, endIndex - i + 1, groupNode);
      i += 1;
    }

    for (let i = 0; i < children.length; i += 1) {
      const node = children[i] as ParagraphNode;
      if (node?.type !== "paragraph") {
        continue;
      }

      const openingLines = getParagraphLines(node);
      if (
        openingLines.length === 0 ||
        !/^:::\s*(feature-matrix|capability-matrix)\s*$/.test(openingLines[0])
      ) {
        continue;
      }

      const closingIndex = openingLines.findIndex((line, index) => {
        if (index === 0) {
          return false;
        }
        return /^:::\s*$/.test(line);
      });

      if (closingIndex !== -1) {
        const tableLines = openingLines.slice(1, closingIndex);
        const tableNode = buildTableNode(tableLines);
        if (tableNode) {
          children.splice(i, 1, {
            type: "mdxJsxFlowElement",
            name: "FeatureMatrix",
            children: [tableNode],
          } as any);
          continue;
        }
      }

      let tableNode: any = null;
      let endIndex = -1;
      let valid = true;
      const tableLines: string[] = openingLines.slice(1);
      let tableIndex = -1;

      for (let j = i + 1; j < children.length; j += 1) {
        const child = children[j] as ParagraphNode | TableNode | undefined;
        if (
          child?.type === "paragraph" &&
          /^:::\s*$/.test(getParagraphText(child))
        ) {
          endIndex = j;
          break;
        }

        if (child?.type === "table") {
          tableNode = child;
          tableIndex = j;
          if (stripClosingMarkerFromTable(child as TableNode)) {
            endIndex = j;
            break;
          }
          continue;
        }

        if (child?.type === "paragraph") {
          tableLines.push(...getParagraphLines(child));
          continue;
        }

        valid = false;
      }

      if (endIndex === -1 && tableNode && tableIndex !== -1) {
        if (stripClosingMarkerFromTable(tableNode as TableNode)) {
          endIndex = tableIndex;
        }
      }

      if (endIndex === -1 || !valid) {
        continue;
      }

      if (!tableNode && tableLines.length > 0) {
        tableNode = buildTableNode(tableLines);
      }

      if (!tableNode) {
        continue;
      }

      children.splice(i, endIndex - i + 1, {
        type: "mdxJsxFlowElement",
        name: "FeatureMatrix",
        children: [tableNode],
      } as any);

      i += 1;
    }
  };
}
