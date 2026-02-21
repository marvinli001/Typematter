"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import siteConfig from "../site.config";
import { getUiCopy, resolveUiLanguage } from "../lib/i18n/ui-copy";

export default function ClientInteractions() {
  const pathname = usePathname();
  const languageCodes = siteConfig.i18n?.languages.map((language) => language.code) ?? [];
  const firstSegment = pathname?.split("/").filter(Boolean)[0];
  const routeLanguage =
    firstSegment && languageCodes.includes(firstSegment) ? firstSegment : undefined;
  const copy = getUiCopy(resolveUiLanguage(routeLanguage));

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const themeLabel = document.querySelector<HTMLElement>("[data-theme-label]");
    const themeMenu = document.querySelector<HTMLDetailsElement>(
      "[data-theme-menu]"
    );
    const themeKey = "typematter-theme";
    const themeLabels: Record<string, string> = {
      light: copy.theme.light,
      dark: copy.theme.dark,
      system: copy.theme.system,
    };

    const getSystemTheme = () =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    const applyTheme = (mode: string) => {
      const resolved = mode === "system" ? getSystemTheme() : mode;
      root.dataset.theme = resolved;
      root.dataset.themeMode = mode;
      if (themeLabel) {
        themeLabel.textContent = themeLabels[mode] ?? copy.theme.system;
      }
    };

    const handleClose = () => {
      body.classList.remove("sidebar-open");
    };

    const handleMenuClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest("[data-menu-toggle]")) {
        event.preventDefault();
        body.classList.toggle("sidebar-open");
        return;
      }

      if (target.closest("[data-menu-close]") || target.closest("[data-overlay]")) {
        event.preventDefault();
        handleClose();
      }
    };

    const handleNavClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const navItem = target?.closest("[data-nav-item]");
      if (!navItem) {
        return;
      }
      handleClose();
    };

    const handleThemeSelect = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-theme-option]"
      );
      if (!target) {
        return;
      }

      event.preventDefault();
      const mode = target.dataset.themeOption ?? "system";
      try {
        localStorage.setItem(themeKey, mode);
      } catch {
        // ignore write errors
      }
      applyTheme(mode);
      if (themeMenu) {
        themeMenu.open = false;
      }
    };

    document.addEventListener("pointerdown", handleThemeSelect);
    document.addEventListener("click", handleNavClick, true);
    document.addEventListener("click", handleMenuClick);

    let mediaQuery: MediaQueryList | null = null;
    const handleSystemTheme = () => {
      if (root.dataset.themeMode === "system") {
        applyTheme("system");
      }
    };

    if (window.matchMedia) {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", handleSystemTheme);
    }

    try {
      const stored = localStorage.getItem(themeKey);
      const mode =
        stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system";
      applyTheme(mode);
    } catch {
      applyTheme("system");
    }

    return () => {
      document.removeEventListener("pointerdown", handleThemeSelect);
      document.removeEventListener("click", handleNavClick, true);
      document.removeEventListener("click", handleMenuClick);
      if (mediaQuery) {
        mediaQuery.removeEventListener("change", handleSystemTheme);
      }
    };
  }, [copy.theme.dark, copy.theme.light, copy.theme.system]);

  return null;
}
