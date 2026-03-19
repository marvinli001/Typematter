import type { ReactNode } from "react";
import { resolveMdxUiCopy, type MdxUiCopy } from "./MdxUiContext";

type ApiDocsUiProps = {
  uiCopy?: MdxUiCopy;
};

type EndpointProps = ApiDocsUiProps & {
  method: string;
  path: string;
  title?: string;
  summary?: string;
  auth?: string;
  since?: string;
  deprecated?: string | boolean;
  removedIn?: string;
  children?: ReactNode;
};

type ParamTableProps = ApiDocsUiProps & {
  title?: string;
  children: ReactNode;
};

type ParamFieldProps = ApiDocsUiProps & {
  name: string;
  type: string;
  required?: boolean | string;
  defaultValue?: string;
  description?: string;
  children?: ReactNode;
};

type ResponseSchemaProps = ApiDocsUiProps & {
  title?: string;
  code?: string | number;
  mediaType?: string;
  children: ReactNode;
};

type SchemaFieldProps = ApiDocsUiProps & {
  name: string;
  type: string;
  required?: boolean | string;
  description?: string;
  children?: ReactNode;
};

function toBoolean(value: boolean | string | undefined) {
  if (value === "" || value === true) {
    return true;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function renderVersionTag(prefix: string, value?: string | boolean) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return `${prefix} ${value}`;
  }
  return prefix;
}

export function Endpoint({
  method,
  path,
  title,
  summary,
  auth,
  since,
  deprecated,
  removedIn,
  uiCopy,
  children,
}: EndpointProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const normalizedMethod = method.trim().toUpperCase();
  const meta = [
    auth ? `${copy.apiDocs.auth}: ${auth}` : null,
    renderVersionTag(copy.apiDocs.since, since),
    renderVersionTag(copy.apiDocs.deprecated, deprecated),
    renderVersionTag(copy.apiDocs.removedIn, removedIn),
  ].filter(Boolean) as string[];

  return (
    <section className="endpoint" data-method={normalizedMethod}>
      <div className="endpoint-header">
        <div className="endpoint-heading">
          <span className="endpoint-method">{normalizedMethod}</span>
          <code className="endpoint-path">{path}</code>
        </div>
        {title ? <div className="endpoint-title">{title}</div> : null}
        {summary ? <p className="endpoint-summary">{summary}</p> : null}
        {meta.length > 0 ? (
          <div className="endpoint-meta">
            {meta.map((item) => (
              <span className="endpoint-chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {children ? <div className="endpoint-body">{children}</div> : null}
    </section>
  );
}

export function ParamTable({ title, uiCopy, children }: ParamTableProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  return (
    <section className="param-table">
      {title ? <div className="param-table-title">{title}</div> : null}
      <div className="param-table-head" role="row">
        <span>{copy.apiDocs.name}</span>
        <span>{copy.apiDocs.type}</span>
        <span>{copy.apiDocs.required}</span>
        <span>{copy.apiDocs.default}</span>
        <span>{copy.apiDocs.description}</span>
      </div>
      <div className="param-table-body">{children}</div>
    </section>
  );
}

export function ParamField({
  name,
  type,
  required,
  defaultValue,
  description,
  uiCopy,
  children,
}: ParamFieldProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const requiredText = toBoolean(required) ? copy.apiDocs.yes : copy.apiDocs.no;
  const body = children ?? description ?? null;

  return (
    <div className="param-row" role="row">
      <div className="param-name">
        <code>{name}</code>
      </div>
      <div className="param-type">
        <code>{type}</code>
      </div>
      <div className="param-required">{requiredText}</div>
      <div className="param-default">
        {defaultValue ? <code>{defaultValue}</code> : <span className="param-empty">-</span>}
      </div>
      <div className="param-description">{body}</div>
    </div>
  );
}

export function ResponseSchema({
  title,
  code,
  mediaType,
  uiCopy,
  children,
}: ResponseSchemaProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  return (
    <section className="response-schema">
      <div className="response-schema-head">
        {title ? <div className="response-schema-title">{title}</div> : null}
        <div className="response-schema-meta">
          {code !== undefined ? (
            <span className="endpoint-chip">
              {copy.apiDocs.http} {code}
            </span>
          ) : null}
          {mediaType ? <span className="endpoint-chip">{mediaType}</span> : null}
        </div>
      </div>
      <div className="schema-list">{children}</div>
    </section>
  );
}

export function SchemaField({
  name,
  type,
  required,
  description,
  uiCopy,
  children,
}: SchemaFieldProps) {
  const copy = uiCopy ?? resolveMdxUiCopy();
  const hasChildren = Boolean(children);

  return (
    <div className="schema-field">
      <div className="schema-row">
        <div className="schema-main">
          <code className="schema-name">{name}</code>
          <code className="schema-type">{type}</code>
          {toBoolean(required) ? (
            <span className="schema-badge">{copy.apiDocs.requiredBadge}</span>
          ) : null}
        </div>
        {description ? <div className="schema-description">{description}</div> : null}
      </div>
      {hasChildren ? <div className="schema-children">{children}</div> : null}
    </div>
  );
}
