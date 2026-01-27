# Typematter

Version: 0.1.5-alpha

Typematter is a static-first documentation shell built around MDX. The system emphasizes component-driven reading, consistent semantics, and long-term maintainability with Git-based content.

## Goals
- MDX is the source of truth; all docs live in the repo.
- Build-time parsing generates static pages and navigation.
- Runtime is minimal and focused on UI interactions.
- Consistent typography, spacing, and component behavior across pages.

## Features
- Static rendering pipeline for MDX content
- Directory-based navigation and ordering
- Component registry for reusable doc patterns
- Content validation (broken links, duplicate titles, orphan pages)
- Lightweight search and page copy utilities
- Multilingual content support (when enabled)

## Project structure
- `content/`: MDX documentation source
- `app/`: Next.js app router pages and layout
- `components/`: UI components and MDX renderers
- `lib/`: content parsing, navigation, and utilities
- `scripts/`: build-time validation

## Getting started
Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Build and validate docs:

```bash
npm run build
```

Validate docs only:

```bash
npm run validate:docs
```

## Authoring docs
Each page is an MDX file with frontmatter:

- Required: `title`, `order`, `section`
- Optional: `status`, `version`, `tags`, `description`, `slug`, `pager`

Navigation and hierarchy come from the folder structure and metadata, not manual sidebars.

## Components
Use semantic MDX patterns for consistent rendering. Examples include callouts, columns, diff blocks, code tabs, and feature matrices. Avoid one-off variants and keep content portable.

## Validation
The build pipeline includes content-quality checks for:
- Broken links
- Duplicate titles
- Orphan pages
- Invalid metadata

