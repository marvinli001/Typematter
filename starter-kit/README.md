# My Docs

This is a Typematter starter project: a static MDX documentation app you can keep in Git and deploy as plain static files.

## Start locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Create pages

Create a page for every configured language:

```bash
npm run typematter -- new --all-languages --slug guides/install --title.en "Install" --title.cn "安装" --section.en "Guides" --section.cn "指南"
```

Or create one language at a time:

```bash
npm run typematter -- new --lang en --slug guides/install --title "Install" --section "Guides"
```

Then edit the generated MDX under `content/`.

## Configure

1. Edit `site.config.ts` for title, site URL, i18n, repository links, feedback, and optional Ask AI copy.
2. Edit `nav.config.ts` for sidebar grouping, order, hidden items, and external links.
3. Replace the sample pages under `content/`.
4. Set `TYPEMATTER_SITE_URL` before production builds.

MDX files create pages. `nav.config.ts` curates how discovered pages appear in the UI.

## Validate and build

```bash
npm run validate:docs
npm run build
npm start
```

Deploy the generated `out/` directory to Vercel, Cloudflare Pages, Nginx, S3, R2, OSS, or any static file host.

## Repository model

- Keep this generated starter in its own Git repository.
- Treat the official Typematter repository as the upstream docs shell and demo.
- Do not hand-edit generated `out/`, `.typematter/`, or `public/typematter/` files; update content/config and rebuild.
