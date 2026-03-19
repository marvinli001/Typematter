import type { ReactNode } from "react";
import { resolveMdxUiCopy, type MdxUiCopy } from "./MdxUiContext";

type VersionGateProps = {
  title?: string;
  since?: string;
  deprecated?: string | boolean;
  removedIn?: string;
  replacement?: string;
  uiCopy?: MdxUiCopy;
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
  copy,
  since,
  deprecated,
  removedIn,
  replacement,
}: Omit<VersionGateProps, "title" | "children"> & {
  copy: MdxUiCopy;
}) {
  const parts: string[] = [];

  if (since) {
    parts.push(copy.versionGate.availableSinceTemplate.replace("{version}", since));
  }
  if (deprecated) {
    parts.push(
      typeof deprecated === "string"
        ? copy.versionGate.deprecatedInTemplate.replace("{version}", deprecated)
        : copy.versionGate.deprecatedTemplate
    );
  }
  if (removedIn) {
    parts.push(copy.versionGate.removedInTemplate.replace("{version}", removedIn));
  }
  if (replacement) {
    parts.push(
      copy.versionGate.replacementTemplate.replace("{replacement}", replacement)
    );
  }

  return parts.join(" ");
}

export function VersionGate({
  title,
  since,
  deprecated,
  removedIn,
  replacement,
  uiCopy,
  children,
}: VersionGateProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const tone = resolveTone(deprecated, removedIn);
  const summary =
    children ?? buildSummary({ copy, since, deprecated, removedIn, replacement });

  return (
    <section className={`version-gate ${tone}`}>
      <div className="version-gate-head">
        <div className="version-gate-title">{title ?? copy.versionGate.title}</div>
        <div className="version-gate-tags">
          {since ? (
            <span className="version-tag">
              {copy.versionGate.sinceTag} {since}
            </span>
          ) : null}
          {deprecated ? (
            <span className="version-tag">
              {typeof deprecated === "string"
                ? `${copy.versionGate.deprecatedTag} ${deprecated}`
                : copy.versionGate.deprecatedTag}
            </span>
          ) : null}
          {removedIn ? (
            <span className="version-tag">
              {copy.versionGate.removedTag} {removedIn}
            </span>
          ) : null}
        </div>
      </div>
      {summary ? <div className="version-gate-body">{summary}</div> : null}
    </section>
  );
}
