import { normalizeRoute } from "../docs";
import type { ContentRegistry, RegistryPage } from "./registry";

export type RelatedDocLink = {
  title: string;
  href: string;
  version?: string | number;
  current?: boolean;
};

export type PageVersionInfo = {
  currentVersion?: string | number;
  versionGroup?: string;
  versions: RelatedDocLink[];
  changelog?: RelatedDocLink;
  supersedes?: RelatedDocLink;
  supersededBy?: RelatedDocLink;
  diffWith?: RelatedDocLink;
  deprecatedIn?: string | number;
  removedIn?: string | number;
};

function splitVersion(value: string | number | undefined) {
  if (value === undefined || value === null) {
    return [];
  }

  return String(value)
    .toLowerCase()
    .split(/([0-9]+|[a-z]+)/g)
    .filter(Boolean)
    .map((part) => (/^[0-9]+$/.test(part) ? Number(part) : part));
}

function compareVersions(left: string | number | undefined, right: string | number | undefined) {
  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const a = leftParts[index];
    const b = rightParts[index];
    if (a === undefined) {
      return 1;
    }
    if (b === undefined) {
      return -1;
    }
    if (typeof a === "number" && typeof b === "number" && a !== b) {
      return b - a;
    }
    if (String(a) !== String(b)) {
      return String(a).localeCompare(String(b));
    }
  }

  return 0;
}

function versionGroupKey(page: RegistryPage) {
  return page.versionGroup?.trim() || page.contentPath;
}

function resolveReference(
  registry: ContentRegistry,
  currentPage: RegistryPage,
  reference?: string
) {
  if (!reference) {
    return undefined;
  }

  const normalized = normalizeRoute(reference);
  return registry.pages.find((candidate) => {
    if (candidate.language !== currentPage.language) {
      return false;
    }
    return (
      candidate.route === normalized ||
      candidate.contentRoute === normalized ||
      candidate.contentPath === reference
    );
  });
}

function toLink(page: RegistryPage, currentPage: RegistryPage): RelatedDocLink {
  return {
    title: page.title,
    href: page.route,
    version: page.version,
    current: page.route === currentPage.route,
  };
}

export function getPageVersionInfo(
  registry: ContentRegistry,
  currentPage: RegistryPage
): PageVersionInfo | null {
  const groupKey = versionGroupKey(currentPage);
  const relatedVersions = registry.pages
    .filter((page) => {
      if (page.language !== currentPage.language) {
        return false;
      }
      if (!page.version && !currentPage.version) {
        return false;
      }
      return versionGroupKey(page) === groupKey;
    })
    .sort((a, b) => compareVersions(a.version, b.version))
    .map((page) => toLink(page, currentPage));

  const changelogPage =
    resolveReference(registry, currentPage, currentPage.changelog) ??
    registry.pages.find(
      (page) => page.language === currentPage.language && page.type === "changelog"
    );
  const supersedesPage = resolveReference(registry, currentPage, currentPage.supersedes);
  const diffPage = resolveReference(registry, currentPage, currentPage.diffWith);
  const supersededByPage = registry.pages.find((page) => {
    if (page.language !== currentPage.language) {
      return false;
    }
    if (!page.supersedes) {
      return false;
    }
    const normalized = normalizeRoute(page.supersedes);
    return (
      normalized === currentPage.route ||
      normalized === currentPage.contentRoute ||
      page.supersedes === currentPage.contentPath
    );
  });

  if (
    relatedVersions.length === 0 &&
    !changelogPage &&
    !supersedesPage &&
    !supersededByPage &&
    !diffPage &&
    currentPage.deprecatedIn === undefined &&
    currentPage.removedIn === undefined
  ) {
    return null;
  }

  return {
    currentVersion: currentPage.version,
    versionGroup: groupKey,
    versions: relatedVersions,
    changelog:
      changelogPage && changelogPage.route !== currentPage.route
        ? toLink(changelogPage, currentPage)
        : undefined,
    supersedes: supersedesPage ? toLink(supersedesPage, currentPage) : undefined,
    supersededBy: supersededByPage ? toLink(supersededByPage, currentPage) : undefined,
    diffWith: diffPage ? toLink(diffPage, currentPage) : undefined,
    deprecatedIn: currentPage.deprecatedIn,
    removedIn: currentPage.removedIn,
  };
}
