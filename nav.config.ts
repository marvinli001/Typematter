import type { NavConfig } from "./lib/nav";
import siteConfig from "./site.config";

const navConfig: NavConfig = {
  appendUnlisted: true,
  groups: [
    {
      title: "Get started",
      items: [
        { type: "doc", slug: "/", title: "Overview" },
        { type: "doc", slug: "get-started/quickstart" },
        { type: "doc", slug: "get-started/project-structure" },
      ],
    },
    {
      title: "Core concepts",
      items: [
        { type: "doc", slug: "core-concepts/architecture" },
        { type: "doc", slug: "core-concepts/navigation" },
        { type: "doc", slug: "core-concepts/components" },
      ],
    },
    {
      title: "API",
      items: [
        { type: "doc", slug: "api/content-registry" },
        { type: "doc", slug: "api/build-validation" },
      ],
    },
    {
      title: "Changelog",
      items: [{ type: "doc", slug: "changelog" }],
    },
    {
      title: "Resources",
      items: [
        {
          type: "external",
          title: "Git repository",
          href: siteConfig.repo.url,
          hidden: !siteConfig.repo.url,
        },
      ],
    },
  ],
};

export default navConfig;
