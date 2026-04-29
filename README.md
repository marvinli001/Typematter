# Typematter

Version: 0.4.0-rc

Typematter is a static-first documentation shell for long-lived MDX docs. It is built for Git-managed content, visual component-driven reading, predictable navigation, and fully static deployment.

It is not a hosted CMS, a WYSIWYG editor, or an admin panel. The source of truth stays in your repository.

## Requirements

- Node.js 20, 22, or 24
- npm 10 or newer

## Fast Path: Create Your Own Docs App

Run the starter generator from this repository root. The target directory must be outside the official Typematter repo.

```bash
git clone <typematter-repo-url> Typematter
cd Typematter
npm install
npm run typematter -- init --dir ../my-docs

cd ../my-docs
cp .env.example .env.local
npm install
npm run dev
```

Then edit:

- `content/`: your MDX pages
- `site.config.ts`: title, site URL, i18n, repo links, optional Ask AI examples
- `nav.config.ts`: sidebar groups, display order, external links, hidden items
- `.env.local`: production site URL and optional Ask AI endpoint

The official Typematter repository should stay as the maintained docs/demo site. For real product or team docs, generate a clean starter and keep it in its own Git repository.

## Run The Official Demo

Use this when you want to inspect Typematter itself.

```bash
npm install
npm run dev
```

Validate and build the demo:

```bash
npm run validate:docs
npm run build
```

## What You Get

- Static MDX rendering through Next.js export
- Directory-aware routing and navigation derived from content plus metadata
- Reusable semantic MDX components for callouts, steps, diffs, cards, API blocks, timelines, file trees, and more
- Build-time component detection with shared styles and behavior
- Content-quality validation for links, anchors, duplicate titles, duplicate routes, orphan pages, metadata, heading depth, i18n structure, and doc-type conventions
- Standard static search artifacts with on-demand shard loading
- Optional Ask AI integration through a separate Cloudflare Worker
- Multilingual docs support when configured

## Daily Authoring Flow

Create a page scaffold:

```bash
npm run typematter -- new --all-languages --slug guides/install --title.en "Install" --title.cn "安装" --section.en "Guides" --section.cn "指南"
```

For a single language:

```bash
npm run typematter -- new --lang en --slug guides/install --title "Install" --section "Guides"
```

Then:

1. Replace the generated placeholder content.
2. Link to real routes or external URLs only.
3. Add the page to `nav.config.ts` if it should be pinned in the sidebar.
4. Run `npm run validate:docs`.
5. Run `npm run dev` for local review.

Navigation rule of thumb: MDX files create pages; frontmatter and folders provide metadata and hierarchy; `nav.config.ts` controls grouping, order, visibility, and appended discovered pages.

## Deployment

Typematter uses Next.js static export. A production build writes the deployable site to `out/`.

Minimum production environment:

```bash
TYPEMATTER_SITE_URL=https://docs.example.com
NEXT_PUBLIC_SITE_URL=https://docs.example.com
```

Ask AI is optional:

```bash
NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT=https://your-worker-domain.workers.dev
NEXT_PUBLIC_TYPEMATTER_ASK_AI_TIMEOUT_MS=25000
# NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENABLED=false
```

Production checklist:

```bash
cp .env.example .env.local
npm run validate:docs
npm run build
npm start
```

Deploy the `out/` directory to any static host:

- Vercel: build command `npm run build`, output directory `out`
- Cloudflare Pages: build command `npm run build`, output directory `out`
- Nginx, S3, R2, OSS, or any plain static file host: upload `out/`

Build artifacts:

- `out/`: deploy this directory
- `.typematter/registry.json`: build registry cache
- `public/typematter/search/`: source search assets before export
- `out/typematter/search/`: deployed search assets
- `out/typematter/ask-index.json`: deployed Ask AI retrieval index
- `out/robots.txt` and `out/sitemap.xml`: generated from `TYPEMATTER_SITE_URL`

`TYPEMATTER_SITE_URL` is required for production correctness. If it is missing, generated `robots.txt` and `sitemap.xml` fall back to the example domain.

## Starter Repository Model

Use this structure for your own docs project:

```text
my-docs/
  content/
    en/
      index.mdx
      get-started/
        quickstart.mdx
    cn/
      index.mdx
  site.config.ts
  nav.config.ts
  components/
  lib/
  app/
```

Edit `content/`, `site.config.ts`, and `nav.config.ts` first. Treat `app/`, `components/`, and `lib/` as the docs shell unless you are extending Typematter itself. Do not edit generated `out/`, `.typematter/`, or `public/typematter/` artifacts by hand.

## Ask AI

Ask AI is disabled unless a public endpoint is configured. The static docs site does not depend on it.

Reference Worker:

- `integrations/cloudflare-ask-ai-worker/src/index.ts`
- `integrations/cloudflare-ask-ai-worker/wrangler.toml`
- `integrations/cloudflare-ask-ai-worker/README.md`

Endpoint behavior:

- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT` enables the UI.
- `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENABLED=false` forces it off.
- `TYPEMATTER_SITE_URL` helps crawlers and Cloudflare AI Search discover the generated sitemap.

## Validation

Run:

```bash
npm run validate:docs
```

The validator checks:

- Broken internal links and heading anchors
- Duplicate titles and duplicate routes
- Orphan pages and missing nav entries
- Invalid or incomplete frontmatter
- Empty directories
- i18n structure and missing translations
- Heading depth and skipped heading levels
- Doc-type conventions and recommended semantic components

The build runs validation before export, so content issues fail early.

## Architecture Guardrails

- MDX is the source of truth.
- Content is parsed at build time into structured data.
- Runtime code should only render static data and handle lightweight UI.
- Navigation and ordering come from content directories, metadata, and `nav.config.ts`.
- New MDX components should update the component registry, detector, and shared styles.
- Output must stay static, cacheable, and rollback-friendly.

## Troubleshooting

- `robots.txt` or `sitemap.xml` points to `example.com`: set `TYPEMATTER_SITE_URL` before `npm run build`.
- `npm run build` fails on orphan pages or broken links: run `npm run validate:docs` and fix the reported content issue.
- You want a clean project instead of the official demo content: run `npm run typematter -- init --dir ../my-docs` from this repo root.
- Ask AI is missing: set `NEXT_PUBLIC_TYPEMATTER_ASK_AI_ENDPOINT` and rebuild.
