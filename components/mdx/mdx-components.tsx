import { Callout, Note, Tip, Info, Warning, Deprecated } from "./Callout";
import { DiffBlock, DiffColumn } from "./DiffBlock";
import { Columns, Column } from "./Columns";
import { CodeBlock } from "./CodeBlock";
import { CodeTabs, CodeTab } from "./CodeTabs";
import { FeatureMatrix } from "./FeatureMatrix";
import { Steps, Step } from "./Steps";
import { Details } from "./Details";
import { FileTree, FileTreeItem } from "./FileTree";
import { Annotation } from "./Annotation";

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
  Steps,
  Step,
  Details,
  FileTree,
  FileTreeItem,
  Annotation,
  pre: CodeBlock,
};
