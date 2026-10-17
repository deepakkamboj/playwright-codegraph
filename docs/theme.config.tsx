import React from "react";
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 750 }} translate="no">
      playwright-<span style={{ color: "#5b7cfa" }}>codegraph</span>
    </span>
  ),
  project: {
    link: "https://github.com/deepakkamboj/playwright-codegraph",
  },
  docsRepositoryBase:
    "https://github.com/deepakkamboj/playwright-codegraph/tree/main/docs",
  footer: {
    content: (
      <span>
        Deterministic quality intelligence · MIT ·{" "}
        <a href="https://github.com/deepakkamboj/playwright-codegraph">
          GitHub
        </a>
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#4263eb" />
      <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`} type="image/svg+xml" />
      <meta
        name="description"
        content="Deterministic scenario coverage and code-change-based unit and Playwright test selection for TypeScript monorepos."
      />
    </>
  ),
  color: { hue: 228, saturation: 82 },
  darkMode: true,
};

export default config;
