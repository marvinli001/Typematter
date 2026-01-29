import { visit } from "unist-util-visit";

type HastNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: { [key: string]: any };
  children?: HastNode[];
};

function extractText(nodes: HastNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        return node.value ?? "";
      }
      if (node.children) {
        return extractText(node.children);
      }
      return "";
    })
    .join("");
}

function splitNodesIntoLines(nodes: HastNode[]): HastNode[][] {
  let lines: HastNode[][] = [[]];

  const appendLine = () => {
    lines.push([]);
  };

  const appendNodes = (target: HastNode[], fragment: HastNode[]) => {
    if (fragment.length > 0) {
      target.push(...fragment);
    }
  };

  const splitNode = (node: HastNode): HastNode[][] => {
    if (node.type === "text") {
      const parts = (node.value ?? "").split(/\n/);
      return parts.map((part) => {
        if (part.length === 0) {
          return [];
        }
        return [{ ...node, value: part }];
      });
    }

    if (node.children && node.children.length > 0) {
      const childLines = splitNodesIntoLines(node.children);
      return childLines.map((lineChildren) => {
        if (lineChildren.length === 0) {
          return [];
        }
        return [
          {
            ...node,
            children: lineChildren,
          },
        ];
      });
    }

    return [[node]];
  };

  nodes.forEach((node) => {
    const nodeLines = splitNode(node);
    if (nodeLines.length === 0) {
      return;
    }

    appendNodes(lines[lines.length - 1], nodeLines[0]);

    for (let i = 1; i < nodeLines.length; i += 1) {
      appendLine();
      appendNodes(lines[lines.length - 1], nodeLines[i]);
    }
  });

  return lines;
}

export default function rehypeCodeDiff() {
  return (tree: HastNode) => {
    visit(tree, "element", (node: HastNode, _index, parent: HastNode | null) => {
      if (!parent || node.tagName !== "code" || parent.tagName !== "pre") {
        return;
      }

      if (node.children?.some((child) => child.type === "element" && child.tagName === "span" && child.properties?.className?.includes?.("code-line"))) {
        return;
      }

      const lines = splitNodesIntoLines(node.children ?? []);
      node.children = lines.map((lineNodes) => {
        const text = extractText(lineNodes);
        const markerMatch = text.match(/^\s*([+-])/);
        const classNames = ["code-line"];
        if (markerMatch?.[1] === "+") {
          classNames.push("diff-add");
        } else if (markerMatch?.[1] === "-") {
          classNames.push("diff-remove");
        }

        return {
          type: "element",
          tagName: "span",
          properties: {
            className: classNames,
          },
          children: lineNodes.length > 0 ? lineNodes : [{ type: "text", value: "" }],
        } satisfies HastNode;
      });
    });
  };
}
