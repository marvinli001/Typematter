import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement, useId } from "react";

type CodeTabProps = {
  label: string;
  subtitle?: string;
  children: ReactNode;
};

type CodeTabsProps = {
  children: ReactNode;
};

type ParsedTab = {
  id: string;
  label: string;
  subtitle?: string;
  content: ReactNode;
};

export function CodeTab({ children }: CodeTabProps) {
  return <>{children}</>;
}

function normalizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function CodeTabs({ children }: CodeTabsProps) {
  const baseId = normalizeId(useId());
  const name = `code-group-${baseId}`;
  const tabs = Children.toArray(children)
    .filter(isValidElement)
    .map((child, index) => {
      const props = (child as ReactElement<CodeTabProps>).props;
      const label = props.label || `Tab ${index + 1}`;
      const subtitle = props.subtitle;
      return {
        id: `${name}-${index}`,
        label,
        subtitle,
        content: props.children,
      } satisfies ParsedTab;
    });

  if (tabs.length === 0) {
    return null;
  }

  const styleRules = tabs
    .map((tab) => {
      return `
#${tab.id}:checked ~ .code-group-tabs label[for="${tab.id}"] {
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-sm);
}
#${tab.id}:checked ~ .code-group-panels [data-tab="${tab.id}"] {
  display: block;
}
`;
    })
    .join("");

  return (
    <div className="code-group">
      <style>{styleRules}</style>
      {tabs.map((tab, index) => (
        <input
          className="code-group-input"
          type="radio"
          name={name}
          id={tab.id}
          defaultChecked={index === 0}
          key={`${tab.id}-input`}
        />
      ))}
      <div className="code-group-tabs" role="tablist" aria-label="Code tabs">
        {tabs.map((tab) => (
          <label
            className="code-group-tab"
            htmlFor={tab.id}
            role="tab"
            aria-controls={`${tab.id}-panel`}
            key={`${tab.id}-label`}
          >
            {tab.label}
          </label>
        ))}
      </div>
      <div className="code-group-panels">
        {tabs.map((tab) => (
          <div
            className="code-group-panel"
            id={`${tab.id}-panel`}
            data-tab={tab.id}
            role="tabpanel"
            key={`${tab.id}-panel`}
          >
            {tab.subtitle ? (
              <div className="code-group-subtitle">{tab.subtitle}</div>
            ) : null}
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
