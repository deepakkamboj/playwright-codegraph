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
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; --bg:#0b1020; --panel:#151c2f; --muted:#9ca8c3; --text:#f4f7ff; --line:#2b3653; --accent:#75a7ff; --good:#5dd6a0; --warn:#ffc857; --bad:#ff7b88; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,Segoe UI,Arial,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
    header { padding:2rem max(1rem,5vw); border-bottom:1px solid var(--line); background:linear-gradient(135deg,#111a33,#172447); }
    h1,h2,h3 { line-height:1.2; }
    h1 { margin:.25rem 0; font-size:clamp(1.8rem,4vw,3rem); }
    h2 { margin-top:0; }
    .eyebrow { color:var(--accent); font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .subtitle,.muted { color:var(--muted); }
    nav { display:flex; gap:.5rem; flex-wrap:wrap; padding:1rem max(1rem,5vw); position:sticky; top:0; background:rgba(11,16,32,.96); border-bottom:1px solid var(--line); z-index:2; }
    button { border:1px solid var(--line); background:var(--panel); color:var(--text); padding:.55rem .8rem; border-radius:.5rem; cursor:pointer; }
    button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); }
    main { padding:1.5rem max(1rem,5vw) 4rem; }
    section { margin:0 0 1.5rem; padding:1.25rem; background:var(--panel); border:1px solid var(--line); border-radius:.8rem; }
    section[hidden] { display:none; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.8rem; }
    .card { padding:1rem; border:1px solid var(--line); border-radius:.65rem; background:#10172a; }
    .metric { font-size:1.65rem; font-weight:800; }
    .good { color:var(--good); } .warn { color:var(--warn); } .bad { color:var(--bad); }
    .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:.15rem .55rem; margin:.1rem; font-size:.82rem; }
    table { width:100%; border-collapse:collapse; margin-top:.75rem; }
    th,td { padding:.65rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-size:.85rem; text-transform:uppercase; }
    code { color:#b9d1ff; overflow-wrap:anywhere; }
    .scroll { overflow-x:auto; }
    .empty { padding:1rem; border:1px dashed var(--line); color:var(--muted); border-radius:.5rem; }
    #test-filter { width:100%; max-width:32rem; padding:.6rem; background:#0c1325; color:var(--text); border:1px solid var(--line); border-radius:.5rem; }
    @media print { nav { display:none; } section[hidden] { display:block; } body { background:white; color:black; } section,.card { background:white; border-color:#bbb; } }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Deterministic quality intelligence</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">Code change, scenario coverage, selected tests, CI execution, and safety evidence in one standalone report.</p>
  </header>
  <nav aria-label="Report sections">
    ${navigationButton('overview', 'Overview', true)}
    ${navigationButton('pr-impact', 'PR impact')}
    ${navigationButton('scenarios', 'Scenarios')}
    ${navigationButton('execution', 'CI execution')}
    ${navigationButton('safety', 'Shadow and replay')}
  </nav>
  <main>
    <section id="overview" data-report-section>
      <h2>Unified quality view</h2>
      <div class="grid">
        ${metricCard('Overall status', overallStatus, overallStatus === 'Ready' ? 'good' : overallStatus === 'Safe fallback' ? 'warn' : 'bad')}
        ${metricCard('Plan mode', plan?.mode ?? 'Not available', plan?.mode === 'full' ? 'warn' : 'good')}
        ${metricCard('Selected tests', String(selectedTests))}
        ${metricCard('Scenarios', String(scenarioCount))}
        ${metricCard('Scenario gaps', String(scenarioGaps), scenarioGaps ? 'bad' : 'good')}
        ${metricCard('Execution', executionPassed === undefined ? 'Not available' : executionPassed ? 'Passed' : 'Failed', executionPassed === undefined ? '' : executionPassed ? 'good' : 'bad')}
      </div>
      ${plan ? `<h3>Input fingerprint</h3><code>${escapeHtml(plan.inputFingerprint)}</code>` : emptyState('No plan artifact was provided.')}
      ${plan?.fullRunReasons.length ? `<h3>Full-run safety reasons</h3><ul>${plan.fullRunReasons.map((reason) => `<li><strong>${escapeHtml(reason.code)}</strong>: ${escapeHtml(reason.detail)}</li>`).join('')}</ul>` : ''}
    </section>
    <section id="pr-impact" data-report-section hidden>
      <h2>Pull-request impact</h2>
      ${renderImpact(plan)}
    </section>
    <section id="scenarios" data-report-section hidden>
      <h2>Scenario coverage</h2>
      ${renderScenarios(scenarios)}
    </section>
    <section id="execution" data-report-section hidden>
      <h2>CI execution</h2>
      ${renderExecution(execution)}
    </section>
    <section id="safety" data-report-section hidden>
      <h2>Shadow and replay safety</h2>
      ${renderSafety(artifacts.shadow, artifacts.replay)}
    </section>
  </main>
  <script>
    const buttons = [...document.querySelectorAll('nav button')];
    const sections = [...document.querySelectorAll('[data-report-section]')];
    for (const button of buttons) button.addEventListener('click', () => {
      for (const candidate of buttons) candidate.setAttribute('aria-pressed', String(candidate === button));
      for (const section of sections) section.hidden = section.id !== button.dataset.target;
    });
    const filter = document.querySelector('#test-filter');
    if (filter) filter.addEventListener('input', () => {
      const query = filter.value.toLowerCase();
      for (const row of document.querySelectorAll('[data-test-row]')) row.hidden = !row.textContent.toLowerCase().includes(query);
    });
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
  return `<div class="grid">${metricCard('Changed files', String(plan.changedFiles.length))}${metricCard('Changed projects', String(plan.changedProjects.length))}${metricCard('Selected tests', String(plan.tests.length))}</div><h3>Changed projects</h3><p>${plan.changedProjects.map((project) => `<span class="pill">${escapeHtml(project)}</span>`).join('') || 'None'}</p><h3>Changed files</h3>${changes}<h3>Prioritized tests</h3>${tests}`;
}

function renderScenarios(report: ScenarioCoverageReport | undefined): string {
  if (!report) return emptyState('No scenario-coverage.json artifact was found.');
  const rows = report.entries
    .map((entry) => `<tr><td><code>${escapeHtml(entry.scenarioId)}</code></td><td>${entry.testFiles.length}</td><td>${entry.resolvedCodePaths.length}</td><td>${entry.staticallyLinkedCodePaths.length}</td><td>${entry.observedRuntimeFiles.length}</td><td class="${entry.gaps.length ? 'bad' : 'good'}">${entry.gaps.length ? escapeHtml(entry.gaps.join('; ')) : 'Covered'}</td></tr>`)
    .join('');
  return `<div class="grid">${metricCard('Scenarios', String(report.entries.length))}${metricCard('Coverage gaps', String(report.gaps.length), report.gaps.length ? 'bad' : 'good')}${metricCard('Static links', String(report.entries.reduce((total, entry) => total + entry.staticallyLinkedCodePaths.length, 0)))}${metricCard('Runtime files', String(report.entries.reduce((total, entry) => total + entry.observedRuntimeFiles.length, 0)))}</div><div class="scroll"><table><thead><tr><th>Scenario</th><th>Tests</th><th>Declared files</th><th>Static links</th><th>Runtime observed</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderExecution(execution: ExecutionArtifact | undefined): string {
  if (!execution) return emptyState('No execution.json artifact was found.');
  const rows = execution.commands
    .map((command) => `<tr><td>${escapeHtml(command.kind)}</td><td><code>${escapeHtml(command.executable)}</code></td><td><code>${escapeHtml(command.args.join(' '))}</code></td><td class="${command.exitCode === 0 ? 'good' : 'bad'}">${command.exitCode}</td></tr>`)
    .join('');
  return `<div class="grid">${metricCard('Mode', execution.mode)}${metricCard('Exit code', String(execution.exitCode), execution.exitCode === 0 ? 'good' : 'bad')}${metricCard('Commands', String(execution.commands.length))}</div><div class="scroll"><table><thead><tr><th>Kind</th><th>Executable</th><th>Arguments</th><th>Exit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderSafety(shadow: ShadowArtifact | undefined, replay: ReplayArtifact | undefined): string {
  const shadowView = shadow
    ? `<h3>Latest shadow execution</h3><div class="grid">${metricCard('Selective exit', String(shadow.selective.exitCode), shadow.selective.exitCode === 0 ? 'good' : 'bad')}${metricCard('Full exit', String(shadow.full.exitCode), shadow.full.exitCode === 0 ? 'good' : 'bad')}${metricCard('Missed failure', shadow.missedFailure ? 'Yes' : 'No', shadow.missedFailure ? 'bad' : 'good')}</div>`
    : emptyState('No shadow.json artifact was found.');
  const replayView = replay
    ? `<h3>Historical replay</h3><div class="grid">${metricCard('Records', String(replay.records))}${metricCard('Selective passes', String(replay.selectivePasses))}${metricCard('Full failures', String(replay.fullFailures), replay.fullFailures ? 'warn' : 'good')}${metricCard('Missed failures', String(replay.missedFailures), replay.missedFailures ? 'bad' : 'good')}${metricCard('Fallback runs', String(replay.fallbackRuns))}</div>`
    : emptyState('No replay.json artifact was found.');
  return `${shadowView}${replayView}`;
}

function navigationButton(target: string, label: string, selected = false): string {
  return `<button type="button" data-target="${target}" aria-controls="${target}" aria-pressed="${String(selected)}">${label}</button>`;
}

function metricCard(label: string, value: string, statusClass = ''): string {
  return `<div class="card"><div class="muted">${escapeHtml(label)}</div><div class="metric ${statusClass}">${escapeHtml(value)}</div></div>`;
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
  return isRecord(value) && typeof value.mode === 'string' && typeof value.exitCode === 'number' && Array.isArray(value.commands);
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
