import { defineNavConfig } from "./lib/typematter/config";

const navConfig = defineNavConfig<string>()({
  appendUnlisted: true,
  groups: [
    {
      title: {
        en: "Get started",
        cn: "开始使用",
      },
      items: [
        {
          type: "doc",
          slug: "/",
          title: {
            en: "Overview",
            cn: "概览",
          },
        },
        { type: "doc", slug: "get-started/quickstart" },
        { type: "doc", slug: "get-started/deployment" },
      ],
    },
    {
      title: {
        en: "Core concepts",
        cn: "核心概念",
      },
      items: [{ type: "doc", slug: "core-concepts/components" }],
    },
  ],
});

export default navConfig;
