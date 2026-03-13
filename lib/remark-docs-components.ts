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

type LeafDirectiveNode = {
  type: "leafDirective";
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

type LinkNode = {
  type: "link";
  url?: string;
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
const CARDS_NAMES = new Set(["cards", "card-grid", "card-group"]);
const BADGE_NAMES = new Set(["badge"]);
const ENDPOINT_NAMES = new Set(["endpoint"]);
const PARAM_TABLE_NAMES = new Set(["param-table", "paramtable"]);
const PARAM_FIELD_NAMES = new Set(["param-field", "paramfield"]);
const RESPONSE_SCHEMA_NAMES = new Set(["response-schema", "responseschema"]);
const SCHEMA_FIELD_NAMES = new Set(["schema-field", "schemafield"]);
const DO_DONT_NAMES = new Set(["do-dont", "dodont"]);
const DO_ITEM_NAMES = new Set(["do"]);
const DONT_ITEM_NAMES = new Set(["dont", "don't"]);
const VERSION_GATE_NAMES = new Set(["version-gate", "versiongate"]);
const COMMAND_GROUP_NAMES = new Set(["command-group", "commandgroup"]);
const COMMAND_ITEM_NAMES = new Set(["command"]);
const PREVIEW_FRAME_NAMES = new Set(["preview-frame", "previewframe"]);
const TIMELINE_NAMES = new Set(["timeline"]);
const RELEASE_ITEM_NAMES = new Set(["release-item", "releaseitem"]);

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

function extractTextFromNodes(nodes?: Array<any>): string {
  if (!nodes || nodes.length === 0) {
    return "";
  }
  return nodes
    .map((node) => {
      if (!node) {
        return "";
      }
      if (typeof node.value === "string") {
        return node.value;
      }
      if (typeof node === "string") {
        return node;
      }
      if (Array.isArray(node)) {
        return extractTextFromNodes(node);
      }
      if (typeof node === "object" && Array.isArray(node.children)) {
        return extractTextFromNodes(node.children);
      }
      return "";
    })
    .join("");
}

function buildAttribute(name: string, value?: string) {
  if (!value) {
    return null;
  }
  return { type: "mdxJsxAttribute", name, value } satisfies MdxAttribute;
}

function getInlineDirectiveLabel(children?: Array<any>) {
  const text = extractTextFromNodes(children).trim();
  return text || undefined;
}

function buildFlowElement(
  name: string,
  attributes: MdxAttribute[] = [],
  children: Array<any> = []
) {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes,
    children,
  } satisfies MdxFlowElement;
}

function buildTextElement(
  name: string,
  attributes: MdxAttribute[] = [],
  children: Array<any> = []
) {
  return {
    type: "mdxJsxTextElement",
    name,
    attributes,
    children,
  } satisfies MdxTextElement;
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

function splitTitleAndDescription(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { title: "", description: undefined as string | undefined };
  }
  const match = trimmed.match(/\s(?:-|–|—|:)\s/);
  if (!match || match.index === undefined) {
    return { title: trimmed, description: undefined as string | undefined };
  }
  const index = match.index;
  const title = trimmed.slice(0, index).trim();
  const description = trimmed.slice(index + match[0].length).trim();
  return {
    title: title || trimmed,
    description: description || undefined,
  };
}

function getFirstLink(node: ParagraphNode) {
  const link = (node.children ?? []).find(
    (child) => child?.type === "link"
  ) as LinkNode | undefined;
  if (!link) {
    return null;
  }
  const text = extractTextFromNodes(link.children);
  return {
    url: link.url,
    text,
  };
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

function buildFileTreeItems(
  listNode: ListNode,
  openAll: boolean
): MdxFlowElement[] {
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

function buildCardsFromList(listNode: ListNode) {
  const items = (listNode.children ?? []) as ListItemNode[];
  const cards = items
    .map((item) => {
      const itemChildren = item.children ?? [];
      const labelNode = itemChildren.find(
        (child) => child?.type === "paragraph"
      ) as ParagraphNode | undefined;
      if (!labelNode) {
        return null;
      }
      const rawLabel = extractTextFromNodes(labelNode.children);
      const { title: rawTitle, description } = splitTitleAndDescription(rawLabel);
      const link = getFirstLink(labelNode);
      const title = (link?.text || rawTitle || "Card").trim();
      const attributes: MdxAttribute[] = [
        { type: "mdxJsxAttribute", name: "title", value: title },
      ];

      if (link?.url) {
        attributes.push({
          type: "mdxJsxAttribute",
          name: "href",
          value: link.url,
        });
      }

      const extraChildren = itemChildren.filter((child) => child !== labelNode);
      if (extraChildren.length === 0 && description) {
        attributes.push({
          type: "mdxJsxAttribute",
          name: "description",
          value: description,
        });
      }

      return {
        type: "mdxJsxFlowElement",
        name: "Card",
        attributes,
        children: extraChildren.length > 0 ? extraChildren : [],
      } satisfies MdxFlowElement;
    })
    .filter(Boolean) as MdxFlowElement[];

  return cards;
}

function buildCardsFromLines(lines: string[]) {
  const cards: MdxFlowElement[] = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || !/^[-*+]\s+/.test(trimmed)) {
      return;
    }
    const content = trimmed.replace(/^[-*+]\s+/, "").trim();
    if (!content) {
      return;
    }

    const linkMatch = content.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const linkText = linkMatch?.[1]?.trim();
    const linkUrl = linkMatch?.[2]?.trim();
    const withoutLink = linkMatch
      ? content.replace(linkMatch[0], "").trim()
      : content;
    const cleaned = withoutLink.replace(/^[-–—:]\s*/, "").trim();
    const { title: rawTitle, description } = splitTitleAndDescription(
      linkText ? linkText : cleaned
    );
    const title = (linkText || rawTitle || "Card").trim();
    const finalDescription =
      linkText && cleaned.length > 0 ? cleaned : description;

    const attributes: MdxAttribute[] = [
      { type: "mdxJsxAttribute", name: "title", value: title },
    ];

    if (linkUrl) {
      attributes.push({
        type: "mdxJsxAttribute",
        name: "href",
        value: linkUrl,
      });
    }

    if (finalDescription) {
      attributes.push({
        type: "mdxJsxAttribute",
        name: "description",
        value: finalDescription,
      });
    }

    cards.push({
      type: "mdxJsxFlowElement",
      name: "Card",
      attributes,
      children: [],
    } satisfies MdxFlowElement);
  });

  return cards;
}

function buildCardsFromNodes(nodes: Array<any>) {
  const listNode = nodes.find(
    (child) => child?.type === "list"
  ) as ListNode | undefined;
  if (listNode) {
    return buildCardsFromList(listNode);
  }

  const lines = nodes.flatMap((child) =>
    child?.type === "paragraph" ? getParagraphLines(child) : []
  );
  return buildCardsFromLines(lines);
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

function transformCards(node: DirectiveNode) {
  const cards = buildCardsFromNodes(node.children ?? []);
  if (cards.length === 0) {
    return null;
  }

  const rawAttributes = node.attributes ?? {};
  const attributes: MdxAttribute[] = [];
  const columns = rawAttributes.columns || rawAttributes.cols;
  const mobileColumns =
    rawAttributes.mobileColumns || rawAttributes.mobile || rawAttributes.mobileCols;

  const columnsAttr = buildAttribute("columns", columns);
  if (columnsAttr) {
    attributes.push(columnsAttr);
  }
  const mobileAttr = buildAttribute("mobileColumns", mobileColumns);
  if (mobileAttr) {
    attributes.push(mobileAttr);
  }

  return {
    type: "mdxJsxFlowElement",
    name: "Cards",
    attributes,
    children: cards,
  } satisfies MdxFlowElement;
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

function transformBadge(node: TextDirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const attributes: MdxAttribute[] = [];
  const variantAttr = buildAttribute("variant", rawAttributes.variant ?? rawAttributes.type);
  const sizeAttr = buildAttribute("size", rawAttributes.size);
  const textAttr = buildAttribute("text", rawAttributes.text);

  if (variantAttr) {
    attributes.push(variantAttr);
  }
  if (sizeAttr) {
    attributes.push(sizeAttr);
  }
  if (textAttr) {
    attributes.push(textAttr);
  }

  return {
    type: "mdxJsxTextElement",
    name: "Badge",
    attributes,
    children: node.children ?? [],
  } satisfies MdxTextElement;
}

function transformParamField(node: LeafDirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const name = rawAttributes.name ?? getInlineDirectiveLabel(node.children);
  const description = rawAttributes.description ?? getInlineDirectiveLabel(node.children);
  const attributes = [
    buildAttribute("name", name),
    buildAttribute("type", rawAttributes.type),
    buildAttribute("required", rawAttributes.required),
    buildAttribute("defaultValue", rawAttributes.defaultValue ?? rawAttributes.default),
    buildAttribute("description", description),
  ].filter(Boolean) as MdxAttribute[];

  return buildFlowElement("ParamField", attributes);
}

function transformSchemaField(node: DirectiveNode | LeafDirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const label =
    node.type === "containerDirective"
      ? getDirectiveLabel(node.children ?? []).label
      : getInlineDirectiveLabel(node.children);
  const description =
    rawAttributes.description ??
    (node.type === "leafDirective" ? getInlineDirectiveLabel(node.children) : undefined);
  const attributes = [
    buildAttribute("name", rawAttributes.name ?? label),
    buildAttribute("type", rawAttributes.type),
    buildAttribute("required", rawAttributes.required),
    buildAttribute("description", description),
  ].filter(Boolean) as MdxAttribute[];

  const children =
    node.type === "containerDirective"
      ? transformChildNodes(getDirectiveLabel(node.children ?? []).children)
      : [];

  return buildFlowElement("SchemaField", attributes, children);
}

function transformParamTable(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
  ].filter(Boolean) as MdxAttribute[];

  const bodyChildren = children
    .map((child) => {
      if (child?.type === "leafDirective" && PARAM_FIELD_NAMES.has(child.name ?? "")) {
        return transformParamField(child as LeafDirectiveNode);
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("ParamTable", attributes, bodyChildren);
}

function transformResponseSchema(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("code", rawAttributes.code),
    buildAttribute("mediaType", rawAttributes.mediaType ?? rawAttributes.type),
  ].filter(Boolean) as MdxAttribute[];

  const bodyChildren = children
    .map((child) => {
      if (child?.type === "leafDirective" && SCHEMA_FIELD_NAMES.has(child.name ?? "")) {
        return transformSchemaField(child as LeafDirectiveNode);
      }
      if (child?.type === "containerDirective" && SCHEMA_FIELD_NAMES.has(child.name ?? "")) {
        return transformSchemaField(child as DirectiveNode);
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("ResponseSchema", attributes, bodyChildren);
}

function transformEndpoint(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("method", rawAttributes.method),
    buildAttribute("path", rawAttributes.path),
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("summary", rawAttributes.summary),
    buildAttribute("auth", rawAttributes.auth),
    buildAttribute("since", rawAttributes.since),
    buildAttribute("deprecated", rawAttributes.deprecated),
    buildAttribute("removedIn", rawAttributes.removedIn),
  ].filter(Boolean) as MdxAttribute[];

  const bodyChildren = children
    .map((child) => {
      if (child?.type === "containerDirective" && PARAM_TABLE_NAMES.has(child.name ?? "")) {
        return transformParamTable(child as DirectiveNode);
      }
      if (child?.type === "containerDirective" && RESPONSE_SCHEMA_NAMES.has(child.name ?? "")) {
        return transformResponseSchema(child as DirectiveNode);
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("Endpoint", attributes, bodyChildren);
}

function transformDoItem(node: DirectiveNode, componentName: "DoItem" | "DontItem") {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
  ].filter(Boolean) as MdxAttribute[];
  return buildFlowElement(componentName, attributes, transformChildNodes(children));
}

function transformDoDont(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("doTitle", rawAttributes.doTitle ?? rawAttributes.do),
    buildAttribute("dontTitle", rawAttributes.dontTitle ?? rawAttributes.dont),
  ].filter(Boolean) as MdxAttribute[];

  const bodyChildren = children
    .map((child) => {
      if (child?.type === "containerDirective" && DO_ITEM_NAMES.has(child.name ?? "")) {
        return transformDoItem(child as DirectiveNode, "DoItem");
      }
      if (child?.type === "containerDirective" && DONT_ITEM_NAMES.has(child.name ?? "")) {
        return transformDoItem(child as DirectiveNode, "DontItem");
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("DoDont", attributes, bodyChildren);
}

function transformVersionGate(node: DirectiveNode | LeafDirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const label =
    node.type === "containerDirective"
      ? getDirectiveLabel(node.children ?? []).label
      : getInlineDirectiveLabel(node.children);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("since", rawAttributes.since),
    buildAttribute("deprecated", rawAttributes.deprecated),
    buildAttribute("removedIn", rawAttributes.removedIn),
    buildAttribute("replacement", rawAttributes.replacement),
  ].filter(Boolean) as MdxAttribute[];

  const children =
    node.type === "containerDirective"
      ? transformChildNodes(getDirectiveLabel(node.children ?? []).children)
      : [];

  return buildFlowElement("VersionGate", attributes, children);
}

function transformCommandItem(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("label", rawAttributes.label ?? label),
    buildAttribute("platform", rawAttributes.platform),
    buildAttribute("description", rawAttributes.description),
  ].filter(Boolean) as MdxAttribute[];

  return buildFlowElement("Command", attributes, transformChildNodes(children));
}

function transformCommandGroup(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("title", rawAttributes.title ?? label),
  ].filter(Boolean) as MdxAttribute[];

  const bodyChildren = children
    .map((child) => {
      if (child?.type === "containerDirective" && COMMAND_ITEM_NAMES.has(child.name ?? "")) {
        return transformCommandItem(child as DirectiveNode);
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("CommandGroup", attributes, bodyChildren);
}

function transformPreviewFrame(node: LeafDirectiveNode | DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const label =
    node.type === "containerDirective"
      ? getDirectiveLabel(node.children ?? []).label
      : getInlineDirectiveLabel(node.children);
  const caption =
    rawAttributes.caption ??
    (node.type === "containerDirective"
      ? extractTextFromNodes(getDirectiveLabel(node.children ?? []).children).trim() || undefined
      : undefined);
  const attributes = [
    buildAttribute("src", rawAttributes.src),
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("caption", caption),
    buildAttribute("type", rawAttributes.type),
    buildAttribute("ratio", rawAttributes.ratio),
    buildAttribute("height", rawAttributes.height),
    buildAttribute("allow", rawAttributes.allow),
    buildAttribute("poster", rawAttributes.poster),
  ].filter(Boolean) as MdxAttribute[];

  return buildFlowElement("PreviewFrame", attributes);
}

function transformReleaseItem(node: DirectiveNode) {
  const rawAttributes = node.attributes ?? {};
  const { label, children } = getDirectiveLabel(node.children ?? []);
  const attributes = [
    buildAttribute("version", rawAttributes.version),
    buildAttribute("title", rawAttributes.title ?? label),
    buildAttribute("date", rawAttributes.date),
    buildAttribute("status", rawAttributes.status),
  ].filter(Boolean) as MdxAttribute[];

  return buildFlowElement("ReleaseItem", attributes, transformChildNodes(children));
}

function transformTimeline(node: DirectiveNode) {
  const children = node.children ?? [];
  const bodyChildren = children
    .map((child) => {
      if (child?.type === "containerDirective" && RELEASE_ITEM_NAMES.has(child.name ?? "")) {
        return transformReleaseItem(child as DirectiveNode);
      }
      return transformChildNode(child);
    })
    .flat();

  return buildFlowElement("Timeline", [], bodyChildren);
}

function transformChildNode(node: any): Array<any> {
  if (!node) {
    return [];
  }

  if (node.type === "containerDirective") {
    if (ENDPOINT_NAMES.has(node.name ?? "")) {
      return [transformEndpoint(node as DirectiveNode)];
    }
    if (PARAM_TABLE_NAMES.has(node.name ?? "")) {
      return [transformParamTable(node as DirectiveNode)];
    }
    if (RESPONSE_SCHEMA_NAMES.has(node.name ?? "")) {
      return [transformResponseSchema(node as DirectiveNode)];
    }
    if (SCHEMA_FIELD_NAMES.has(node.name ?? "")) {
      return [transformSchemaField(node as DirectiveNode)];
    }
    if (DO_DONT_NAMES.has(node.name ?? "")) {
      return [transformDoDont(node as DirectiveNode)];
    }
    if (DO_ITEM_NAMES.has(node.name ?? "")) {
      return [transformDoItem(node as DirectiveNode, "DoItem")];
    }
    if (DONT_ITEM_NAMES.has(node.name ?? "")) {
      return [transformDoItem(node as DirectiveNode, "DontItem")];
    }
    if (VERSION_GATE_NAMES.has(node.name ?? "")) {
      return [transformVersionGate(node as DirectiveNode)];
    }
    if (COMMAND_GROUP_NAMES.has(node.name ?? "")) {
      return [transformCommandGroup(node as DirectiveNode)];
    }
    if (COMMAND_ITEM_NAMES.has(node.name ?? "")) {
      return [transformCommandItem(node as DirectiveNode)];
    }
    if (PREVIEW_FRAME_NAMES.has(node.name ?? "")) {
      return [transformPreviewFrame(node as DirectiveNode)];
    }
    if (TIMELINE_NAMES.has(node.name ?? "")) {
      return [transformTimeline(node as DirectiveNode)];
    }
    if (RELEASE_ITEM_NAMES.has(node.name ?? "")) {
      return [transformReleaseItem(node as DirectiveNode)];
    }
  }

  if (node.type === "leafDirective") {
    if (PARAM_FIELD_NAMES.has(node.name ?? "")) {
      return [transformParamField(node as LeafDirectiveNode)];
    }
    if (SCHEMA_FIELD_NAMES.has(node.name ?? "")) {
      return [transformSchemaField(node as LeafDirectiveNode)];
    }
    if (VERSION_GATE_NAMES.has(node.name ?? "")) {
      return [transformVersionGate(node as LeafDirectiveNode)];
    }
    if (PREVIEW_FRAME_NAMES.has(node.name ?? "")) {
      return [transformPreviewFrame(node as LeafDirectiveNode)];
    }
  }

  return [node];
}

function transformChildNodes(nodes: Array<any>) {
  return nodes.map((child) => transformChildNode(child)).flat();
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

      if (ENDPOINT_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformEndpoint(node);
        return;
      }

      if (PARAM_TABLE_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformParamTable(node);
        return;
      }

      if (RESPONSE_SCHEMA_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformResponseSchema(node);
        return;
      }

      if (SCHEMA_FIELD_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformSchemaField(node);
        return;
      }

      if (DO_DONT_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformDoDont(node);
        return;
      }

      if (VERSION_GATE_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformVersionGate(node);
        return;
      }

      if (COMMAND_GROUP_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformCommandGroup(node);
        return;
      }

      if (PREVIEW_FRAME_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformPreviewFrame(node);
        return;
      }

      if (TIMELINE_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformTimeline(node);
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

      if (CARDS_NAMES.has(node.name ?? "")) {
        const cardsNode = transformCards(node);
        if (cardsNode) {
          parent.children[index] = cardsNode;
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
        if (BADGE_NAMES.has(node.name ?? "")) {
          parent.children[index] = transformBadge(node);
        }
        return;
      }
      parent.children[index] = transformAnnotation(node, true);
    });

    visit(tree, "leafDirective", (node: LeafDirectiveNode, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      if (PARAM_FIELD_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformParamField(node);
        return;
      }

      if (SCHEMA_FIELD_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformSchemaField(node);
        return;
      }

      if (VERSION_GATE_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformVersionGate(node);
        return;
      }

      if (PREVIEW_FRAME_NAMES.has(node.name ?? "")) {
        parent.children[index] = transformPreviewFrame(node);
      }
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
        /^:::\s*(details|steps|file-tree|filetree|cards|card-grid|card-group)\s*(.*)$/
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

      const isListBased =
        STEPS_NAMES.has(name) ||
        FILE_TREE_NAMES.has(name) ||
        CARDS_NAMES.has(name);

      if (isListBased) {
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
        continue;
      }

      if (CARDS_NAMES.has(name)) {
        const cardsNode = transformCards({
          type: "containerDirective",
          name: "cards",
          children: bodyNodes,
        });
        if (!cardsNode) {
          continue;
        }
        children.splice(i, endIndex - i + 1, cardsNode);
      }
    }
  };
}
