import { defineNavConfig } from "./lib/typematter/config";
import siteConfig from "./site.config";

const repoUrl = siteConfig.repo?.url?.trim() ?? "";
const hasPublicRepoUrl =
  repoUrl.length > 0 && !/^https?:\/\/example\.com\b/i.test(repoUrl);
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
        { type: "doc", slug: "get-started/project-structure" },
        { type: "doc", slug: "get-started/deployment" },
      ],
    },
    {
      title: {
        en: "Core concepts",
        cn: "核心概念",
      },
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
      title: {
        en: "Changelog",
        cn: "更新日志",
      },
      items: [{ type: "doc", slug: "changelog" }],
    },
    {
      title: {
        en: "Resources",
        cn: "资源",
      },
      items: [
        {
          type: "external",
          title: {
            en: "Git repository",
            cn: "Git 仓库",
          },
          href: repoUrl,
          hidden: !hasPublicRepoUrl,
        },
      ],
    },
  ],
});

export default navConfig;
