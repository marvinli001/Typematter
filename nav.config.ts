import { defineNavConfig } from "./lib/typematter/config";
import siteConfig from "./site.config";

const repoUrl = siteConfig.repo?.url?.trim() ?? "";
const hasPublicRepoUrl =
  repoUrl.length > 0 && !/^https?:\/\/example\.com\b/i.test(repoUrl);
const navConfig = defineNavConfig<string>()({
  appendUnlisted: true,
  groups: [
    {
      title: "Get started",
      items: [
        { type: "doc", slug: "/", title: "Overview" },
        { type: "doc", slug: "get-started/quickstart" },
        { type: "doc", slug: "get-started/project-structure" },
        { type: "doc", slug: "get-started/deployment" },
      ],
    },
    {
      title: "Core concepts",
      items: [
        { type: "doc", slug: "core-concepts/architecture" },
        { type: "doc", slug: "core-concepts/navigation" },
        { type: "doc", slug: "core-concepts/components" },
        { type: "doc", slug: "core-concepts/authoring-syntax" },
      ],
    },
    {
      title: "API",
      items: [
        { type: "doc", slug: "api/typematter-api" },
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
          href: repoUrl,
          hidden: !hasPublicRepoUrl,
        },
      ],
    },
  ],
});

export default navConfig;
