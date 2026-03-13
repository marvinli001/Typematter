import { defineNavConfig } from "./lib/typematter/config";

const navConfig = defineNavConfig<string>()({
  appendUnlisted: true,
  groups: [
    {
      title: "Get started",
      items: [
        { type: "doc", slug: "/", title: "Overview" },
        { type: "doc", slug: "get-started/quickstart" },
        { type: "doc", slug: "get-started/deployment" },
      ],
    },
    {
      title: "Core concepts",
      items: [{ type: "doc", slug: "core-concepts/components" }],
    },
  ],
});

export default navConfig;
