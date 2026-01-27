import { Callout, Note, Tip, Info, Warning, Deprecated } from "./Callout";
import { DiffBlock, DiffColumn } from "./DiffBlock";
import { Columns, Column } from "./Columns";
import { CodeBlock } from "./CodeBlock";
import { CodeTabs, CodeTab } from "./CodeTabs";
import { FeatureMatrix } from "./FeatureMatrix";

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
  CodeTabs,
  CodeTab,
  FeatureMatrix,
  pre: CodeBlock,
};
