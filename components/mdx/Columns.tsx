import type { ReactNode } from "react";

type ColumnsProps = {
  children: ReactNode;
  columns?: number;
};

type ColumnProps = {
  title?: string;
  children: ReactNode;
};

export function Columns({ children, columns = 2 }: ColumnsProps) {
  return (
    <div className="columns" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

export function Column({ title, children }: ColumnProps) {
  return (
    <div className="column">
      {title ? <div className="column-title">{title}</div> : null}
      <div className="column-body">{children}</div>
    </div>
  );
}
