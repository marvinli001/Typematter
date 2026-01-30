import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, isValidElement } from "react";

type FeatureMatrixProps = {
  children: ReactNode;
};

type StatusKind = "yes" | "no" | "soon";

const YES_TOKENS = new Set([
  "yes",
  "true",
  "supported",
  "available",
  "y",
  "1",
  "\u2713",
  "\u2714",
  "\u2705",
  "支持",
  "可用",
]);

const NO_TOKENS = new Set([
  "no",
  "false",
  "unsupported",
  "x",
  "0",
  "\u2715",
  "\u2716",
  "\u2717",
  "\u00d7",
  "\u274c",
  "不支持",
  "不可用",
]);

const SOON_TOKENS = new Set([
  "soon",
  "coming soon",
  "beta",
  "preview",
  "planned",
  "tbd",
  "即将上线",
  "即将",
  "规划中",
  "开发中",
]);

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
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

function detectStatus(text: string): { kind: StatusKind; label: string } | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  if (YES_TOKENS.has(normalized)) {
    return { kind: "yes", label: "Supported" };
  }

  if (NO_TOKENS.has(normalized)) {
    return { kind: "no", label: "Not supported" };
  }

  if (SOON_TOKENS.has(normalized)) {
    return { kind: "soon", label: text.trim() };
  }

  return null;
}

function mergeClassName(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

function StatusIcon({ kind, label }: { kind: StatusKind; label: string }) {
  if (kind === "soon") {
    return <span className="matrix-status soon">{label}</span>;
  }

  return (
    <span
      className={`matrix-status ${kind}`}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {kind === "yes" ? (
          <path d="M6 12l4 4 8-8" />
        ) : (
          <path d="M7 7l10 10M17 7l-10 10" />
        )}
      </svg>
    </span>
  );
}

function transformNode(node: ReactNode): ReactNode {
  if (!isValidElement(node)) {
    return node;
  }

  const element = node as ReactElement<{ className?: string; children?: ReactNode }>;
  const elementType = element.type;
  const children = element.props?.children;

  if (elementType === "td" || elementType === "th") {
    const text = extractText(children);
    const status = detectStatus(text);
    if (status) {
      return cloneElement(element, {
        className: mergeClassName(element.props.className, "matrix-cell", "matrix-status-cell"),
        children: <StatusIcon kind={status.kind} label={status.label} />,
      });
    }

    return cloneElement(element, {
      className: mergeClassName(element.props.className, "matrix-cell"),
      children,
    });
  }

  if (children) {
    const nextChildren = Children.map(children, transformNode);
    return cloneElement(element, { children: nextChildren });
  }

  return element;
}

export function FeatureMatrix({ children }: FeatureMatrixProps) {
  const content = Children.map(children, transformNode);
  return <div className="feature-matrix">{content}</div>;
}


