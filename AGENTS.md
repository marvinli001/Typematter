# Typematter AGENTS

This repository defines an internal, long-lived documentation system. The goal is not a generic doc generator; it is a stable, extensible docs shell centered on visual components and Git-based maintainability.

## Mission and scope
- MDX is the content source of truth. All docs live in the repo and are versioned with Git (no cloud editing or accounts).
- Focus on "visual component-driven reading" and consistent semantics/behavior for recurring doc patterns.
- Prioritize reading experience, typography rhythm, whitespace, hierarchy clarity, and desktop/mobile consistency.

## Architecture rules
- Static rendering model: parse MDX at build time into structured data and generate static pages.
- Runtime layer should only render and handle lightweight UI interactions (no content logic at runtime).
- Navigation, hierarchy, and ordering are derived from directory conventions and metadata, not manual sidebars.
- Build should detect which components are used per page and apply consistent styles and behaviors.
- Output must be fully static, cacheable, and rollback-friendly. CDN implementation is out of scope.

## UI direction
- Visual style blends Next.js Docs + OpenAI Platform: clean, flat, geeky, with subtle micro-interactions.
- Keep UI restrained and technical; avoid heavy ornamentation or noisy gradients.
- Ensure consistent button styling, iconography, and component affordances across the site.

## Non-goals (do not add)
- WYSIWYG editor
- Real-time collaboration
- Backend admin panel
- Account/auth system

## Content and components
- Keep prose primary; use high-level components for warnings, version diffs, deprecations, examples, structured blocks, and columns.
- Component semantics must stay consistent site-wide; avoid one-off variants.
- When adding a new component, update the component registry, build-time detector, and shared styles/behaviors.

## Validation and CI
- CI must validate doc quality: broken links, duplicate titles, orphan pages, invalid internal jumps, and invalid metadata.
- Prefer content-quality checks over code-only linting.

## Change guidelines
- Preserve the static build pipeline and keep runtime simple.
- Avoid introducing runtime data fetching or stateful content logic.
- Keep new features aligned with the core doc experience and long-term maintainability.
