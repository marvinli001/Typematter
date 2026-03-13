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

## Official repo vs starter
This repository is intended to stay as the official Typematter docs/demo site.

If you want to build your own docs with Typematter, generate a clean starter project instead of continuing to write inside this repository:

```bash
npm run typematter -- init --dir ../my-docs
cd ../my-docs
npm install
npm run dev
```

The generated project keeps the Typematter shell and starter content, but does not include the official Typematter docs under `content/`.

## Deployment
Typematter is configured for Next.js static export (`output: "export"`). A production build writes the site to `out/`.

Recommended production flow:

```bash
cp .env.example .env.local
npm run build
```

Key environment variables:

- `TYPEMATTER_SITE_URL`: required for correct `robots.txt` and `sitemap.xml`
- `NEXT_PUBLIC_SITE_URL`: optional mirror for the client side
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT`: optional Ask AI Worker URL
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_TIMEOUT_MS`: optional Ask AI timeout

Build output:

- Static site: `out/`
- Registry cache: `.typematter/`
- Public search assets: `public/typematter/search/`

Then deploy the `out/` directory to any static host:

- Vercel
- Cloudflare Pages
- Nginx
- S3 / R2 / OSS

Platform notes:

- `Vercel`: build command `npm run build`, output directory `out`
- `Cloudflare Pages`: build command `npm run build`, output directory `out`
- `Nginx / object storage`: upload the generated `out/` directory as static files

Local preview after build:

```bash
npx serve out
```

`TYPEMATTER_SITE_URL` is important because it is used to emit absolute URLs in `robots.txt` and `sitemap.xml`.

## Troubleshooting
- `robots.txt` or `sitemap.xml` still shows `example.com`: `TYPEMATTER_SITE_URL` was not set at build time.
- `npm run build` fails on orphan pages or broken links: run `npm run validate:docs` first and fix the reported docs issue.
- You want a clean project, not the official docs content: use `npm run typematter -- init --dir ../my-docs`.
- You want Ask AI: deploy the Worker under `integrations/cloudflare-ask-ai-worker/` and inject the public endpoint into the docs build.

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
The official docs now include a dedicated Authoring Syntax cheat sheet at `/en/core-concepts/authoring-syntax` and `/cn/core-concepts/authoring-syntax`.

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


