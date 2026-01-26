"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function RouteTransition() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const failSafeRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      if (anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      if (/^(mailto:|tel:|sms:|javascript:)/i.test(href)) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) {
        return;
      }

      const currentPath = window.location.pathname + window.location.search;
      const nextPath = url.pathname + url.search;
      if (currentPath === nextPath) {
        return;
      }

      setActive(true);
      if (failSafeRef.current) {
        window.clearTimeout(failSafeRef.current);
      }
      failSafeRef.current = window.setTimeout(() => {
        setActive(false);
      }, 4000);
    };

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setActive(false);
    }, 160);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [pathname, searchParams?.toString(), active]);

  if (!active) {
    return null;
  }

  return (
    <div className="route-transition" aria-hidden="true">
      <div className="loading-card route-skeleton">
        <div className="loading-row">
          <div className="skeleton skeleton-line" style={{ width: "22%" }} />
          <div className="skeleton skeleton-line" style={{ width: "14%" }} />
        </div>

        <div className="skeleton skeleton-title" style={{ width: "38%" }} />
        <div className="loading-row">
          <div className="skeleton skeleton-chip" style={{ width: "76px" }} />
          <div className="skeleton skeleton-chip" style={{ width: "92px" }} />
        </div>

        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "88%" }} />
          <div className="skeleton skeleton-line" style={{ width: "84%" }} />
          <div className="skeleton skeleton-line" style={{ width: "62%" }} />
        </div>

        <div className="skeleton skeleton-section" style={{ width: "24%" }} />
        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "90%" }} />
          <div className="skeleton skeleton-line" style={{ width: "86%" }} />
          <div className="skeleton skeleton-line" style={{ width: "80%" }} />
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
        </div>

        <div className="skeleton skeleton-section" style={{ width: "26%" }} />
        <div className="loading-block">
          <div className="skeleton skeleton-line" style={{ width: "88%" }} />
          <div className="skeleton skeleton-line" style={{ width: "84%" }} />
          <div className="skeleton skeleton-line" style={{ width: "72%" }} />
        </div>

        <div className="loading-row">
          <div className="skeleton skeleton-chip" style={{ width: "140px" }} />
        </div>
      </div>
    </div>
  );
}
