import type { ValidationConfig } from "./config";

export function createDefaultValidationConfig(): ValidationConfig {
  return {
    translation: {
      requiredFields: ["title", "section", "description", "type"],
      requireLocalizedNavTitles: true,
      sharedNavTitles: ["API", "CLI", "SDK", "MCP", "REST", "GraphQL"],
    },
    frontmatterSchemas: [
      {
        include: ["**/*.mdx"],
        fields: {
          type: {
            required: true,
            type: "string",
            enum: ["guide", "api", "migration", "changelog"],
          },
          description: { required: true, type: "string" },
          aliases: { type: "string[]" },
          versionGroup: { type: "string" },
          changelog: { type: "string" },
          supersedes: { type: "string" },
          diffWith: { type: "string" },
          deprecatedIn: { type: "string|number" },
          removedIn: { type: "string|number" },
        },
      },
      {
        include: ["api/**/*.mdx"],
        fields: {
          type: { enum: ["api"] },
        },
      },
      {
        include: ["changelog/**/*.mdx"],
        fields: {
          type: { enum: ["changelog"] },
        },
      },
      {
        include: ["migration/**/*.mdx", "**/migration/**/*.mdx"],
        fields: {
          type: { enum: ["migration"] },
          versionGroup: { required: true, type: "string" },
        },
      },
    ],
    docTypes: {
      guide: {
        include: [
          "index.mdx",
          "get-started/**/*.mdx",
          "core-concepts/**/*.mdx",
        ],
        recommendedComponentsAnyOf: [
          "Callout",
          "Note",
          "Tip",
          "Info",
          "Warning",
          "Deprecated",
          "Steps",
          "Cards",
          "Details",
          "Columns",
        ],
      },
      api: {
        include: ["api/**/*.mdx"],
        recommendedComponentsAnyOf: [
          "Callout",
          "Note",
          "Tip",
          "Info",
          "Warning",
          "Deprecated",
          "Endpoint",
          "ParamTable",
          "ResponseSchema",
          "CommandGroup",
          "DoDont",
          "VersionGate",
        ],
      },
      migration: {
        include: ["migration/**/*.mdx", "**/migration/**/*.mdx"],
        recommendedComponentsAnyOf: [
          "VersionGate",
          "DoDont",
          "Steps",
          "DiffBlock",
        ],
      },
      changelog: {
        include: ["changelog/**/*.mdx"],
        recommendedComponentsAnyOf: ["Timeline", "ReleaseItem", "VersionGate"],
      },
    },
  };
}
