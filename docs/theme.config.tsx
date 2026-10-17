import React from "react";
import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 750 }} translate="no">
      <img
        src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/playwright-codegraph-mark.svg`}
        alt=""
        aria-hidden="true"
        width="32"
        height="32"
      />
      <span>
        playwright-<span style={{ color: "#9a5b3b" }}>codegraph</span>
      </span>
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
      <meta name="theme-color" content="#f7eadf" />
      <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg`} type="image/svg+xml" />
      <meta
        name="description"
        content="Deterministic scenario coverage and code-change-based unit and Playwright test selection for TypeScript monorepos."
      />
    </>
  ),
  color: { hue: 24, saturation: 52 },
  darkMode: true,
};

export default config;
