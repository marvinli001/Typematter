import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { Children, isValidElement } from "react";

export type LinkButtonVariant = "primary" | "secondary" | "minimal";

export type LinkButtonProps = {
  href: string;
  variant?: LinkButtonVariant;
  icon?: ReactNode | string;
  iconPlacement?: "start" | "end";
  children: ReactNode;
};

const ICONS: Record<string, ReactNode> = {
  arrow: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  "arrow-right": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  external: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 5h5v5M10 14l9-9M19 14v5H5V5h5" />
    </svg>
  ),
};

function resolveIcon(icon?: ReactNode | string) {
  if (!icon) {
    return null;
  }
  if (typeof icon === "string") {
    return ICONS[icon] ?? icon;
  }
  return icon;
}

function unwrapParagraph(children: ReactNode) {
  const nodes = Children.toArray(children);
  if (nodes.length === 1) {
    const only = nodes[0];
    if (isValidElement(only) && (only as ReactElement).type === "p") {
      return (only as ReactElement<{ children?: ReactNode }>).props.children;
    }
  }
  return children;
}

function isExternalLink(href: string) {
  return /^(https?:|mailto:|tel:|sms:)/.test(href) || href.startsWith("//");
}

export function LinkButton({
  href,
  variant = "primary",
  icon,
  iconPlacement = "start",
  children,
}: LinkButtonProps) {
  const resolvedIcon = resolveIcon(icon);
  const iconElement = resolvedIcon ? (
    <span className="link-button-icon" aria-hidden="true">
      {resolvedIcon}
    </span>
  ) : null;
  const label = unwrapParagraph(children);
  const content = (
    <>
      {iconElement && iconPlacement === "start" ? iconElement : null}
      <span className="link-button-label">{label}</span>
      {iconElement && iconPlacement === "end" ? iconElement : null}
    </>
  );
  const className = `link-button ${variant}`;

  if (isExternalLink(href)) {
    return (
      <a className={className} href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}
