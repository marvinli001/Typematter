# Typematter

Version: 0.3.0-rc

Typematter is a static-first documentation shell built around MDX. The system emphasizes component-driven reading, consistent semantics, and long-term maintainability with Git-based content.

## Goals
- MDX is the source of truth; all docs live in the repo.
- Build-time parsing generates static pages and navigation.
- Runtime is minimal and focused on UI interactions.
- Consistent typography, spacing, and component behavior across pages.

## Features
- Static rendering pipeline for MDX content
- Directory-based navigation and ordering
- Executable plugin lifecycle across build, registry, MDX render, and validation
- Component registry for reusable doc patterns with per-page component detection
- Content governance validation (links, anchors, headings depth, translations, schema)
- Standard search with on-demand shard loading and weighted ranking
- Optional Ask AI tab in search modal (Cloudflare AI Search + Chat Completions)
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

## Ask AI setup
Ask AI is disabled by default. It is enabled only when a public endpoint is configured.

Client-side build env vars:

```bash
NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT=https://<your-worker-domain>
NEXT_PUBLIC_TYPEMATTER_ASK_AI_TIMEOUT_MS=25000 # optional
NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENABLED=true      # optional
```

Sitemap/robots for Cloudflare AI Search:

```bash
TYPEMATTER_SITE_URL=https://docs.your-domain.com
```

Typematter build/export will then auto-generate:

- `public/robots.txt` (with `Sitemap: <site>/sitemap.xml`)
- `public/sitemap.xml` (all non-hidden doc routes)

Worker reference implementation:

- `integrations/cloudflare-ask-ai-worker/src/index.ts`
- `integrations/cloudflare-ask-ai-worker/wrangler.toml`
- `integrations/cloudflare-ask-ai-worker/README.md`

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
- Broken heading anchors
- Duplicate titles
- Orphan pages
- Invalid metadata
- Heading depth and heading-level skips
- Missing translations (page + key frontmatter fields)
- Path-layered frontmatter schema rules

## Plugin lifecycle
Typematter plugins run in a fixed lifecycle:

- `buildStart`
- `contentCollected`
- `pageParsed` (per page)
- `registryReady`
- `buildEnd`
- `validate` (after built-in validation rules)
- `pageRendered` (MDX render stage)

MDX plugin entries are fully executable:

- `mdx.remark`
- `mdx.rehype`
- `mdx.components`

## Standard search artifacts
Build output includes standard search assets:

- `public/typematter/search/manifest.json`
- `public/typematter/search/docs.<lang>.json`
- `public/typematter/search/shards/<lang>/<bucket>.json`

The search modal loads `manifest + docs` first, then fetches shard buckets on demand by query tokens.


