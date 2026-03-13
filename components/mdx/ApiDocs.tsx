import type { ReactNode } from "react";

type EndpointProps = {
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

type ParamTableProps = {
  title?: string;
  children: ReactNode;
};

type ParamFieldProps = {
  name: string;
  type: string;
  required?: boolean | string;
  defaultValue?: string;
  description?: string;
  children?: ReactNode;
};

type ResponseSchemaProps = {
  title?: string;
  code?: string | number;
  mediaType?: string;
  children: ReactNode;
};

type SchemaFieldProps = {
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
  children,
}: EndpointProps) {
  const normalizedMethod = method.trim().toUpperCase();
  const meta = [
    auth ? `Auth: ${auth}` : null,
    renderVersionTag("Since", since),
    renderVersionTag("Deprecated", deprecated),
    renderVersionTag("Removed in", removedIn),
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

export function ParamTable({ title, children }: ParamTableProps) {
  return (
    <section className="param-table">
      {title ? <div className="param-table-title">{title}</div> : null}
      <div className="param-table-head" role="row">
        <span>Name</span>
        <span>Type</span>
        <span>Required</span>
        <span>Default</span>
        <span>Description</span>
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
  children,
}: ParamFieldProps) {
  const requiredText = toBoolean(required) ? "Yes" : "No";
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
  children,
}: ResponseSchemaProps) {
  return (
    <section className="response-schema">
      <div className="response-schema-head">
        {title ? <div className="response-schema-title">{title}</div> : null}
        <div className="response-schema-meta">
          {code !== undefined ? <span className="endpoint-chip">HTTP {code}</span> : null}
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
  children,
}: SchemaFieldProps) {
  const hasChildren = Boolean(children);

  return (
    <div className="schema-field">
      <div className="schema-row">
        <div className="schema-main">
          <code className="schema-name">{name}</code>
          <code className="schema-type">{type}</code>
          {toBoolean(required) ? <span className="schema-badge">required</span> : null}
        </div>
        {description ? <div className="schema-description">{description}</div> : null}
      </div>
      {hasChildren ? <div className="schema-children">{children}</div> : null}
    </div>
  );
}
