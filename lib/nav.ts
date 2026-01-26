import navConfig from "../nav.config";
import { getAllDocEntries, normalizeRoute } from "./docs";
import { getI18nConfig } from "./i18n";

export type NavItemConfig =
  | {
      type: "doc";
      slug: string;
      title?: string;
      hidden?: boolean;
    }
  | {
      type: "external";
      title: string;
      href: string;
      hidden?: boolean;
    };

export type NavGroupConfig = {
  title: string;
  items: NavItemConfig[];
};

export type NavConfig = {
  groups: NavGroupConfig[];
  appendUnlisted?: boolean;
};

export type NavItem = {
  type: "doc" | "external";
  title: string;
  href: string;
  status?: string;
  version?: string | number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export type NavData = {
  groups: NavGroup[];
  usedRoutes: Set<string>;
  hiddenRoutes: Set<string>;
  allRoutes: Set<string>;
};

function normalizeConfigSlug(slug: string) {
  if (!slug || slug === "/") {
    return "/";
  }

  return normalizeRoute(slug);
}

function sortDocs<T extends { frontmatter: { order: number; title: string } }>(
  docs: T[]
) {
  return docs.sort((a, b) => {
    if (a.frontmatter.order !== b.frontmatter.order) {
      return a.frontmatter.order - b.frontmatter.order;
    }
    return a.frontmatter.title.localeCompare(b.frontmatter.title);
  });
}

function buildAutoGroups(remainingDocs: ReturnType<typeof getAllDocEntries>) {
  const groupsMap = new Map<string, ReturnType<typeof getAllDocEntries>>();

  remainingDocs.forEach((doc) => {
    const section = doc.frontmatter.section || "General";
    if (!groupsMap.has(section)) {
      groupsMap.set(section, []);
    }
    groupsMap.get(section)?.push(doc);
  });

  const groups: NavGroup[] = [];
  Array.from(groupsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([section, docs]) => {
      const items = sortDocs(docs).map((doc) => ({
        type: "doc" as const,
        title: doc.frontmatter.title,
        href: doc.route,
        status: doc.frontmatter.status,
        version: doc.frontmatter.version,
      }));

      groups.push({ title: section, items });
    });

  return groups;
}

export function getNavData(language?: string): NavData {
  const i18nConfig = getI18nConfig();
  const resolvedLanguage = i18nConfig.enabled
    ? language ?? i18nConfig.defaultLanguage ?? undefined
    : undefined;
  const docs = i18nConfig.enabled
    ? getAllDocEntries().filter((doc) => doc.language === resolvedLanguage)
    : getAllDocEntries();
  const docMap = new Map(docs.map((doc) => [doc.contentRoute, doc]));
  const allRoutes = new Set(docs.map((doc) => doc.route));
  const usedRoutes = new Set<string>();
  const hiddenRoutes = new Set<string>();

  docs.forEach((doc) => {
    if (doc.frontmatter.hidden) {
      hiddenRoutes.add(doc.route);
    }
  });

  const groups: NavGroup[] = [];
  const configGroups = navConfig?.groups ?? [];

  configGroups.forEach((group) => {
    const items: NavItem[] = [];

    group.items.forEach((item) => {
      if (item.hidden) {
      if (item.type === "doc") {
        const hiddenRoute = normalizeConfigSlug(item.slug);
        const doc = docMap.get(hiddenRoute);
        if (doc) {
          hiddenRoutes.add(doc.route);
        }
      }
      return;
    }

      if (item.type === "external") {
        items.push({
          type: "external",
          title: item.title,
          href: item.href,
        });
        return;
      }

      const contentRoute = normalizeConfigSlug(item.slug);
      const doc = docMap.get(contentRoute);
      if (!doc) {
        return;
      }

      usedRoutes.add(doc.route);
      items.push({
        type: "doc",
        title: item.title ?? doc.frontmatter.title,
        href: doc.route,
        status: doc.frontmatter.status,
        version: doc.frontmatter.version,
      });
    });

    if (items.length > 0) {
      groups.push({ title: group.title, items });
    }
  });

  const appendUnlisted = navConfig?.appendUnlisted ?? true;
  if (appendUnlisted) {
    const remainingDocs = docs.filter(
      (doc) => !usedRoutes.has(doc.route) && !hiddenRoutes.has(doc.route)
    );

    if (remainingDocs.length > 0) {
      remainingDocs.forEach((doc) => usedRoutes.add(doc.route));
      const autoGroups = buildAutoGroups(remainingDocs);
      autoGroups.forEach((group) => {
        const existing = groups.find((item) => item.title === group.title);
        if (existing) {
          existing.items.push(...group.items);
        } else {
          groups.push(group);
        }
      });
    }
  }

  return { groups, usedRoutes, hiddenRoutes, allRoutes };
}
