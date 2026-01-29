import type { ReactNode } from "react";
import { Children } from "react";

type FileTreeProps = {
  children: ReactNode;
};

type FileTreeItemProps = {
  name: string;
  description?: string;
  kind?: "file" | "dir";
  open?: boolean | string;
  children?: ReactNode;
};

function toBoolean(value: FileTreeItemProps["open"]) {
  if (value === "" || value === true) {
    return true;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

export function FileTree({ children }: FileTreeProps) {
  return (
    <div className="file-tree">
      <ul className="file-tree-list">{children}</ul>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="file-tree-chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="file-tree-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7.5a2.5 2.5 0 012.5-2.5h4l2 2h7a2.5 2.5 0 012.5 2.5v7a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="file-tree-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h6l4 4v12a1.5 1.5 0 01-1.5 1.5h-8A1.5 1.5 0 016 19.5v-14A2 2 0 017 3.5z" />
      <path d="M13 3.5v4h4" />
    </svg>
  );
}

export function FileTreeItem({
  name,
  description,
  kind = "file",
  open,
  children,
}: FileTreeItemProps) {
  const isOpen = toBoolean(open);
  const hasChildren = Children.count(children) > 0;
  const isDir = kind === "dir";

  if (isDir) {
    return (
      <li className="file-tree-item dir">
        <details className="file-tree-folder" open={isOpen}>
          <summary className="file-tree-summary">
            <ChevronIcon />
            <FolderIcon />
            <span className="file-tree-name">{name}</span>
            {description ? (
              <span className="file-tree-description">{description}</span>
            ) : null}
          </summary>
          {hasChildren ? (
            <ul className="file-tree-children">{children}</ul>
          ) : null}
        </details>
      </li>
    );
  }

  return (
    <li className="file-tree-item file">
      <div className="file-tree-row">
        <span className="file-tree-indent" aria-hidden="true" />
        <FileIcon />
        <span className="file-tree-name">{name}</span>
        {description ? (
          <span className="file-tree-description">{description}</span>
        ) : null}
      </div>
    </li>
  );
}
