import React from "react";
import Link from "next/link";
import Diagram from "./Diagram";
import { Features, Feature } from "./Features";
import { Cards, Card } from "./Cards";
import { PackageInstall } from "./PackageInstall";
import { HeroGraph } from "./HeroGraph";
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
    "https://img.shields.io/badge/npm-v0.1.0-cb3837?logo=npm&logoColor=white",
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
        <img
          className="das-product-logo"
          src={asset("/playwright-codegraph-logo.svg")}
          alt="Playwright CodeGraph: Change to Scenario to Test"
          width={920}
          height={430}
        />
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
        <HeroGraph />
      </section>

      <PackageInstall packages={["playwright-codegraph"]} dev />

      <div className="das-stat-row" aria-label="Product capabilities">
        {stats.map(([number, label]) => (
          <div className="das-stat" key={label}>
            <div className="n">{number}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <section className="product-section">
        <p className="section-kicker">Why Teams Choose CodeGraph</p>
        <h2>Move Faster Without Trading Away Confidence</h2>
        <p className="section-lead">
          Replace slow, indiscriminate test runs and manual QA triage with evidence-backed impact
          analysis that every developer, tester, and release owner can understand.
        </p>
        <div className="value-grid">
          <article className="value-card">
            <span className="value-number">01</span>
            <h3>Shorter Pull Request Feedback</h3>
            <p>Prioritize only the unit and Playwright tests connected to the actual change.</p>
          </article>
          <article className="value-card">
            <span className="value-number">02</span>
            <h3>Journey-Level Confidence</h3>
            <p>See which customer flows changed, which scenarios prove them, and where gaps remain.</p>
          </article>
          <article className="value-card">
            <span className="value-number">03</span>
            <h3>Safety You Can Audit</h3>
            <p>Inspect every selection reason and automatically run everything when evidence is incomplete.</p>
          </article>
        </div>
      </section>

      <section className="product-section how-section">
        <p className="section-kicker">How It Works</p>
        <h2>From Code Change to Trusted Result</h2>
        <div className="how-grid">
          <div className="how-step">
            <span>1</span>
            <div><h3>Map</h3><p>Build a deterministic graph of Git changes, packages, source dependencies, scenarios, and tests.</p></div>
          </div>
          <div className="how-step">
            <span>2</span>
            <div><h3>Select</h3><p>Create one explainable plan for affected unit, integration, API, and Playwright coverage.</p></div>
          </div>
          <div className="how-step">
            <span>3</span>
            <div><h3>Prove</h3><p>Run the plan, expose gaps, compare against full execution, and publish portable evidence.</p></div>
          </div>
        </div>
      </section>

      <section className="product-section">
        <p className="section-kicker">Product Capabilities</p>
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
      </section>

      <section className="product-section">
        <p className="section-kicker">One Product, Shared Value</p>
        <h2>Built for the Whole Delivery Team</h2>
        <div className="persona-grid">
          <article>
            <h3>Developers</h3>
            <p>Get fast PR feedback with an exact explanation of why each test matters.</p>
          </article>
          <article>
            <h3>QA &amp; Test Platform</h3>
            <p>Manage scenario coverage, negative paths, safety policies, and test debt in one model.</p>
          </article>
          <article>
            <h3>Engineering Leaders</h3>
            <p>Measure fallback rates, missed failures, journey risk, and CI savings with real evidence.</p>
          </article>
        </div>
      </section>

      <section className="product-section">
      <p className="section-kicker">Learn &amp; Evaluate</p>
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
      </section>

      <section className="product-section report-proof">
        <p className="section-kicker">See the Evidence</p>
        <h2>One Quality View for Every Change</h2>
        <p className="section-lead">
          Developers and QA share the same picture of changed code, affected journeys, selected
          tests, execution results, and safety history.
        </p>
      <Diagram
        src="/codegraph-quality-report.png"
        alt="Playwright CodeGraph report showing report navigation, quality metrics, changed-code impact, scenario workflow coverage, and execution evidence."
        caption="One standalone report for pull-request impact, scenario coverage, selected tests, CI execution, and safety evidence."
      />
      </section>

      <section className="closing-cta">
        <p className="section-kicker">Start With Your Existing Tests</p>
        <h2>Make Every Pull Request Faster and Easier to Trust</h2>
        <p>No replacement runner. No AI-only skipping. No unexplained empty plans.</p>
        <div className="das-cta">
          <Link className="das-btn primary" href="/getting-started">Install CodeGraph</Link>
          <Link className="das-btn ghost" href="/architecture">Review the Architecture</Link>
        </div>
      </section>
    </div>
  );
}
