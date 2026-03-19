import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement, useId } from "react";
import { resolveMdxUiCopy, type MdxUiCopy } from "./MdxUiContext";
import CopyButton from "./CopyButton";

type CommandGroupProps = {
  title?: string;
  uiCopy?: MdxUiCopy;
  children: ReactNode;
};

type CommandProps = {
  label: string;
  platform?: string;
  description?: string;
  children: ReactNode;
};

type ParsedCommand = {
  id: string;
  label: string;
  platform?: string;
  description?: string;
  children: ReactNode;
  copyText: string;
};

export function Command({ children }: CommandProps) {
  return <>{children}</>;
}

function normalizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
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

function renderCommandBody(content: ReactNode, copyText: string) {
  if (isValidElement(content) && content.type === "pre") {
    return content;
  }

  return (
    <pre className="command-pre">
      <code>{copyText}</code>
    </pre>
  );
}

export function CommandGroup({ title, uiCopy, children }: CommandGroupProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const baseId = normalizeId(useId());
  const tabs = Children.toArray(children)
    .filter(isValidElement)
    .map((child, index) => {
      const props = (child as ReactElement<CommandProps>).props;
      const id = `command-group-${baseId}-${index}`;
      return {
        id,
        label: props.label || `Command ${index + 1}`,
        platform: props.platform,
        description: props.description,
        children: props.children,
        copyText: extractText(props.children).replace(/\s+$/, ""),
      } satisfies ParsedCommand;
    });

  if (tabs.length === 0) {
    return null;
  }

  const styleRules = tabs
    .map(
      (tab) => `
#${tab.id}:checked ~ .command-group-tabs label[for="${tab.id}"] {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
#${tab.id}:checked ~ .command-group-panels [data-tab="${tab.id}"] {
  display: block;
}
`
    )
    .join("");

  return (
    <div className="command-group">
      <style>{styleRules}</style>
      {title ? <div className="command-group-title">{title}</div> : null}
      {tabs.map((tab, index) => (
        <input
          className="command-group-input"
          type="radio"
          name={`command-group-${baseId}`}
          id={tab.id}
          defaultChecked={index === 0}
          key={`${tab.id}-input`}
        />
      ))}
      <div
        className="command-group-tabs"
        role="tablist"
        aria-label={title ?? copy.commandGroup.label}
      >
        {tabs.map((tab) => (
          <label className="command-group-tab" htmlFor={tab.id} key={`${tab.id}-label`}>
            {tab.label}
          </label>
        ))}
      </div>
      <div className="command-group-panels">
        {tabs.map((tab) => (
          <div className="command-group-panel" data-tab={tab.id} key={`${tab.id}-panel`}>
            <div className="command-panel-head">
              <div className="command-panel-meta">
                {tab.platform ? <span className="command-platform">{tab.platform}</span> : null}
                {tab.description ? (
                  <span className="command-description">{tab.description}</span>
                ) : null}
              </div>
              <CopyButton text={tab.copyText} uiCopy={copy} />
            </div>
            {renderCommandBody(tab.children, tab.copyText)}
          </div>
        ))}
      </div>
    </div>
  );
}
