import React from "react";
import Link from "next/link";
import Diagram from "./Diagram";
import { Features, Feature } from "./Features";
import { Cards, Card } from "./Cards";
import { PackageInstall } from "./PackageInstall";
import { asset } from "./base";
import {
  BookIcon,
  EyeIcon,
  GearIcon,
  LayersIcon,
  LoopIcon,
  RocketIcon,
  ShieldIcon,
  TerminalIcon,
} from "./icons";

const badges: [string, string, string, number][] = [
  [
    "npm version",
    "https://img.shields.io/npm/v/playwright-codegraph?logo=npm&color=cb3837",
    "https://www.npmjs.com/package/playwright-codegraph",
    110,
  ],
  [
    "CI status",
    "https://github.com/deepakkamboj/playwright-codegraph/actions/workflows/ci.yml/badge.svg",
    "https://github.com/deepakkamboj/playwright-codegraph/actions/workflows/ci.yml",
    92,
  ],
  [
    "MIT license",
    "https://img.shields.io/badge/License-MIT-green.svg",
    "https://github.com/deepakkamboj/playwright-codegraph/blob/main/LICENSE",
    82,
  ],
  [
    "Node.js 20 and 22",
    "https://img.shields.io/badge/Node.js-20%20%7C%2022-339933?logo=nodedotjs&logoColor=white",
    "https://nodejs.org",
    128,
  ],
  [
    "Playwright supported",
    "https://img.shields.io/badge/Playwright-supported-2EAD33?logo=playwright&logoColor=white",
    "https://playwright.dev",
    145,
  ],
];

const stats: [string, string][] = [
  ["5", "Scenario classes"],
  ["8", "Report themes"],
  ["3", "Deployment models"],
  ["2", "Test layers"],
];

export default function Home() {
  return (
    <div className="das-home">
      <section className="das-hero">
        <p className="das-kicker">Deterministic Test Impact &amp; Scenario Coverage</p>
        <h1>Run the smallest test set you can prove is safe</h1>
        <p className="das-tagline">
          Map every code change to customer journeys, user scenarios, and the unit or Playwright
          tests that prove them. When evidence is incomplete, CodeGraph fails open to the full
          suite.
        </p>
        <div className="das-badges" aria-label="Project status">
          {badges.map(([alt, src, href, width]) => (
            <a key={alt} href={href} target="_blank" rel="noreferrer">
              <img alt={alt} src={src} width={width} height={22} />
            </a>
          ))}
        </div>
        <div className="das-cta">
          <Link className="das-btn primary" href="/getting-started">
            Install CodeGraph
          </Link>
          <a className="das-btn ghost" href={asset("/codegraph-quality-report-sample.html")}>
            Open Sample Report
          </a>
        </div>
      </section>

      <PackageInstall packages={["playwright-codegraph", "@colbymchenry/codegraph"]} dev />

      <div className="das-stat-row" aria-label="Product capabilities">
        {stats.map(([number, label]) => (
          <div className="das-stat" key={label}>
            <div className="n">{number}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <h2>Quality Intelligence You Can Explain</h2>
      <Features>
        <Feature icon={<LayersIcon />} title="Code change to customer impact">
          Connect Git changes, Rush package dependencies, source reachability, customer journeys,
          scenarios, and tests in one deterministic graph.
        </Feature>
        <Feature icon={<ShieldIcon />} title="Fail-open selection">
          Missing graphs, unknown files, scenario gaps, incomplete history, and tool failures expand
          to full execution instead of silently dropping tests.
        </Feature>
        <Feature icon={<LoopIcon />} title="Scenario workflow coverage">
          Model happy, positive, negative, edge, and corner paths with explicit dependencies and
          ordered journey diagrams.
        </Feature>
        <Feature icon={<TerminalIcon />} title="Unit and Playwright orchestration">
          Select and execute both test layers from one canonical plan with a reason for every test.
        </Feature>
        <Feature icon={<EyeIcon />} title="Rich standalone reporting">
          Share PR impact, scenario coverage, code graphs, execution, shadow, and replay evidence in
          one CSP-protected HTML file.
        </Feature>
        <Feature icon={<GearIcon />} title="Portable deployment">
          Run the deterministic data plane in local, cloud-connected, hybrid, or disconnected
          on-prem environments without uploading source code.
        </Feature>
      </Features>

      <h2>Explore the Product</h2>
      <Cards cols={2}>
        <Card icon={<RocketIcon />} title="Getting Started" href="/getting-started">
          Install the CLI, build the graph, create scenarios, and run your first selective plan.
        </Card>
        <Card icon={<LoopIcon />} title="Scenarios &amp; Journeys" href="/scenarios">
          Define scenario taxonomy, dependencies, code paths, and test annotations.
        </Card>
        <Card icon={<TerminalIcon />} title="Affected-Test Selection" href="/selection">
          Understand change detection, safety expansion, planning, execution, and shadow mode.
        </Card>
        <Card icon={<EyeIcon />} title="Quality Reports" href="/reporting">
          Explore the AI Reporter-aligned dashboard, impact graphs, workflows, and artifacts.
        </Card>
        <Card icon={<LayersIcon />} title="Architecture" href="/architecture">
          Review deterministic boundaries, graph layers, artifacts, and trust guarantees.
        </Card>
        <Card icon={<BookIcon />} title="Deployment" href="/deployment">
          Compare cloud, hybrid, and on-prem operating models and security boundaries.
        </Card>
      </Cards>

      <Diagram
        src="/codegraph-quality-report.png"
        alt="Playwright CodeGraph report showing report navigation, quality metrics, changed-code impact, scenario workflow coverage, and execution evidence."
        caption="One standalone report for pull-request impact, scenario coverage, selected tests, CI execution, and safety evidence."
      />
    </div>
  );
}
