import type { ReactNode } from "react";

type VersionGateProps = {
  title?: string;
  since?: string;
  deprecated?: string | boolean;
  removedIn?: string;
  replacement?: string;
  children?: ReactNode;
};

function resolveTone(
  deprecated: string | boolean | undefined,
  removedIn: string | undefined
) {
  if (removedIn) {
    return "removed";
  }
  if (deprecated) {
    return "deprecated";
  }
  return "since";
}

function buildSummary({
  since,
  deprecated,
  removedIn,
  replacement,
}: Omit<VersionGateProps, "title" | "children">) {
  const parts: string[] = [];

  if (since) {
    parts.push(`Available since ${since}.`);
  }
  if (deprecated) {
    parts.push(
      typeof deprecated === "string" ? `Deprecated in ${deprecated}.` : "Deprecated."
    );
  }
  if (removedIn) {
    parts.push(`Removed in ${removedIn}.`);
  }
  if (replacement) {
    parts.push(`Use ${replacement} instead.`);
  }

  return parts.join(" ");
}

export function VersionGate({
  title,
  since,
  deprecated,
  removedIn,
  replacement,
  children,
}: VersionGateProps) {
  const tone = resolveTone(deprecated, removedIn);
  const summary = children ?? buildSummary({ since, deprecated, removedIn, replacement });

  return (
    <section className={`version-gate ${tone}`}>
      <div className="version-gate-head">
        <div className="version-gate-title">{title ?? "Version policy"}</div>
        <div className="version-gate-tags">
          {since ? <span className="version-tag">Since {since}</span> : null}
          {deprecated ? (
            <span className="version-tag">
              {typeof deprecated === "string" ? `Deprecated ${deprecated}` : "Deprecated"}
            </span>
          ) : null}
          {removedIn ? <span className="version-tag">Removed {removedIn}</span> : null}
        </div>
      </div>
      {summary ? <div className="version-gate-body">{summary}</div> : null}
    </section>
  );
}
