# Playwright CodeGraph Documentation Site

Nextra 3 documentation site for **playwright-codegraph**, statically exported
for GitHub Pages.

**Target site:** https://deepakkamboj.github.io/playwright-codegraph/

## Develop

```bash
cd docs
npm install
npm run dev            # http://localhost:3000
```

## Build (static export)

```bash
# basePath is required for a GitHub project Pages site
NEXT_PUBLIC_BASE_PATH=/playwright-codegraph npm run build
# static site is emitted to docs/out/
```

## Structure

- `pages/*.mdx` — MDX content (Nextra pages router) with `_meta.js` for navigation order
- `components/` — landing page, diagrams, install commands, and reusable content cards
- `public/` — product diagrams and report imagery
- `theme.config.tsx` — Nextra docs theme configuration
- `styles/custom.css` — product landing-page styling layered on the theme

## Deploy

Configure GitHub Pages to build this folder with
`NEXT_PUBLIC_BASE_PATH=/playwright-codegraph` and publish `docs/out`.
