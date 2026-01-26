"use client";

import { useEffect } from "react";

export default function ClientInteractions() {
  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const menuToggle = document.querySelector("[data-menu-toggle]");
    const overlay = document.querySelector("[data-overlay]");
    const themeLabel = document.querySelector<HTMLElement>("[data-theme-label]");
    const themeMenu = document.querySelector<HTMLDetailsElement>(
      "[data-theme-menu]"
    );
    const themeKey = "typematter-theme";
    const themeLabels: Record<string, string> = {
      light: "Light",
      dark: "Dark",
      system: "System",
    };

    const getSystemTheme = () =>
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

    const applyTheme = (mode: string) => {
      const resolved = mode === "system" ? getSystemTheme() : mode;
      root.dataset.theme = resolved;
      root.dataset.themeMode = mode;
      if (themeLabel) {
        themeLabel.textContent = themeLabels[mode] ?? "System";
      }
    };

    const handleToggle = () => {
      body.classList.toggle("sidebar-open");
    };

    const handleClose = () => {
      body.classList.remove("sidebar-open");
    };

    menuToggle?.addEventListener("click", handleToggle);
    overlay?.addEventListener("click", handleClose);

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
      menuToggle?.removeEventListener("click", handleToggle);
      overlay?.removeEventListener("click", handleClose);
      document.removeEventListener("pointerdown", handleThemeSelect);
      if (mediaQuery) {
        mediaQuery.removeEventListener("change", handleSystemTheme);
      }
    };
  }, []);

  return null;
}
