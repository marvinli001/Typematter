import type { ReactNode } from "react";

type AnnotationProps = {
  label?: string;
  title?: string;
  block?: boolean | string;
  children: ReactNode;
};

function toBoolean(value: AnnotationProps["block"]) {
  if (value === "" || value === true) {
    return true;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

export function Annotation({ label = "i", title, block, children }: AnnotationProps) {
  const isBlock = toBoolean(block);

  if (!isBlock) {
    return (
      <span className="annotation inline" tabIndex={0}>
        <span
          className="annotation-trigger"
          aria-label={title ?? "Annotation"}
        >
          <span className="annotation-badge" aria-hidden="true">
            {label}
          </span>
        </span>
        <span className="annotation-panel" role="note">
          {title ? <span className="annotation-title">{title}</span> : null}
          <span className="annotation-body">{children}</span>
        </span>
      </span>
    );
  }

  return (
    <details className="annotation block">
      <summary className="annotation-trigger" aria-label={title ?? "Annotation"}>
        <span className="annotation-badge" aria-hidden="true">
          {label}
        </span>
      </summary>
      <div className="annotation-panel" role="note">
        {title ? <div className="annotation-title">{title}</div> : null}
        <div className="annotation-body">{children}</div>
      </div>
    </details>
  );
}
