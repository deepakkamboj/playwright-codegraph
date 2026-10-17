import fs from 'node:fs';
import path from 'node:path';

import type { ScenarioCoverageReport, SelectionPlan } from './types.js';

export interface HtmlReportOptions {
  readonly artifactDirectory: string;
  readonly outputFile: string;
  readonly title?: string;
}

interface ExecutionArtifact {
  readonly mode: string;
  readonly exitCode: number;
  readonly environment?: {
    readonly runner: string;
    readonly platform: string;
    readonly architecture: string;
    readonly nodeVersion: string;
  };
  readonly commands: readonly {
    readonly kind: string;
    readonly executable: string;
    readonly args: readonly string[];
    readonly exitCode: number;
  }[];
}

interface ShadowArtifact {
  readonly missedFailure: boolean;
  readonly selective: ExecutionArtifact;
  readonly full: ExecutionArtifact;
}

interface ReplayArtifact {
  readonly records: number;
  readonly selectivePasses: number;
  readonly fullFailures: number;
  readonly missedFailures: number;
  readonly fallbackRuns: number;
}

interface ReportArtifacts {
  readonly plan: SelectionPlan | undefined;
  readonly scenarios: ScenarioCoverageReport | undefined;
  readonly execution: ExecutionArtifact | undefined;
  readonly shadow: ShadowArtifact | undefined;
  readonly replay: ReplayArtifact | undefined;
}

export function generateHtmlReport(options: HtmlReportOptions): void {
  const artifacts = loadArtifacts(options.artifactDirectory);
  if (Object.values(artifacts).every((artifact) => artifact === undefined)) {
    throw new Error(`No report artifacts found in ${options.artifactDirectory}`);
  }
  const html = renderReport(options.title ?? 'CodeGraph Quality Report', artifacts);
  fs.mkdirSync(path.dirname(options.outputFile), { recursive: true });
  fs.writeFileSync(options.outputFile, html);
}

function loadArtifacts(directory: string): ReportArtifacts {
  return {
    plan: readOptionalJson(path.join(directory, 'plan.json'), isSelectionPlan),
    scenarios: readOptionalJson(path.join(directory, 'scenario-coverage.json'), isScenarioCoverageReport),
    execution: readOptionalJson(path.join(directory, 'execution.json'), isExecutionArtifact),
    shadow: readOptionalJson(path.join(directory, 'shadow.json'), isShadowArtifact),
    replay: readOptionalJson(path.join(directory, 'replay.json'), isReplayArtifact),
  };
}

function readOptionalJson<T>(file: string, validate: (value: unknown) => value is T): T | undefined {
  if (!fs.existsSync(file)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Could not parse report artifact ${file}: ${message(error)}`);
  }
  if (!validate(parsed)) throw new Error(`Invalid report artifact: ${file}`);
  return parsed;
}

function renderReport(title: string, artifacts: ReportArtifacts): string {
  const plan = artifacts.plan;
  const scenarios = artifacts.scenarios;
  const execution = artifacts.execution;
  const selectedTests = plan?.tests.length ?? 0;
  const scenarioCount = scenarios?.entries.length ?? 0;
  const scenarioGaps = scenarios?.gaps.length ?? 0;
  const executionPassed = execution ? execution.exitCode === 0 : undefined;
  const overallStatus =
    scenarioGaps > 0 || executionPassed === false || artifacts.shadow?.missedFailure
      ? 'Action required'
      : plan?.mode === 'full' && (plan.fullRunReasons.length ?? 0) > 0
        ? 'Safe fallback'
        : 'Ready';
  const coveredScenarios = Math.max(0, scenarioCount - scenarioGaps);
  const scenarioReadiness = scenarioCount > 0 ? `${Math.round((coveredScenarios / scenarioCount) * 100)}%` : 'N/A';
  return `<!doctype html>
<html lang="en" data-theme="default">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtml(title)}</title>
  <style>
    :root,[data-theme="default"] { color-scheme:light; --bg:#fffaf5; --panel:#fffdf9; --card:#f6e9df; --muted:#6b5a50; --text:#3f332d; --line:#d8bca7; --accent:#9a5b3b; --accent-hover:#7d472e; --accent-fg:#ffffff; --hover:#f3ded0; --good:#2f855a; --warn:#9a5b3b; --bad:#b3343b; --hero-a:#7d472e; --hero-b:#9a5b3b; --hero-fg:#ffffff; }
    [data-theme="aquatic"] { color-scheme:light; --bg:#ecfeff; --panel:#ffffff; --card:#f0fdff; --muted:#0e7490; --text:#164e63; --line:#a5f3fc; --accent:#0369a1; --accent-hover:#075985; --accent-fg:#ffffff; --hover:#cffafe; --good:#0f766e; --warn:#b45309; --bad:#be123c; --hero-a:#075985; --hero-b:#0891b2; --hero-fg:#ffffff; }
    [data-theme="forest"] { color-scheme:light; --bg:#f0fdf4; --panel:#ffffff; --card:#f7fef9; --muted:#166534; --text:#14532d; --line:#bbf7d0; --accent:#15803d; --accent-hover:#166534; --accent-fg:#ffffff; --hover:#dcfce7; --good:#15803d; --warn:#a16207; --bad:#b91c1c; --hero-a:#14532d; --hero-b:#16a34a; --hero-fg:#ffffff; }
    [data-theme="sunset"] { color-scheme:light; --bg:#fff7ed; --panel:#ffffff; --card:#fffbf5; --muted:#9a3412; --text:#7c2d12; --line:#fed7aa; --accent:#c2410c; --accent-hover:#9a3412; --accent-fg:#ffffff; --hover:#ffedd5; --good:#15803d; --warn:#a16207; --bad:#b91c1c; --hero-a:#9a3412; --hero-b:#ea580c; --hero-fg:#ffffff; }
    [data-theme="midnight"] { color-scheme:dark; --bg:#030712; --panel:#111827; --card:#182235; --muted:#9ca3af; --text:#f9fafb; --line:#374151; --accent:#818cf8; --accent-hover:#a5b4fc; --accent-fg:#0f172a; --hover:#1f2937; --good:#34d399; --warn:#fbbf24; --bad:#fb7185; --hero-a:#111827; --hero-b:#312e81; --hero-fg:#f9fafb; }
    [data-theme="corporate"] { color-scheme:light; --bg:#f8fafc; --panel:#ffffff; --card:#f8fafc; --muted:#475569; --text:#0f172a; --line:#cbd5e1; --accent:#334155; --accent-hover:#1e293b; --accent-fg:#ffffff; --hover:#e2e8f0; --good:#15803d; --warn:#b45309; --bad:#b91c1c; --hero-a:#0f172a; --hero-b:#334155; --hero-fg:#ffffff; }
    [data-theme="hc-black"] { color-scheme:dark; --bg:#000000; --panel:#0d0d0d; --card:#1a1a1a; --muted:#d1d5db; --text:#ffffff; --line:#ffffff; --accent:#ffff00; --accent-hover:#ffff66; --accent-fg:#000000; --hover:#1a1a1a; --good:#55efc4; --warn:#ffd93d; --bad:#ff6b6b; --hero-a:#000000; --hero-b:#000000; --hero-fg:#ffffff; }
    [data-theme="hc-white"] { color-scheme:light; --bg:#ffffff; --panel:#ffffff; --card:#f5f5f5; --muted:#333333; --text:#000000; --line:#000000; --accent:#00008b; --accent-hover:#000066; --accent-fg:#ffffff; --hover:#e5e5e5; --good:#006400; --warn:#7a4a00; --bad:#a40000; --hero-a:#ffffff; --hero-b:#ffffff; --hero-fg:#000000; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); line-height:1.5; font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
    h1,h2,h3 { line-height:1.2; }
    h2 { margin-top:0; }
    button,select,input { font:inherit; }
    button { cursor:pointer; }
    code,.mono { font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; }
    code { color:var(--accent); overflow-wrap:anywhere; }
    .muted { color:var(--muted); }
    .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
    :focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
    [hidden] { display:none!important; }
    .skip-link { position:fixed; top:-100px; left:12px; z-index:300; padding:12px; background:var(--panel); color:var(--accent); }
    .skip-link:focus { top:12px; }
    .report-navigation { padding:20px max(24px,calc((100% - 1400px)/2)) 0; background:var(--panel); border-bottom:1px solid var(--line); display:grid; grid-template-areas:"brand tools" "nav nav"; grid-template-columns:minmax(0,1fr) auto; gap:20px; }
    .brand { grid-area:brand; display:flex; gap:10px; align-items:center; }
    .brand-mark { width:38px; height:38px; display:grid; place-items:center; background:var(--accent); color:var(--accent-fg); font-family:ui-monospace,Consolas,monospace; font-weight:800; }
    .brand-title { display:block; }
    .brand-sub { margin:3px 0 0; color:var(--muted); font-size:.75rem; }
    .workspace-tools { grid-area:tools; display:flex; align-items:center; flex-wrap:wrap; gap:10px; font-size:.75rem; }
    .theme-select,.btn,#test-filter { border:1px solid var(--muted); background:var(--panel); color:var(--text); border-radius:4px; padding:8px 11px; }
    .btn { display:inline-flex; align-items:center; justify-content:center; font-weight:650; }
    .btn:hover,.theme-select:hover { border-color:var(--accent); background:var(--hover); }
    .copy-status { min-width:4.5rem; color:var(--muted); }
    .tabs { grid-area:nav; display:flex; flex-wrap:wrap; gap:8px 24px; overflow-x:auto; }
    .tab { display:flex; align-items:center; gap:8px; padding:12px 8px; border:0; border-bottom:3px solid transparent; background:transparent; color:var(--muted); font-size:.83rem; font-weight:650; white-space:nowrap; }
    .tab:hover { background:var(--hover); color:var(--text); }
    .tab[aria-selected="true"] { border-bottom-color:var(--accent); color:var(--accent); }
    .count { padding:1px 8px; border-radius:999px; background:var(--card); font-size:.7rem; }
    .count-fail { background:var(--bad); color:#fff; }
    .page { max-width:1480px; margin:0 auto; padding:36px 40px; min-width:0; }
    .run-header { margin-bottom:30px; padding-bottom:20px; border-bottom:1px solid var(--line); }
    .run-header h1 { margin:6px 0 8px; font-size:clamp(1.7rem,3vw,2.4rem); letter-spacing:-.04em; overflow-wrap:anywhere; }
    .run-header p { margin:4px 0; }
    .eyebrow { color:var(--muted); font-size:.68rem; font-weight:750; letter-spacing:.12em; text-transform:uppercase; }
    .run-time { color:var(--muted); font-family:ui-monospace,Consolas,monospace; font-size:.75rem; overflow-wrap:anywhere; }
    .page .tab-panel { margin:0; padding:0; background:transparent; border:0; }
    .page-foot { padding:26px 16px 36px; color:var(--muted); font-size:.8rem; text-align:center; }
    .panel { background:var(--panel); border:1px solid var(--line); border-radius:3px; }
    .panel { padding:18px 20px; margin-bottom:18px; }
    .panel h2,.panel h3,.panel h4 { margin-top:0; }
    .good { color:var(--good); }
    .warn { color:var(--warn); }
    .bad { color:var(--bad); }
    .pill { display:inline-block; padding:.15rem .55rem; margin:.1rem; border:1px solid var(--line); border-radius:999px; font-size:.82rem; }
    .toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
    table { width:100%; border-collapse:collapse; margin-top:.75rem; }
    th,td { padding:.65rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-size:.78rem; letter-spacing:.04em; text-transform:uppercase; }
    tbody tr:hover { background:var(--hover); }
    .scroll { overflow-x:auto; }
    .empty { padding:1rem; border:1px dashed var(--line); color:var(--muted); }
    #test-filter { width:min(100%,32rem); }
    .nav-icon { flex:none; }
    .nav-icon svg,.section-icon svg,.outcome-icon svg { display:block; width:20px; height:20px; }
    .run-brief { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:32px; padding:8px 0 28px; }
    .run-brief #brief-title { max-width:650px; margin:12px 0; font-family:Georgia,"Times New Roman",serif; font-size:clamp(1.8rem,3vw,2.7rem); font-weight:500; letter-spacing:-.025em; line-height:1.15; }
    .run-brief p:not(.eyebrow) { max-width:640px; color:var(--muted); font-size:.9rem; }
    .brief-measure { display:flex; flex-direction:column; justify-content:center; gap:8px; padding-left:30px; border-left:1px solid var(--line); color:var(--muted); font-size:.8rem; }
    .readiness-ring { --readiness:0%; display:grid; place-items:center; width:150px; aspect-ratio:1; margin:4px 0; border-radius:50%; background:conic-gradient(var(--good) var(--readiness),var(--card) 0); }
    .readiness-ring::before { content:""; grid-area:1/1; width:116px; aspect-ratio:1; border-radius:50%; background:var(--panel); }
    .readiness-ring strong { z-index:1; grid-area:1/1; color:var(--accent); font-family:ui-monospace,Consolas,monospace; font-size:2.4rem; font-weight:500; letter-spacing:-.07em; line-height:1.1; }
    .btn-primary { border-color:var(--accent); background:var(--accent); color:var(--accent-fg); text-decoration:none; }
    .btn-primary:hover { background:var(--accent-hover); color:var(--accent-fg); }
    .outcome-tiles { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; margin:0 0 34px; }
    .outcome-tiles-auto { grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
    .outcome-tile { --tile-accent:var(--accent); padding:18px; border:1px solid var(--line); border-top:3px solid var(--tile-accent); border-radius:5px; background:var(--panel); background:linear-gradient(120deg,var(--panel) 12%,color-mix(in srgb,var(--tile-accent) 10%,var(--panel))); box-shadow:0 1px 2px rgb(0 0 0/.1); }
    .outcome-tile dt { display:flex; align-items:center; gap:10px; font-size:.72rem; font-weight:650; letter-spacing:.04em; text-transform:uppercase; }
    .outcome-tile dd { margin:14px 0 0; font-family:ui-monospace,Consolas,monospace; font-size:2.2rem; line-height:1.2; }
    .outcome-tile small { display:block; margin-top:8px; color:var(--muted); font: .72rem ui-sans-serif,system-ui,sans-serif; }
    .outcome-icon { display:grid; flex:none; place-items:center; width:22px; height:22px; color:var(--tile-accent); }
    .outcome-good { --tile-accent:var(--good); }
    .outcome-warn { --tile-accent:var(--warn); }
    .outcome-bad { --tile-accent:var(--bad); }
    .outcome-muted { --tile-accent:var(--muted); }
    .chart-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; margin:0 0 34px; }
    .chart-card { min-width:0; margin:0; padding:20px; border:1px solid var(--line); border-radius:5px; background:var(--panel); box-shadow:0 1px 2px rgb(0 0 0/.08); }
    .chart-card figcaption { margin-bottom:18px; }
    .chart-card figcaption strong,.chart-card figcaption span { display:block; }
    .chart-card figcaption span { margin-top:3px; color:var(--muted); font-size:.76rem; }
    .bar-chart { display:grid; gap:14px; }
    .bar-row { display:grid; grid-template-columns:minmax(110px,.8fr) minmax(120px,2fr) auto; align-items:center; gap:12px; font-size:.78rem; }
    .bar-track { height:10px; overflow:hidden; border-radius:999px; background:var(--card); }
    .bar-fill { width:var(--bar-width); height:100%; border-radius:inherit; background:var(--accent); }
    .bar-fill.good { background:var(--good); }
    .bar-fill.warn { background:var(--warn); }
    .bar-fill.bad { background:var(--bad); }
    .bar-value { min-width:2ch; color:var(--text); font-family:ui-monospace,Consolas,monospace; font-weight:700; text-align:right; }
    .section-heading { display:grid; grid-template-columns:24px minmax(0,1fr); align-items:start; gap:12px; position:relative; margin:24px 0 16px; }
    .panel .section-heading,.tab-panel>.section-heading:first-child { margin-top:0; }
    .section-title h2,.section-title h3 { margin:0 0 3px; font-size:1rem; font-weight:650; line-height:1.4; }
    .section-title p { margin:0; color:var(--muted); font-size:.76rem; }
    .section-icon { padding-top:2px; color:var(--accent); }
    .investigation-grid { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(0,1fr); gap:22px; }
    .investigation-grid>.panel { min-width:0; border-top:3px solid var(--accent); }
    .settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
    .settings-grid .panel { margin:0; }
    .settings-actions { display:flex; flex-wrap:wrap; gap:10px; }
    .environment-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:0 0 24px; }
    .environment-grid>div { min-width:0; padding:14px; border:1px solid var(--line); background:var(--card); }
    .environment-grid dt { color:var(--muted); font-size:.7rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
    .environment-grid dd { margin:5px 0 0; overflow-wrap:anywhere; font-family:ui-monospace,Consolas,monospace; font-size:.84rem; }
    .graph { width:100%; min-width:720px; height:auto; background:var(--card); border:1px solid var(--line); border-radius:3px; }
    .graph text { fill:var(--text); font:12px Inter,Segoe UI,Arial,sans-serif; }
    .graph .lane { fill:var(--muted); font-weight:700; text-transform:uppercase; }
    .graph .edge { stroke:var(--line); stroke-width:2; }
    .graph .node { fill:var(--panel); stroke:var(--accent); stroke-width:2; }
    .graph .changed { stroke:var(--warn); } .graph .scenario { stroke:var(--accent); } .graph .test { stroke:var(--good); }
    @media(max-width:1150px) { .outcome-tiles { grid-template-columns:repeat(3,minmax(0,1fr)); } .investigation-grid { grid-template-columns:1fr; } }
    @media(max-width:1000px) { .settings-grid,.chart-grid { grid-template-columns:1fr; } .environment-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media(max-width:760px) { .report-navigation { grid-template-areas:"brand" "tools" "nav"; grid-template-columns:1fr; padding-right:16px; padding-left:16px; } .workspace-tools { justify-content:flex-start; } .page { padding:28px 16px; } .run-brief { grid-template-columns:1fr; gap:20px; } .brief-measure { padding:20px 0 0; border-top:1px solid var(--line); border-left:0; } .outcome-tiles { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media(max-width:640px) { .outcome-tiles,.environment-grid { grid-template-columns:1fr; } .tab { padding:10px 6px; } .bar-row { grid-template-columns:1fr auto; } .bar-track { grid-column:1/-1; grid-row:2; } }
    @media(prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } *,*::before,*::after { transition-duration:.01ms!important; animation-duration:.01ms!important; animation-iteration-count:1!important; } }
    @media(forced-colors:active) { .brand-mark,.count-fail { border:1px solid ButtonText; } .graph .node { fill:Canvas; stroke:CanvasText; } }
    @media print { .tabs,.workspace-tools,.skip-link { display:none; } .tab-panel[hidden] { display:block!important; } .report-navigation { display:block; padding:0 0 18px; } .page { max-width:none; padding:24px 0; } }
  </style>
</head>
<body>
  <a class="skip-link" href="#report-content">Skip to report</a>
  <header class="report-navigation">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">CG</div>
      <div><strong class="brand-title">Playwright CodeGraph</strong><p class="brand-sub">Deterministic quality report</p></div>
    </div>
    <nav class="tabs" role="tablist" aria-label="Report sections">
      ${navigationButton('overview', 'Run brief', true)}
      ${navigationButton('pr-impact', `Impact <span class="count">${plan?.changedFiles.length ?? 0}</span>`)}
      ${navigationButton('code-graph', 'Code graph')}
      ${navigationButton('scenarios', `Scenarios <span class="count">${scenarioCount}</span>`)}
      ${navigationButton('execution', `Execution <span class="count">${execution?.commands.length ?? 0}</span>`)}
      ${navigationButton('safety', `Safety <span class="count ${artifacts.shadow?.missedFailure ? 'count-fail' : ''}">${artifacts.replay?.missedFailures ?? 0}</span>`)}
      ${navigationButton('settings', 'Settings')}
    </nav>
    <div class="workspace-tools">
      <label for="theme-select">Theme</label>
      <select id="theme-select" class="theme-select">${themeOptions()}</select>
      <button id="copy-run-brief" class="btn" type="button">Copy run brief</button>
      <span id="copy-status" class="copy-status" role="status" aria-live="polite"></span>
    </div>
  </header>
  <main id="report-content" class="page" tabindex="-1">
    <header class="run-header">
      <p class="eyebrow">Execution report / Playwright CodeGraph</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">Code change, scenario coverage, selected tests, CI execution, and safety evidence in one standalone report.</p>
      <p class="run-time">${plan ? `Input ${escapeHtml(plan.inputFingerprint)}` : 'No plan fingerprint available'} &middot; ${escapeHtml(overallStatus)}</p>
    </header>
    <section id="tab-overview" class="tab-panel" role="tabpanel" aria-labelledby="tab-overview-button" data-report-section>
      <section class="run-brief" aria-labelledby="brief-title">
        <div>
          ${sectionHeading('Run brief', 'The change, in context', 'overview')}
          <h2 id="brief-title">${escapeHtml(overallStatus === 'Ready' ? `${selectedTests} prioritized tests are ready to run.` : overallStatus === 'Safe fallback' ? 'The full suite is protecting this change.' : 'Quality evidence needs attention.')}</h2>
          <p>Start with the impact plan. Trace changed code through scenarios to the exact tests that provide evidence.</p>
          <button class="btn btn-primary" type="button" data-open-tab="pr-impact">Review impact plan &rarr;</button>
        </div>
        <div class="brief-measure">
          <span class="eyebrow">Scenario readiness</span>
          <div class="readiness-ring" style="--readiness:${scenarioCount > 0 ? Math.round((coveredScenarios / scenarioCount) * 100) : 0}%" role="img" aria-label="Scenario readiness ${escapeHtml(scenarioReadiness)}"><strong aria-hidden="true">${escapeHtml(scenarioReadiness)}</strong></div>
          <span>${coveredScenarios} of ${scenarioCount} scenarios have no reported gaps</span>
          <small>${scenarioGaps ? `${scenarioGaps} gap${scenarioGaps === 1 ? '' : 's'} require attention` : 'All declared scenarios are traceable'}</small>
        </div>
      </section>
      <dl class="outcome-tiles" aria-label="CodeGraph run metrics">
        ${outcomeTile('Changed files', String(plan?.changedFiles.length ?? 0), 'Diff inputs', 'impact')}
        ${outcomeTile('Selected tests', String(selectedTests), 'Prioritized evidence', 'execution', 'good')}
        ${outcomeTile('Scenarios', String(scenarioCount), 'Journey coverage', 'scenarios')}
        ${outcomeTile('Coverage gaps', String(scenarioGaps), scenarioGaps ? 'Action required' : 'No gaps reported', 'safety', scenarioGaps ? 'bad' : 'good')}
        ${outcomeTile('Fallback runs', String(artifacts.replay?.fallbackRuns ?? 0), 'Historical safety', 'fallback', (artifacts.replay?.fallbackRuns ?? 0) > 0 ? 'warn' : 'muted')}
      </dl>
      <div class="chart-grid">
        ${barChart('Selection flow', 'From changed code to runnable evidence', [
          { label: 'Changed files', value: plan?.changedFiles.length ?? 0, tone: 'accent' },
          { label: 'Scenarios', value: scenarioCount, tone: 'accent' },
          { label: 'Selected tests', value: selectedTests, tone: 'good' },
        ])}
        ${barChart('Replay safety', 'Historical outcomes that protect selective runs', [
          { label: 'Selective passes', value: artifacts.replay?.selectivePasses ?? 0, tone: 'good' },
          { label: 'Fallback runs', value: artifacts.replay?.fallbackRuns ?? 0, tone: 'warn' },
          { label: 'Missed failures', value: artifacts.replay?.missedFailures ?? 0, tone: 'bad' },
        ])}
      </div>
      ${sectionHeading('Evidence snapshot', 'Traceability and safety posture', 'evidence')}
      <div class="investigation-grid">
        <div class="panel">${sectionHeading('Run intelligence', 'Deterministic artifact identity', 'execution')}${plan ? `<p><strong>Input fingerprint</strong></p><code>${escapeHtml(plan.inputFingerprint)}</code>` : emptyState('No plan artifact was provided.')}<p><strong>Execution</strong>: <span class="${executionPassed === undefined ? '' : executionPassed ? 'good' : 'bad'}">${executionPassed === undefined ? 'Not available' : executionPassed ? 'Passed' : 'Failed'}</span></p></div>
        <div class="panel">${sectionHeading('Safety posture', 'Fail-open decisions', 'safety')}${plan?.fullRunReasons.length ? `<ul>${plan.fullRunReasons.map((reason) => `<li><strong>${escapeHtml(reason.code)}</strong>: ${escapeHtml(reason.detail)}</li>`).join('')}</ul>` : '<p class="good">No full-run fallback reason was recorded.</p>'}</div>
      </div>
    </section>
    <section id="tab-pr-impact" class="tab-panel" role="tabpanel" aria-labelledby="tab-pr-impact-button" data-report-section hidden>
      ${sectionHeading('Pull-request impact', 'Changed files, projects, and prioritized tests', 'impact')}
      <div class="panel">${renderImpact(plan)}</div>
    </section>
    <section id="tab-code-graph" class="tab-panel" role="tabpanel" aria-labelledby="tab-code-graph-button" data-report-section hidden>
      ${sectionHeading('Code graph', 'Change-to-scenario-to-test traceability', 'graph')}
      <div class="panel">${renderCodeGraph(plan, scenarios)}</div>
    </section>
    <section id="tab-scenarios" class="tab-panel" role="tabpanel" aria-labelledby="tab-scenarios-button" data-report-section hidden>
      ${sectionHeading('Scenario coverage', 'Customer journeys and dependency workflows', 'scenarios')}
      <div class="panel">${renderScenarios(scenarios)}</div>
    </section>
    <section id="tab-execution" class="tab-panel" role="tabpanel" aria-labelledby="tab-execution-button" data-report-section hidden>
      ${sectionHeading('CI execution', 'Commands, outcomes, and test layers', 'execution')}
      <div class="panel">${renderExecution(execution)}</div>
    </section>
    <section id="tab-safety" class="tab-panel" role="tabpanel" aria-labelledby="tab-safety-button" data-report-section hidden>
      ${sectionHeading('Shadow and replay safety', 'Selection reliability over time', 'safety')}
      <div class="panel">${renderSafety(artifacts.shadow, artifacts.replay)}</div>
    </section>
    <section id="tab-settings" class="tab-panel" role="tabpanel" aria-labelledby="tab-settings-button" data-report-section hidden>
      ${sectionHeading('Report settings', 'Appearance and standalone report actions', 'settings')}
      <div class="settings-grid">
        <section class="panel" aria-labelledby="appearance-title">
          <h3 id="appearance-title">Appearance</h3>
          <p class="muted">Choose a theme for this report. Your preference is saved in this browser.</p>
          <label for="settings-theme-select">Theme</label><br>
          <select id="settings-theme-select" class="theme-select">${themeOptions()}</select>
        </section>
        <section class="panel" aria-labelledby="report-actions-title">
          <h3 id="report-actions-title">Report actions</h3>
          <p class="muted">Print the complete report or restore the default light coffee theme.</p>
          <div class="settings-actions">
            <button id="print-report" class="btn btn-primary" type="button">Print report</button>
            <button id="reset-theme" class="btn" type="button">Reset theme</button>
          </div>
        </section>
      </div>
    </section>
  </main>
  <footer class="page-foot">Copyright &copy; ${new Date().getUTCFullYear()} <strong>Playwright CodeGraph</strong> &middot; Change &rarr; Scenario &rarr; Test &middot; Run only what you can prove is safe.</footer>
  <script>
    const buttons = [...document.querySelectorAll('.tab')];
    const sections = [...document.querySelectorAll('[data-report-section]')];
    const setTab = (name, updateHash = true) => {
      if (!buttons.some((button) => button.dataset.tab === name)) name = 'overview';
      for (const button of buttons) {
        const selected = button.dataset.tab === name;
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
      }
      for (const section of sections) section.hidden = section.id !== 'tab-' + name;
      if (updateHash && location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    };
    for (const [index, button] of buttons.entries()) {
      button.addEventListener('click', () => setTab(button.dataset.tab));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? buttons.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[nextIndex].focus();
        setTab(buttons[nextIndex].dataset.tab);
      });
    }
    for (const button of document.querySelectorAll('[data-open-tab]')) {
      button.addEventListener('click', () => {
        setTab(button.dataset.openTab);
        document.querySelector('#report-content')?.focus();
      });
    }
    const filter = document.querySelector('#test-filter');
    if (filter) filter.addEventListener('input', () => {
      const query = filter.value.toLowerCase();
      for (const row of document.querySelectorAll('[data-test-row]')) row.hidden = !row.textContent.toLowerCase().includes(query);
    });
    const copyButton = document.querySelector('#copy-run-brief');
    const copyStatus = document.querySelector('#copy-status');
    if (copyButton && copyStatus) copyButton.addEventListener('click', () => {
      const lines = [
        document.querySelector('.run-header h1')?.textContent ?? 'Playwright CodeGraph report',
        ...[...document.querySelectorAll('#tab-overview .outcome-tile')].map((card) => {
          const label = card.querySelector('dt')?.textContent?.trim() ?? '';
          const value = card.querySelector('dd')?.childNodes[0]?.textContent?.trim() ?? '';
          return label + ': ' + value;
        }),
      ];
      const textarea = document.createElement('textarea');
      textarea.value = lines.join('\\n');
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      copyStatus.textContent = copied ? 'Copied' : 'Copy failed';
      window.setTimeout(() => { copyStatus.textContent = ''; }, 2500);
    });
    const themeSelects = [...document.querySelectorAll('.theme-select')];
    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      for (const select of themeSelects) select.value = theme;
      try { localStorage.setItem('playwright-codegraph-theme', theme); } catch {}
    };
    if (themeSelects.length) {
      let saved = null;
      try { saved = localStorage.getItem('playwright-codegraph-theme'); } catch {}
      const available = [...themeSelects[0].options].map((option) => option.value);
      const preferred = 'default';
      applyTheme(available.includes(saved) ? saved : preferred);
      for (const select of themeSelects) select.addEventListener('change', () => applyTheme(select.value));
    }
    document.querySelector('#reset-theme')?.addEventListener('click', () => applyTheme('default'));
    document.querySelector('#print-report')?.addEventListener('click', () => window.print());
    window.addEventListener('hashchange', () => setTab(location.hash.slice(1), false));
    setTab(location.hash.slice(1), false);
  </script>
</body>
</html>
`;
}

function renderImpact(plan: SelectionPlan | undefined): string {
  if (!plan) return emptyState('No plan.json artifact was found.');
  const changes = plan.changedFiles.length
    ? `<div class="scroll"><table><thead><tr><th>Status</th><th>Source</th><th>Path</th></tr></thead><tbody>${plan.changedFiles
        .map((change) => `<tr><td>${escapeHtml(change.status)}</td><td>${escapeHtml(change.source)}</td><td><code>${escapeHtml(change.path)}</code></td></tr>`)
        .join('')}</tbody></table></div>`
    : emptyState('No changed files were recorded.');
  const tests = plan.tests.length
    ? `<label for="test-filter">Filter selected tests</label><br><input id="test-filter" type="search" placeholder="Path, project, kind, or reason"><div class="scroll"><table><thead><tr><th>Kind</th><th>Bucket</th><th>Test</th><th>Project</th><th>Reasons</th></tr></thead><tbody>${plan.tests
        .map((test) => `<tr data-test-row><td>${escapeHtml(test.kind)}</td><td>${escapeHtml(test.bucket)}</td><td><code>${escapeHtml(test.path)}</code></td><td>${escapeHtml(test.project ?? '-')}</td><td>${test.reasons.map((reason) => `<span class="pill">${escapeHtml(reason.code)}</span>`).join('')}</td></tr>`)
        .join('')}</tbody></table></div>`
    : emptyState('No tests were selected.');
  return `<dl class="outcome-tiles outcome-tiles-auto" aria-label="Pull-request impact metrics">${outcomeTile('Changed files', String(plan.changedFiles.length), 'Diff inputs', 'impact')}${outcomeTile('Changed projects', String(plan.changedProjects.length), 'Affected packages', 'graph')}${outcomeTile('Selected tests', String(plan.tests.length), 'Prioritized evidence', 'execution', 'good')}</dl><h3>Changed projects</h3><p>${plan.changedProjects.map((project) => `<span class="pill">${escapeHtml(project)}</span>`).join('') || 'None'}</p><h3>Changed files</h3>${changes}<h3>Prioritized tests</h3>${tests}`;
}

function renderCodeGraph(plan: SelectionPlan | undefined, report: ScenarioCoverageReport | undefined): string {
  if (!plan && !report) return emptyState('No plan or scenario coverage artifact was found.');
  const changed = (plan?.changedFiles ?? []).slice(0, 12);
  const scenarios = (report?.entries ?? []).slice(0, 12);
  const testPaths = [...new Set(scenarios.flatMap((entry) => entry.testFiles).concat(plan?.tests.map((test) => test.path) ?? []))]
    .sort()
    .slice(0, 12);
  const rowHeight = 58;
  const height = Math.max(changed.length, scenarios.length, testPaths.length, 1) * rowHeight + 56;
  const node = (x: number, y: number, cssClass: string, gradient: string, label: string) =>
    `<g><rect class="node ${cssClass}" x="${x}" y="${y}" width="250" height="38" rx="8" fill="url(#${gradient})"/><text x="${x + 10}" y="${y + 24}">${escapeHtml(shortLabel(label))}</text><title>${escapeHtml(label)}</title></g>`;
  const centers = (count: number) => Array.from({ length: count }, (_, index) => 42 + index * rowHeight);
  const changedY = centers(changed.length);
  const scenarioY = centers(scenarios.length);
  const testY = centers(testPaths.length);
  const edges: string[] = [];
  for (const [scenarioIndex, scenario] of scenarios.entries()) {
    for (const [fileIndex, file] of changed.entries()) {
      if (scenario.resolvedCodePaths.includes(file.path) || scenario.staticallyLinkedCodePaths.includes(file.path)) {
        edges.push(`<line class="edge" x1="270" y1="${changedY[fileIndex]! + 19}" x2="330" y2="${scenarioY[scenarioIndex]! + 19}" marker-end="url(#impact-arrow)"/>`);
      }
    }
    for (const testFile of scenario.testFiles) {
      const testIndex = testPaths.indexOf(testFile);
      if (testIndex >= 0) {
        edges.push(`<line class="edge" x1="580" y1="${scenarioY[scenarioIndex]! + 19}" x2="640" y2="${testY[testIndex]! + 19}" marker-end="url(#impact-arrow)"/>`);
      }
    }
  }
  const impactGraph = `<div class="scroll"><svg class="graph" viewBox="0 0 910 ${height}" role="img" aria-labelledby="impact-graph-title impact-graph-desc"><title id="impact-graph-title">Code change impact graph</title><desc id="impact-graph-desc">Changed files connect to covered scenarios, which connect to selected tests.</desc><defs><marker id="impact-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line)"/></marker><linearGradient id="impact-changed-gradient" x1="0" x2="1"><stop offset="0" stop-color="var(--panel)"/><stop offset="1" stop-color="var(--warn)" stop-opacity=".28"/></linearGradient><linearGradient id="impact-scenario-gradient" x1="0" x2="1"><stop offset="0" stop-color="var(--panel)"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".24"/></linearGradient><linearGradient id="impact-test-gradient" x1="0" x2="1"><stop offset="0" stop-color="var(--panel)"/><stop offset="1" stop-color="var(--good)" stop-opacity=".24"/></linearGradient></defs><text class="lane" x="20" y="25">Changed files</text><text class="lane" x="330" y="25">Scenarios</text><text class="lane" x="640" y="25">Tests</text>${edges.join('')}${changed.map((file, index) => node(20, changedY[index]!, 'changed', 'impact-changed-gradient', file.path)).join('')}${scenarios.map((scenario, index) => node(330, scenarioY[index]!, 'scenario', 'impact-scenario-gradient', scenario.title ?? scenario.scenarioId)).join('')}${testPaths.map((testFile, index) => node(640, testY[index]!, 'test', 'impact-test-gradient', testFile)).join('')}</svg></div>`;
  const truncated =
    (plan?.changedFiles.length ?? 0) > changed.length ||
    (report?.entries.length ?? 0) > scenarios.length ||
    new Set(report?.entries.flatMap((entry) => entry.testFiles) ?? []).size > testPaths.length;
  return `<dl class="outcome-tiles outcome-tiles-auto" aria-label="Code graph metrics">${outcomeTile('Changed nodes', String(changed.length), 'Files in view', 'impact')}${outcomeTile('Scenario nodes', String(scenarios.length), 'Journeys in view', 'scenarios')}${outcomeTile('Test nodes', String(testPaths.length), 'Evidence in view', 'execution', 'good')}${outcomeTile('Traceability edges', String(edges.length), 'Resolved links', 'graph')}</dl><p class="muted">Deterministic traceability from changed code through scenario coverage to tests. The graph uses only report artifacts and makes no network requests.</p>${impactGraph}${truncated ? '<p class="warn">The visual graph is limited to 12 nodes per lane; tables retain the complete data.</p>' : ''}<h3>User journey workflows</h3>${renderJourneyWorkflows(report)}`;
}

function renderJourneyWorkflows(report: ScenarioCoverageReport | undefined): string {
  if (!report?.entries.length) return emptyState('No scenario workflows were found.');
  const journeys = new Map<string, { title: string; entries: ScenarioCoverageReport['entries'][number][] }>();
  for (const entry of report.entries) {
    const id = entry.journeyId ?? 'unassigned';
    const journey = journeys.get(id) ?? { title: entry.journeyTitle ?? 'Unassigned scenarios', entries: [] };
    journey.entries.push(entry);
    journeys.set(id, journey);
  }
  return [...journeys.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([journeyId, journey], journeyIndex) => {
      const entries = journey.entries;
      const indexById = new Map(entries.map((entry, index) => [entry.scenarioId, index]));
      const width = Math.max(720, entries.length * 260 + 40);
      const dependencies = entries.flatMap((entry, index) =>
        (entry.dependsOn ?? [])
          .filter((dependency) => indexById.has(dependency))
          .map((dependency) => {
            const dependencyIndex = indexById.get(dependency)!;
            return `<line class="edge" x1="${dependencyIndex * 260 + 240}" y1="91" x2="${index * 260 + 280}" y2="91" marker-end="url(#journey-arrow-${journeyIndex})"/>`;
          }),
      );
      const nodes = entries
        .map((entry, index) => {
          const tags = (entry.tags ?? []).join(', ') || 'unclassified';
          return `<g><rect class="node scenario" x="${index * 260 + 20}" y="55" width="220" height="72" rx="10" fill="url(#journey-gradient-${journeyIndex})"/><text x="${index * 260 + 32}" y="79">${escapeHtml(shortLabel(entry.title ?? entry.scenarioId, 28))}</text><text class="lane" x="${index * 260 + 32}" y="101">${escapeHtml(shortLabel(tags, 28))}</text><text x="${index * 260 + 32}" y="119">${escapeHtml(entry.criticality ?? '-')}</text><title>${escapeHtml(`${entry.scenarioId} | ${tags} | depends on: ${(entry.dependsOn ?? []).join(', ') || 'none'}`)}</title></g>`;
        })
        .join('');
      return `<div class="card"><h4>${escapeHtml(journey.title)} <span class="pill">${escapeHtml(journeyId)}</span></h4><div class="scroll"><svg class="graph" viewBox="0 0 ${width} 155" style="min-width:${width}px" role="img" aria-label="${escapeHtml(`${journey.title} scenario dependency workflow`)}"><defs><marker id="journey-arrow-${journeyIndex}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line)"/></marker><linearGradient id="journey-gradient-${journeyIndex}" x1="0" x2="1"><stop offset="0" stop-color="var(--panel)"/><stop offset="1" stop-color="var(--accent)" stop-opacity=".24"/></linearGradient></defs>${dependencies.join('')}${nodes}</svg></div></div>`;
    })
    .join('');
}

function shortLabel(value: string, length = 34): string {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function renderScenarios(report: ScenarioCoverageReport | undefined): string {
  if (!report) return emptyState('No scenario-coverage.json artifact was found.');
  const testLinks = report.entries.reduce((total, entry) => total + entry.testFiles.length, 0);
  const staticLinks = report.entries.reduce((total, entry) => total + entry.staticallyLinkedCodePaths.length, 0);
  const runtimeFiles = report.entries.reduce((total, entry) => total + entry.observedRuntimeFiles.length, 0);
  const rows = report.entries
    .map((entry) => `<tr><td><code>${escapeHtml(entry.scenarioId)}</code>${entry.title ? `<div class="muted">${escapeHtml(entry.title)}</div>` : ''}</td><td>${(entry.tags ?? []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('') || '-'}</td><td>${escapeHtml(entry.criticality ?? '-')}</td><td>${entry.testFiles.length}</td><td>${entry.resolvedCodePaths.length}</td><td>${entry.staticallyLinkedCodePaths.length}</td><td>${entry.observedRuntimeFiles.length}</td><td class="${entry.gaps.length ? 'bad' : 'good'}">${entry.gaps.length ? escapeHtml(entry.gaps.join('; ')) : 'Covered'}</td></tr>`)
    .join('');
  return `<dl class="outcome-tiles" aria-label="Scenario coverage metrics">${outcomeTile('Scenarios', String(report.entries.length), 'Declared journeys', 'scenarios')}${outcomeTile('Test links', String(testLinks), 'Mapped evidence', 'execution', 'good')}${outcomeTile('Coverage gaps', String(report.gaps.length), report.gaps.length ? 'Action required' : 'No gaps reported', 'safety', report.gaps.length ? 'bad' : 'good')}${outcomeTile('Static links', String(staticLinks), 'CodeGraph matches', 'graph')}${outcomeTile('Runtime files', String(runtimeFiles), 'Observed evidence', 'evidence')}</dl><div class="scroll"><table><thead><tr><th>Scenario</th><th>Types</th><th>Criticality</th><th>Tests</th><th>Declared files</th><th>Static links</th><th>Runtime observed</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderExecution(execution: ExecutionArtifact | undefined): string {
  if (!execution) return emptyState('No execution.json artifact was found.');
  const environment = execution.environment
    ? `<dl class="environment-grid"><div><dt>Runner</dt><dd>${escapeHtml(execution.environment.runner)}</dd></div><div><dt>Platform</dt><dd>${escapeHtml(execution.environment.platform)}</dd></div><div><dt>Architecture</dt><dd>${escapeHtml(execution.environment.architecture)}</dd></div><div><dt>Node.js</dt><dd>${escapeHtml(execution.environment.nodeVersion)}</dd></div></dl>`
    : emptyState('The execution artifact does not include environment metadata.');
  const rows = execution.commands
    .map((command) => `<tr><td>${escapeHtml(command.kind)}</td><td><code>${escapeHtml(command.executable)}</code></td><td><code>${escapeHtml(command.args.join(' '))}</code></td><td class="${command.exitCode === 0 ? 'good' : 'bad'}">${command.exitCode}</td></tr>`)
    .join('');
  return `<dl class="outcome-tiles outcome-tiles-auto" aria-label="CI execution metrics">${outcomeTile('Mode', execution.mode, 'Selection strategy', 'execution')}${outcomeTile('Exit code', String(execution.exitCode), execution.exitCode === 0 ? 'Execution passed' : 'Execution failed', 'safety', execution.exitCode === 0 ? 'good' : 'bad')}${outcomeTile('Commands', String(execution.commands.length), 'Executed layers', 'overview')}</dl><h3>Test execution environment</h3>${environment}<h3>Executed commands</h3><div class="scroll"><table><thead><tr><th>Kind</th><th>Executable</th><th>Arguments</th><th>Exit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSafety(shadow: ShadowArtifact | undefined, replay: ReplayArtifact | undefined): string {
  const shadowView = shadow
    ? `<h3>Latest shadow execution</h3><dl class="outcome-tiles outcome-tiles-auto" aria-label="Shadow execution metrics">${outcomeTile('Selective exit', String(shadow.selective.exitCode), 'Selected test run', 'execution', shadow.selective.exitCode === 0 ? 'good' : 'bad')}${outcomeTile('Full exit', String(shadow.full.exitCode), 'Baseline suite run', 'fallback', shadow.full.exitCode === 0 ? 'good' : 'bad')}${outcomeTile('Missed failure', shadow.missedFailure ? 'Yes' : 'No', 'Selection comparison', 'safety', shadow.missedFailure ? 'bad' : 'good')}</dl>`
    : emptyState('No shadow.json artifact was found.');
  const replayView = replay
    ? `<h3>Historical replay</h3><dl class="outcome-tiles" aria-label="Historical replay metrics">${outcomeTile('Records', String(replay.records), 'Replay observations', 'evidence')}${outcomeTile('Selective passes', String(replay.selectivePasses), 'Efficient passes', 'execution', 'good')}${outcomeTile('Full failures', String(replay.fullFailures), 'Baseline failures', 'fallback', replay.fullFailures ? 'warn' : 'good')}${outcomeTile('Missed failures', String(replay.missedFailures), 'Selection escapes', 'safety', replay.missedFailures ? 'bad' : 'good')}${outcomeTile('Fallback runs', String(replay.fallbackRuns), 'Protected executions', 'fallback', replay.fallbackRuns ? 'warn' : 'muted')}</dl>`
    : emptyState('No replay.json artifact was found.');
  return `${shadowView}${replayView}`;
}

function navigationButton(target: string, label: string, selected = false): string {
  return `<button id="tab-${target}-button" class="tab" type="button" role="tab" data-tab="${target}" aria-controls="tab-${target}" aria-selected="${String(selected)}"><span class="nav-icon" aria-hidden="true">${reportIcon(target)}</span>${label}</button>`;
}

function themeOptions(): string {
  return '<option value="default">Light coffee</option><option value="aquatic">Aquatic</option><option value="forest">Forest</option><option value="sunset">Sunset</option><option value="midnight">Midnight</option><option value="corporate">Corporate</option><option value="hc-black">High contrast black</option><option value="hc-white">High contrast white</option>';
}

function sectionHeading(title: string, subtitle: string, icon: string): string {
  return `<div class="section-heading"><span class="section-icon" aria-hidden="true">${reportIcon(icon)}</span><div class="section-title"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div>`;
}

function outcomeTile(label: string, value: string, description: string, icon: string, tone = ''): string {
  return `<div class="outcome-tile ${tone ? `outcome-${tone}` : ''}"><dt><span class="outcome-icon" aria-hidden="true">${reportIcon(icon)}</span>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}<small>${escapeHtml(description)}</small></dd></div>`;
}

function barChart(
  title: string,
  subtitle: string,
  entries: Array<{ label: string; value: number; tone: 'accent' | 'good' | 'warn' | 'bad' }>,
): string {
  const maximum = Math.max(1, ...entries.map((entry) => entry.value));
  const summary = entries.map((entry) => `${entry.label}: ${entry.value}`).join(', ');
  const rows = entries
    .map((entry) => {
      const width = entry.value === 0 ? 0 : Math.max(4, Math.round((entry.value / maximum) * 100));
      const toneClass = entry.tone === 'accent' ? '' : ` ${entry.tone}`;
      return `<div class="bar-row"><span>${escapeHtml(entry.label)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill${toneClass}" style="--bar-width:${width}%"></span></span><strong class="bar-value">${entry.value}</strong></div>`;
    })
    .join('');
  return `<figure class="chart-card"><figcaption><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></figcaption><div class="bar-chart" role="img" aria-label="${escapeHtml(`${title}. ${summary}`)}">${rows}</div></figure>`;
}

function reportIcon(name: string): string {
  const paths: Record<string, string> = {
    overview: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
    'pr-impact': '<path d="M6 3v12a4 4 0 0 0 4 4h8"/><path d="m14 15 4 4-4 4M6 8h6"/><circle cx="6" cy="4" r="2"/>',
    impact: '<path d="M4 5h16M4 12h10M4 19h7"/><path d="m17 15 4 4-4 4"/>',
    'code-graph': '<circle cx="5" cy="12" r="2.5"/><circle cx="12" cy="5" r="2.5"/><circle cx="19" cy="12" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="m7 10 3-3m4 0 3 3m0 4-3 3m-4 0-3-3"/>',
    graph: '<path d="M12 3 21 8 12 13 3 8zM3 13l9 5 9-5M3 17l9 5 9-5"/>',
    scenarios: '<path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5M4 16a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
    execution: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    safety: '<path d="M12 3 19 6v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
    fallback: '<path d="M20 8a8 8 0 0 0-14-2L3 9m0-5v5h5M4 16a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
    evidence: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const content = paths[name] ?? paths.overview;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${content}</svg>`;
}

function emptyState(messageText: string): string {
  return `<div class="empty">${escapeHtml(messageText)}</div>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isSelectionPlan(value: unknown): value is SelectionPlan {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.inputFingerprint === 'string' && typeof value.mode === 'string' && Array.isArray(value.tests) && Array.isArray(value.changedFiles) && Array.isArray(value.changedProjects) && Array.isArray(value.fullRunReasons);
}

function isScenarioCoverageReport(value: unknown): value is ScenarioCoverageReport {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.inputFingerprint === 'string' && Array.isArray(value.entries) && Array.isArray(value.gaps);
}

function isExecutionArtifact(value: unknown): value is ExecutionArtifact {
  if (!isRecord(value) || typeof value.mode !== 'string' || typeof value.exitCode !== 'number' || !Array.isArray(value.commands)) {
    return false;
  }
  if (value.environment === undefined) return true;
  return (
    isRecord(value.environment) &&
    typeof value.environment.runner === 'string' &&
    typeof value.environment.platform === 'string' &&
    typeof value.environment.architecture === 'string' &&
    typeof value.environment.nodeVersion === 'string'
  );
}

function isShadowArtifact(value: unknown): value is ShadowArtifact {
  return isRecord(value) && typeof value.missedFailure === 'boolean' && isExecutionArtifact(value.selective) && isExecutionArtifact(value.full);
}

function isReplayArtifact(value: unknown): value is ReplayArtifact {
  return isRecord(value) && ['records', 'selectivePasses', 'fullFailures', 'missedFailures', 'fallbackRuns'].every((key) => typeof value[key] === 'number');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
