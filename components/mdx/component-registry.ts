const COMPONENT_LOADERS: Record<string, () => Promise<unknown>> = {
  Callout: async () => (await import("./Callout")).Callout,
  Note: async () => (await import("./Callout")).Note,
  Tip: async () => (await import("./Callout")).Tip,
  Info: async () => (await import("./Callout")).Info,
  Warning: async () => (await import("./Callout")).Warning,
  Deprecated: async () => (await import("./Callout")).Deprecated,
  DiffBlock: async () => (await import("./DiffBlock")).DiffBlock,
  DiffColumn: async () => (await import("./DiffBlock")).DiffColumn,
  Columns: async () => (await import("./Columns")).Columns,
  Column: async () => (await import("./Columns")).Column,
  CodeTabs: async () => (await import("./CodeTabs")).CodeTabs,
  CodeTab: async () => (await import("./CodeTabs")).CodeTab,
  FeatureMatrix: async () => (await import("./FeatureMatrix")).FeatureMatrix,
  Steps: async () => (await import("./Steps")).Steps,
  Step: async () => (await import("./Steps")).Step,
  Details: async () => (await import("./Details")).Details,
  FileTree: async () => (await import("./FileTree")).FileTree,
  FileTreeItem: async () => (await import("./FileTree")).FileTreeItem,
  Annotation: async () => (await import("./Annotation")).Annotation,
  Cards: async () => (await import("./Cards")).Cards,
  Card: async () => (await import("./Cards")).Card,
  LinkButton: async () => (await import("./LinkButton")).LinkButton,
  Badge: async () => (await import("./Badge")).Badge,
  Endpoint: async () => (await import("./ApiDocs")).Endpoint,
  ParamTable: async () => (await import("./ApiDocs")).ParamTable,
  ParamField: async () => (await import("./ApiDocs")).ParamField,
  ResponseSchema: async () => (await import("./ApiDocs")).ResponseSchema,
  SchemaField: async () => (await import("./ApiDocs")).SchemaField,
  DoDont: async () => (await import("./DoDont")).DoDont,
  DoItem: async () => (await import("./DoDont")).DoItem,
  DontItem: async () => (await import("./DoDont")).DontItem,
  VersionGate: async () => (await import("./VersionGate")).VersionGate,
  CommandGroup: async () => (await import("./CommandGroup")).CommandGroup,
  Command: async () => (await import("./CommandGroup")).Command,
  PreviewFrame: async () => (await import("./PreviewFrame")).PreviewFrame,
  Timeline: async () => (await import("./Timeline")).Timeline,
  ReleaseItem: async () => (await import("./Timeline")).ReleaseItem,
  CodeBlock: async () => (await import("./CodeBlock")).CodeBlock,
};

const COMPONENT_DEPENDENCIES: Record<string, string[]> = {
  DiffBlock: ["DiffColumn"],
  Columns: ["Column"],
  CodeTabs: ["CodeTab"],
  Steps: ["Step"],
  FileTree: ["FileTreeItem"],
  Cards: ["Card"],
  ParamTable: ["ParamField"],
  ResponseSchema: ["SchemaField"],
  DoDont: ["DoItem", "DontItem"],
  CommandGroup: ["Command"],
  Timeline: ["ReleaseItem"],
};

function expandDependencies(components: Set<string>) {
  let changed = true;
  while (changed) {
    changed = false;
    Array.from(components).forEach((name) => {
      const deps = COMPONENT_DEPENDENCIES[name] ?? [];
      deps.forEach((dep) => {
        if (!components.has(dep)) {
          components.add(dep);
          changed = true;
        }
      });
    });
  }
}

export async function resolveMdxComponents(
  usedComponents: string[] | undefined,
  pluginComponents: Record<string, unknown> = {}
) {
  const required = new Set<string>(["CodeBlock"]);
  (usedComponents ?? []).forEach((name) => required.add(name));
  expandDependencies(required);

  const resolved: Record<string, unknown> = {};
  await Promise.all(
    Array.from(required).map(async (name) => {
      const loader = COMPONENT_LOADERS[name];
      if (!loader) {
        return;
      }
      resolved[name] = await loader();
    })
  );

  resolved.pre = resolved.CodeBlock;
  Object.assign(resolved, pluginComponents);
  return resolved;
}
