import type { ReactNode } from "react";

export type CalloutVariant =
  | "note"
  | "tip"
  | "warning"
  | "deprecated"
  | "info";

type CalloutProps = {
  type?: CalloutVariant;
  title?: string;
  children: ReactNode;
};

const DEFAULT_TITLES: Record<CalloutVariant, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  deprecated: "Deprecated",
  info: "Info",
};

const CALLOUT_ICONS: Record<CalloutVariant, ReactNode> = {
  note: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6m-6 0v-1.2c0-.6-.3-1.1-.7-1.5-1.6-1.3-2.6-3.2-2.6-5.3a6.3 6.3 0 1112.6 0c0 2.1-1 4-2.6 5.3-.5.4-.7.9-.7 1.5V18m-4 3h2" />
    </svg>
  ),
  tip: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 18h6m-6 0v-1.2c0-.6-.3-1.1-.7-1.5-1.6-1.3-2.6-3.2-2.6-5.3a6.3 6.3 0 1112.6 0c0 2.1-1 4-2.6 5.3-.5.4-.7.9-.7 1.5V18m-4 3h2" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 7.5v.2M12 11v5m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.3 3.6L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.6a2 2 0 00-3.4 0z" />
    </svg>
  ),
  deprecated: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M4 4l16 16M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  ),
};

export function Callout({ type = "note", title, children }: CalloutProps) {
  return (
    <div className={`callout ${type}`}>
      <div className="callout-icon">{CALLOUT_ICONS[type]}</div>
      <div className="callout-content">
        {title ? <div className="callout-title">{title}</div> : null}
        <div className="callout-body">{children}</div>
      </div>
    </div>
  );
}

export function Note({ title, children }: Omit<CalloutProps, "type">) {
  return (
    <Callout type="note" title={title ?? DEFAULT_TITLES.note}>
      {children}
    </Callout>
  );
}

export function Tip({ title, children }: Omit<CalloutProps, "type">) {
  return (
    <Callout type="tip" title={title ?? DEFAULT_TITLES.tip}>
      {children}
    </Callout>
  );
}

export function Info({ title, children }: Omit<CalloutProps, "type">) {
  return (
    <Callout type="info" title={title ?? DEFAULT_TITLES.info}>
      {children}
    </Callout>
  );
}

export function Warning({ title, children }: Omit<CalloutProps, "type">) {
  return (
    <Callout type="warning" title={title ?? DEFAULT_TITLES.warning}>
      {children}
    </Callout>
  );
}

export function Deprecated({ title, children }: Omit<CalloutProps, "type">) {
  return (
    <Callout type="deprecated" title={title ?? DEFAULT_TITLES.deprecated}>
      {children}
    </Callout>
  );
}
