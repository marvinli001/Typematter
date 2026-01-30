import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

const CARD_ICONS: Record<string, ReactNode> = {
  spark: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l2.2 4.5L19 9l-4 3.2L16 17l-4-2.3L8 17l1-4.8L5 9l4.8-1.5L12 3z" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  "arrow-right": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
};

const MAX_COLUMNS = 4;

function clampColumns(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return MAX_COLUMNS;
  }
  return Math.min(MAX_COLUMNS, Math.max(1, value));
}

function parseColumns(value: number | string | undefined, fallback: number) {
  if (typeof value === "number") {
    return clampColumns(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return clampColumns(parsed);
    }
  }
  return clampColumns(fallback);
}

function isExternalLink(href?: string) {
  if (!href) {
    return false;
  }
  return /^(https?:|mailto:|tel:|sms:)/.test(href) || href.startsWith("//");
}

function resolveCardIcon(icon?: ReactNode) {
  if (!icon) {
    return null;
  }
  if (typeof icon === "string") {
    return CARD_ICONS[icon] ?? icon;
  }
  return icon;
}

type CardsProps = {
  children: ReactNode;
  columns?: number | string;
  mobileColumns?: number | string;
};

type CardProps = {
  title: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  image?: string;
  imageAlt?: string;
  iconPlacement?: "start" | "top";
  children?: ReactNode;
};

function resolveCardBody(description: string | undefined, children: ReactNode) {
  if (children) {
    return children;
  }
  if (!description) {
    return null;
  }
  return <p className="card-description">{description}</p>;
}

export function Cards({ children, columns = 4, mobileColumns = 2 }: CardsProps) {
  const style = {
    "--cards-columns": parseColumns(columns, 4),
    "--cards-columns-mobile": parseColumns(mobileColumns, 2),
  } as CSSProperties;

  return (
    <ul className="cards-grid" style={style}>
      {children}
    </ul>
  );
}

export function Card({
  title,
  description,
  href,
  icon,
  image,
  imageAlt,
  iconPlacement = "top",
  children,
}: CardProps) {
  const body = resolveCardBody(description, children);
  const hasMedia = Boolean(image || icon);
  const resolvedIcon = resolveCardIcon(icon);
  const showIcon = Boolean(resolvedIcon) && !image;

  const content = (
    <>
      {image ? (
        <div className="card-media">
          <img src={image} alt={imageAlt ?? title} loading="lazy" />
        </div>
      ) : null}
      {showIcon && iconPlacement === "top" ? (
        <span className="card-icon" aria-hidden="true">
          {resolvedIcon}
        </span>
      ) : null}
      <div className={`card-content${hasMedia ? " has-media" : ""}`}>
        {showIcon && iconPlacement === "start" ? (
          <div className="card-header">
            <span className="card-icon" aria-hidden="true">
              {resolvedIcon}
            </span>
            <div className="card-title">{title}</div>
          </div>
        ) : (
          <div className="card-title">{title}</div>
        )}
        {body ? <div className="card-body">{body}</div> : null}
      </div>
    </>
  );

  if (href) {
    if (isExternalLink(href)) {
      return (
        <li className="card-item">
          <a
            className="card-shell is-link"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {content}
          </a>
        </li>
      );
    }

    return (
      <li className="card-item">
        <Link className="card-shell is-link" href={href}>
          {content}
        </Link>
      </li>
    );
  }

  return (
    <li className="card-item">
      <div className="card-shell">{content}</div>
    </li>
  );
}
