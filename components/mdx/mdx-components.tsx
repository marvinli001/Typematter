import { Callout, Note, Tip, Info, Warning, Deprecated } from "./Callout";
import { DiffBlock, DiffColumn } from "./DiffBlock";
import { Columns, Column } from "./Columns";
import { CodeBlock } from "./CodeBlock";

export const mdxComponents = {
  Callout,
  Note,
  Tip,
  Info,
  Warning,
  Deprecated,
  DiffBlock,
  DiffColumn,
  Columns,
  Column,
  pre: CodeBlock,
};
