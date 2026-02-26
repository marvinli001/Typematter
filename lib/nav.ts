import navConfig from "../nav.config";
import { normalizeRoute } from "./docs";
import { getI18nConfig } from "./i18n";
import { loadRegistry } from "./typematter/build-registry";

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

function sortDocs<T extends { order: number; title: string }>(docs: T[]) {
  return docs.sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.title.localeCompare(b.title);
  });
}

type RegistryDoc = {
  route: string;
  contentRoute: string;
  title: string;
  order: number;
  section: string;
  status?: string;
  version?: string | number;
  hidden?: boolean;
};

function buildAutoGroups(remainingDocs: RegistryDoc[]) {
  const groupsMap = new Map<string, RegistryDoc[]>();

  remainingDocs.forEach((doc) => {
    const section = doc.section || "General";
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
        title: doc.title,
        href: doc.route,
        status: doc.status,
        version: doc.version,
      }));

      groups.push({ title: section, items });
    });

  return groups;
}

export function getNavData(
  language?: string,
  options?: { buildIfMissing?: boolean }
): NavData {
  const registry = loadRegistry({
    buildIfMissing:
      options?.buildIfMissing ?? process.env.NODE_ENV !== "production",
  });
  const i18nConfig = getI18nConfig();
  const resolvedLanguage = i18nConfig.enabled
    ? language ?? i18nConfig.defaultLanguage ?? undefined
    : undefined;
  const docs = i18nConfig.enabled
    ? registry.pages.filter((doc) => doc.language === resolvedLanguage)
    : registry.pages;
  const docMap = new Map(docs.map((doc) => [doc.contentRoute, doc]));
  const allRoutes = new Set(docs.map((doc) => doc.route));
  const usedRoutes = new Set<string>();
  const hiddenRoutes = new Set<string>();

  docs.forEach((doc) => {
    if (doc.hidden) {
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
        title: item.title ?? doc.title,
        href: doc.route,
        status: doc.status,
        version: doc.version,
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
