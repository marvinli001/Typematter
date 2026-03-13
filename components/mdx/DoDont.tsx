import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";

type DoDontProps = {
  title?: string;
  doTitle?: string;
  dontTitle?: string;
  children: ReactNode;
};

type CompareItemProps = {
  title?: string;
  children: ReactNode;
};

type ParsedCompareItem = {
  title?: string;
  children: ReactNode;
};

export function DoItem({ children }: CompareItemProps) {
  return <>{children}</>;
}

export function DontItem({ children }: CompareItemProps) {
  return <>{children}</>;
}

function parseItems(
  nodes: ReactNode,
  match: (element: ReactElement<CompareItemProps>) => boolean
) {
  return Children.toArray(nodes)
    .filter(isValidElement)
    .map((child) => child as ReactElement<CompareItemProps>)
    .filter((child) => match(child))
    .map((child) => ({
      title: child.props.title,
      children: child.props.children,
    })) as ParsedCompareItem[];
}

function renderColumn(
  tone: "do" | "dont",
  label: string,
  items: ParsedCompareItem[]
) {
  return (
    <section className={`do-dont-column ${tone}`}>
      <header className="do-dont-column-head">
        <span className="do-dont-icon" aria-hidden="true">
          {tone === "do" ? "✓" : "×"}
        </span>
        <span>{label}</span>
      </header>
      <div className="do-dont-list">
        {items.map((item, index) => (
          <article className="do-dont-item" key={`${tone}-${index}`}>
            {item.title ? <div className="do-dont-item-title">{item.title}</div> : null}
            <div className="do-dont-item-body">{item.children}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function DoDont({
  title,
  doTitle = "Do",
  dontTitle = "Don't",
  children,
}: DoDontProps) {
  const goodItems = parseItems(children, (child) => child.type === DoItem);
  const badItems = parseItems(children, (child) => child.type === DontItem);

  return (
    <div className="do-dont">
      {title ? <div className="do-dont-title">{title}</div> : null}
      <div className="do-dont-grid">
        {renderColumn("do", doTitle, goodItems)}
        {renderColumn("dont", dontTitle, badItems)}
      </div>
    </div>
  );
}
