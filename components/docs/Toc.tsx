"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { TocItem } from "../../lib/docs";

type TocProps = {
  items: TocItem[];
};

type IndicatorState = {
  top: number;
  height: number;
  visible: boolean;
};

const DEFAULT_INDICATOR: IndicatorState = {
  top: 0,
  height: 0,
  visible: false,
};

export default function Toc({ items }: TocProps) {
  const pathname = usePathname();
  const [activeId, setActiveId] = useState<string | null>(
    items[0]?.id ?? null
  );
  const [indicator, setIndicator] =
    useState<IndicatorState>(DEFAULT_INDICATOR);
  const listRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());

  const ids = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    setActiveId(items[0]?.id ?? null);
    setIndicator(DEFAULT_INDICATOR);
  }, [pathname, items]);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (headings.length === 0) {
      return;
    }

    const setActiveSafe = (id: string) => {
      setActiveId((prev) => (prev === id ? prev : id));
    };

    const setActiveFromHash = () => {
      if (!window.location.hash) {
        return;
      }
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (ids.includes(id)) {
        setActiveSafe(id);
      }
    };

    const updateActiveFromScroll = () => {
      const offset = 120;
      let current = headings[0];
      for (const heading of headings) {
        const top = heading.getBoundingClientRect().top - offset;
        if (top <= 0) {
          current = heading;
        } else {
          break;
        }
      }
      if (current) {
        setActiveSafe(current.id);
      }
    };

    let ticking = false;
    const handleScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        updateActiveFromScroll();
      });
    };

    setActiveFromHash();
    updateActiveFromScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    window.addEventListener("hashchange", setActiveFromHash);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("hashchange", setActiveFromHash);
    };
  }, [ids]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) {
      setIndicator(DEFAULT_INDICATOR);
      return;
    }

    const link = linkRefs.current.get(activeId);
    if (!link) {
      setIndicator(DEFAULT_INDICATOR);
      return;
    }

    const inset = 4;
    const top = link.offsetTop + inset;
    const height = Math.max(8, link.offsetHeight - inset * 2);
    setIndicator({ top, height, visible: true });
  }, [activeId, ids]);

  if (items.length === 0) {
    return <div className="toc-empty">No sections</div>;
  }

  return (
    <div className="toc-list" ref={listRef}>
      <span
        className="toc-indicator"
        aria-hidden="true"
        style={{
          transform: `translateY(${indicator.top}px)`,
          height: `${indicator.height}px`,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <a
            className={`toc-link level-${item.level}${isActive ? " is-active" : ""}`}
            href={`#${item.id}`}
            key={item.id}
            aria-current={isActive ? "true" : undefined}
            ref={(node) => {
              if (node) {
                linkRefs.current.set(item.id, node);
              } else {
                linkRefs.current.delete(item.id);
              }
            }}
          >
            {item.title}
          </a>
        );
      })}
    </div>
  );
}
