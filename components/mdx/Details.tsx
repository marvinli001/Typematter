import type { ReactNode } from "react";

type DetailsProps = {
  summary?: string;
  open?: boolean | string;
  children: ReactNode;
};

function toBoolean(value: DetailsProps["open"]) {
  if (value === "" || value === true) {
    return true;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

export function Details({ summary, open, children }: DetailsProps) {
  const isOpen = toBoolean(open);

  return (
    <details className="details" open={isOpen}>
      <summary className="details-summary">
        <span className="details-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </span>
        <span>{summary ?? "Details"}</span>
      </summary>
      <div className="details-body">{children}</div>
    </details>
  );
}
