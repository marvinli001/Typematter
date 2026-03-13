import type { ReactNode } from "react";

type TimelineProps = {
  children: ReactNode;
};

type ReleaseItemProps = {
  version: string;
  title?: string;
  date?: string;
  status?: string;
  children?: ReactNode;
};

export function Timeline({ children }: TimelineProps) {
  return <div className="timeline">{children}</div>;
}

export function ReleaseItem({
  version,
  title,
  date,
  status,
  children,
}: ReleaseItemProps) {
  return (
    <article className="release-item">
      <div className="release-marker" aria-hidden="true" />
      <div className="release-card">
        <div className="release-head">
          <div className="release-heading">
            <span className="release-version">{version}</span>
            {title ? <span className="release-title">{title}</span> : null}
          </div>
          <div className="release-meta">
            {date ? <span className="release-date">{date}</span> : null}
            {status ? <span className="release-status">{status}</span> : null}
          </div>
        </div>
        {children ? <div className="release-body">{children}</div> : null}
      </div>
    </article>
  );
}
