import type { ReactElement, ReactNode } from "react";
import { resolveMdxUiCopy, type MdxUiCopy } from "./MdxUiContext";
import CopyButton from "./CopyButton";

type CodeBlockProps = {
  children: ReactNode;
  uiCopy?: MdxUiCopy;
};

function getCodeChild(children: ReactNode) {
  const nodes = Array.isArray(children) ? children : [children];
  return nodes.find((child) => {
    if (!child || typeof child !== "object") {
      return false;
    }

    const element = child as ReactElement<{ className?: string }>;
    return element.type === "code";
  }) as ReactElement<{ className?: string; children?: ReactNode }> | undefined;
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (typeof node === "object") {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return extractText(element.props?.children);
  }
  return "";
}

export function CodeBlock({ children, uiCopy }: CodeBlockProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const codeElement = getCodeChild(children);
  const className = codeElement?.props?.className ?? "";
  const language =
    className
      .split(" ")
      .find((value) => value.startsWith("language-"))
      ?.replace("language-", "") ?? "";
  const rawCode = codeElement?.props?.children;
  const code = extractText(rawCode).trim();
  const isTerminal = ["bash", "sh", "shell", "zsh", "powershell", "pwsh"].includes(
    language
  );
  const tabOrder = ["pnpm", "npm", "yarn", "bun"];
  const tabs = isTerminal
    ? tabOrder.filter((tool) =>
        new RegExp(`(^|\\n)\\s*${tool}\\b`, "i").test(code)
      )
    : [];

  return (
    <div className={`code-block${isTerminal ? " terminal" : ""}`}>
      {tabs.length > 0 ? (
        <div className="code-tabs">
          {tabs.map((tab, index) => (
            <span
              className={`code-tab${index === 0 ? " active" : ""}`}
              key={tab}
            >
              {tab}
            </span>
          ))}
        </div>
      ) : null}
      <div className="code-header">
        <span className="code-title">
          {isTerminal ? <span className="terminal-mark">{"\u003e_"}</span> : null}
          <span>
            {isTerminal ? copy.codeBlock.terminal : language || copy.codeBlock.code}
          </span>
        </span>
        <div className="code-actions">
          <CopyButton text={code} uiCopy={copy} />
        </div>
      </div>
      <pre className="code-content">{children}</pre>
    </div>
  );
}
