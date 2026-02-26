import type { ReactNode } from "react";

type DiffBlockProps = {
  beforeLabel?: string;
  afterLabel?: string;
  children: ReactNode;
};

type DiffColumnProps = {
  highlight?: boolean;
  children: ReactNode;
};

export function DiffBlock({
  beforeLabel,
  afterLabel,
  children,
}: DiffBlockProps) {
  const showHeader = Boolean(beforeLabel || afterLabel);

  return (
    <div className="diff">
      {showHeader ? (
        <div className="diff-header">
          {beforeLabel ? <span className="pill">{beforeLabel}</span> : null}
          {afterLabel ? <span className="pill muted">{afterLabel}</span> : null}
        </div>
      ) : null}
      <div className="diff-body">{children}</div>
    </div>
  );
}

export function DiffColumn({ highlight, children }: DiffColumnProps) {
  return <div className={`diff-col${highlight ? " highlight" : ""}`}>{children}</div>;
}
