import { visit } from "unist-util-visit";

type ParagraphNode = {
  type: "paragraph";
  data?: { [key: string]: unknown };
  children?: Array<{ type: string; value?: string; children?: any[]; data?: any }>;
};

type BlockquoteNode = {
  type: "blockquote";
  children?: Array<any>;
};

type DirectiveNode = {
  type: "containerDirective";
  name?: string;
  attributes?: Record<string, string>;
  children?: Array<any>;
};

type TextDirectiveNode = {
  type: "textDirective";
  name?: string;
  attributes?: Record<string, string>;
  children?: Array<any>;
};

type ListNode = {
  type: "list";
  ordered?: boolean;
  children?: Array<any>;
};

type ListItemNode = {
  type: "listItem";
  children?: Array<any>;
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
  children?: Array<any>;
};

type MdxTextElement = {
  type: "mdxJsxTextElement";
  name: string;
  attributes?: MdxAttribute[];
  children?: Array<any>;
};

const ALERT_MAP: Record<
  string,
  { component: string; defaultTitle?: string }
> = {
  NOTE: { component: "Note" },
  TIP: { component: "Tip" },
  INFO: { component: "Info" },
  IMPORTANT: { component: "Info", defaultTitle: "Important" },
  WARNING: { component: "Warning" },
  CAUTION: { component: "Warning", defaultTitle: "Caution" },
  DEPRECATED: { component: "Deprecated" },
};

const DETAILS_NAMES = new Set(["details", "accordion"]);
const STEPS_NAMES = new Set(["steps"]);
const FILE_TREE_NAMES = new Set(["file-tree", "filetree"]);

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

function buildAttribute(name: string, value?: string) {
  if (!value) {
    return null;
  }
  return { type: "mdxJsxAttribute", name, value } satisfies MdxAttribute;
}

function getDirectiveLabel(children: Array<any>) {
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
}

function buildStepsFromList(listNode: ListNode) {
  const items = (listNode.children ?? []) as ListItemNode[];
  const stepChildren = items.map((item) => {
    return {
      type: "mdxJsxFlowElement",
      name: "Step",
      children: item.children ?? [],
    } satisfies MdxFlowElement;
  });

  return {
    type: "mdxJsxFlowElement",
    name: "Steps",
    children: stepChildren,
  } satisfies MdxFlowElement;
}

function removeTrailingMarker(value: string) {
  if (!/:::\s*$/.test(value)) {
    return { value, removed: false };
  }
  const cleaned = value.replace(/\n?\s*:::\s*$/, "");
  return { value: cleaned, removed: true };
}

function stripClosingMarkerFromList(listNode: ListNode) {
  const items = (listNode.children ?? []) as ListItemNode[];
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const paragraphs = (item.children ?? []).filter(
      (child) => child?.type === "paragraph"
    ) as ParagraphNode[];
    for (let p = paragraphs.length - 1; p >= 0; p -= 1) {
      const paragraph = paragraphs[p];
      const children = paragraph.children ?? [];
      for (let c = children.length - 1; c >= 0; c -= 1) {
        const child = children[c];
        if (child?.type !== "text" || typeof child.value !== "string") {
          continue;
        }
        const { value, removed } = removeTrailingMarker(child.value);
        if (!removed) {
          continue;
        }
        if (value.trim().length > 0) {
          child.value = value;
        } else {
          children.splice(c, 1);
        }

        if (children.length === 0) {
          const paragraphIndex = (item.children ?? []).indexOf(paragraph);
          if (paragraphIndex !== -1) {
            item.children?.splice(paragraphIndex, 1);
          }
        }

        return true;
      }
    }
  }

  return false;
}

function parseFileTreeLabel(rawLabel: string) {
  let name = rawLabel.trim();
  let description: string | undefined;
  const match = name.match(/^(.+?)(?:\s+[-–—:]\s+)(.+)$/);
  if (match) {
    name = match[1].trim();
    description = match[2].trim();
  }

  return { name, description };
}

function buildFileTreeItems(listNode: ListNode, openAll: boolean) {
  const items = (listNode.children ?? []) as ListItemNode[];
  return items.map((item) => {
    const itemChildren = item.children ?? [];
    const labelNode = itemChildren.find(
      (child) => child?.type === "paragraph"
    ) as ParagraphNode | undefined;
    const rawLabel = labelNode ? getParagraphText(labelNode) : "";
    const { name: parsedName, description } = parseFileTreeLabel(rawLabel);
    const listChild = itemChildren.find(
      (child) => child?.type === "list"
    ) as ListNode | undefined;
    const hasChildren = Boolean(listChild);
    const isDir = hasChildren || parsedName.endsWith("/");
    const name = parsedName.replace(/\/$/, "");

    const attributes: MdxAttribute[] = [
      { type: "mdxJsxAttribute", name: "name", value: name || "Item" },
      {
        type: "mdxJsxAttribute",
        name: "kind",
        value: isDir ? "dir" : "file",
      },
    ];

    if (description) {
      attributes.push({
        type: "mdxJsxAttribute",
        name: "description",
        value: description,
      });
    }

    if (openAll && isDir) {
      attributes.push({
        type: "mdxJsxAttribute",
        name: "open",
        value: "true",
      });
    }

    const childItems = listChild ? buildFileTreeItems(listChild, openAll) : [];

    return {
      type: "mdxJsxFlowElement",
      name: "FileTreeItem",
      attributes,
      children: childItems,
    } satisfies MdxFlowElement;
  });
}

function buildFileTree(listNode: ListNode, openAll: boolean) {
  return {
    type: "mdxJsxFlowElement",
    name: "FileTree",
    children: buildFileTreeItems(listNode, openAll),
  } satisfies MdxFlowElement;
}

function extractAlert(blockquote: BlockquoteNode) {
  const children = blockquote.children ?? [];
  if (children.length === 0) {
    return null;
  }

  const firstParagraph = children[0] as ParagraphNode;
  if (!firstParagraph || firstParagraph.type !== "paragraph") {
    return null;
  }

  const firstTextNode = firstParagraph.children?.find(
    (child) => child.type === "text"
  ) as { type: string; value?: string } | undefined;
  if (!firstTextNode || !firstTextNode.value) {
    return null;
  }

  const raw = firstTextNode.value;
  const [firstLine, ...restLines] = raw.split(/\r?\n/);
  const match = firstLine.match(/^\s*\[!([A-Za-z]+)\]\s*(.*)$/);
  if (!match) {
    return null;
  }

  const kind = match[1].toUpperCase();
  const info = ALERT_MAP[kind];
  if (!info) {
    return null;
  }

  const titleCandidate = match[2]?.trim();
  firstTextNode.value = restLines.join("\n");

  const nextChildren = firstParagraph.children?.filter((child) => {
    if (child.type !== "text") {
      return true;
    }
    return typeof child.value === "string" ? child.value.length > 0 : false;
  });
  firstParagraph.children = nextChildren;

  const trimmedChildren = children.slice();
  if (!firstParagraph.children || firstParagraph.children.length === 0) {
    trimmedChildren.shift();
  }

  const attributes: MdxAttribute[] = [];
  const title = titleCandidate || info.defaultTitle;
  if (title) {
    attributes.push({ type: "mdxJsxAttribute", name: "title", value: title });
  }

  return {
    type: "mdxJsxFlowElement",
    name: info.component,
    attributes,
    children: trimmedChildren,
  } satisfies MdxFlowElement;
}

function transformDetails(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const summary = rawAttributes.summary || rawAttributes.title || label;
  const attributes: MdxAttribute[] = [];

  const summaryAttr = buildAttribute("summary", summary);
  if (summaryAttr) {
    attributes.push(summaryAttr);
  }

  if (rawAttributes.open || rawAttributes.expanded) {
    attributes.push({
      type: "mdxJsxAttribute",
      name: "open",
      value: rawAttributes.open ?? rawAttributes.expanded ?? "true",
    });
  }

  return {
    type: "mdxJsxFlowElement",
    name: "Details",
    attributes,
    children,
  } satisfies MdxFlowElement;
}

function transformSteps(node: DirectiveNode) {
  const listNode = (node.children ?? []).find(
    (child) => child?.type === "list" && child?.ordered
  ) as ListNode | undefined;
  if (!listNode) {
    return null;
  }

  const stepsNode = buildStepsFromList(listNode);
  return stepsNode;
}

function transformFileTree(node: DirectiveNode) {
  const listNode = (node.children ?? []).find(
    (child) => child?.type === "list"
  ) as ListNode | undefined;
  if (!listNode) {
    return null;
  }

  const rawAttributes = node.attributes ?? {};
  const openAll = Boolean(rawAttributes.open || rawAttributes.expanded);
  return buildFileTree(listNode, openAll);
}

function transformAnnotation(node: DirectiveNode | TextDirectiveNode, inline = false) {
  const rawAttributes = node.attributes ?? {};
  const attributes: MdxAttribute[] = [];
  const labelAttr = buildAttribute("label", rawAttributes.label);
  if (labelAttr) {
    attributes.push(labelAttr);
  }
  const titleAttr = buildAttribute("title", rawAttributes.title);
  if (titleAttr) {
    attributes.push(titleAttr);
  }

  const element = inline
    ? ({
        type: "mdxJsxTextElement",
        name: "Annotation",
        attributes,
        children: node.children ?? [],
      } satisfies MdxTextElement)
    : ({
        type: "mdxJsxFlowElement",
        name: "Annotation",
        attributes,
        children: node.children ?? [],
      } satisfies MdxFlowElement);

  if (!inline) {
    attributes.push({
      type: "mdxJsxAttribute",
      name: "block",
      value: rawAttributes.block ?? "true",
    });
  }

  return element;
}

export default function remarkDocsComponents() {
  return (tree: any) => {
    visit(tree, "blockquote", (node: BlockquoteNode, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }
      const alertNode = extractAlert(node);
      if (!alertNode) {
        return;
      }
      parent.children[index] = alertNode;
    });

    visit(tree, "containerDirective", (node: DirectiveNode, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      if (DETAILS_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformDetails(node);
        return;
      }

      if (STEPS_NAMES.has(node.name ?? "")) {
        const stepsNode = transformSteps(node);
        if (stepsNode) {
          parent.children[index] = stepsNode;
        }
        return;
      }

      if (FILE_TREE_NAMES.has(node.name ?? "")) {
        const treeNode = transformFileTree(node);
        if (treeNode) {
          parent.children[index] = treeNode;
        }
        return;
      }

      if (node.name === "annotation") {
        parent.children[index] = transformAnnotation(node);
      }
    });

    visit(tree, "textDirective", (node: TextDirectiveNode, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }
      if (node.name !== "annotation") {
        return;
      }
      parent.children[index] = transformAnnotation(node, true);
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

      const openingLines = getParagraphLines(node);
      if (openingLines.length === 0) {
        continue;
      }

      const match = openingLines[0].match(
        /^:::\s*(details|steps|file-tree|filetree)\s*(.*)$/
      );
      if (!match) {
        continue;
      }

      const name = match[1];
      const meta = match[2]?.trim();
      let endIndex = -1;
      let closingInList = false;

      const inlineCloseIndex = openingLines.findIndex(
        (line, index) => index > 0 && /^:::\s*$/.test(line)
      );
      if (inlineCloseIndex !== -1 && DETAILS_NAMES.has(name)) {
        const bodyText = openingLines.slice(1, inlineCloseIndex).join("\n").trim();
        const bodyNodes = bodyText.length
          ? ([
              {
                type: "paragraph",
                children: [{ type: "text", value: bodyText }],
              },
            ] as ParagraphNode[])
          : [];
        const detailsNode = transformDetails({
          type: "containerDirective",
          name: "details",
          attributes: meta ? { summary: meta } : undefined,
          children: bodyNodes,
        });
        children.splice(i, 1, detailsNode);
        continue;
      }

      for (let j = i + 1; j < children.length; j += 1) {
        const child = children[j] as ParagraphNode;
        if (
          child?.type === "paragraph" &&
          /^:::\s*$/.test(getParagraphText(child))
        ) {
          endIndex = j;
          break;
        }
      }

      if (endIndex === -1 && (STEPS_NAMES.has(name) || FILE_TREE_NAMES.has(name))) {
        const listIndex = children.slice(i + 1).findIndex((child) => {
          if (child?.type !== "list") {
            return false;
          }
          if (STEPS_NAMES.has(name)) {
            return Boolean((child as ListNode).ordered);
          }
          return true;
        });

        if (listIndex !== -1) {
          const absoluteIndex = i + 1 + listIndex;
          const listNode = children[absoluteIndex] as ListNode;
          const removed = stripClosingMarkerFromList(listNode);
          if (removed) {
            endIndex = absoluteIndex;
            closingInList = true;
          }
        }
      }

      if (endIndex === -1) {
        continue;
      }

      const bodyNodes = children.slice(
        i + 1,
        closingInList ? endIndex + 1 : endIndex
      );

      if (DETAILS_NAMES.has(name)) {
        const detailsNode = transformDetails({
          type: "containerDirective",
          name: "details",
          attributes: meta ? { summary: meta } : undefined,
          children: bodyNodes,
        });
        children.splice(i, endIndex - i + 1, detailsNode);
        continue;
      }

      if (STEPS_NAMES.has(name)) {
        const listNode = bodyNodes.find(
          (child) => child?.type === "list" && child?.ordered
        ) as ListNode | undefined;
        if (!listNode) {
          continue;
        }
        const stepsNode = buildStepsFromList(listNode);
        const listIndex = bodyNodes.indexOf(listNode);
        const beforeNodes = bodyNodes.slice(0, listIndex);
        const afterNodes = bodyNodes.slice(listIndex + 1);
        const replacement = [...beforeNodes, stepsNode, ...afterNodes];
        children.splice(i, endIndex - i + 1, ...replacement);
        i += Math.max(0, replacement.length - 1);
        continue;
      }

      if (FILE_TREE_NAMES.has(name)) {
        const listNode = bodyNodes.find(
          (child) => child?.type === "list"
        ) as ListNode | undefined;
        if (!listNode) {
          continue;
        }
        const treeNode = buildFileTree(listNode, false);
        children.splice(i, endIndex - i + 1, treeNode);
      }
    }
  };
}
