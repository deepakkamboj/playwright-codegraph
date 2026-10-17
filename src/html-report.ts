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
<html lang="en" data-theme="midnight">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <title>${escapeHtml(title)}</title>
  <style>
    :root,[data-theme="default"] { color-scheme:light; --bg:#f3f6fc; --panel:#ffffff; --card:#f8faff; --muted:#6b7a99; --text:#0f1b3d; --line:#dce4f2; --accent:#2457d6; --accent-fg:#ffffff; --good:#15803d; --warn:#b45309; --bad:#c81e3a; --hero-a:#16348f; --hero-b:#2457d6; --hero-fg:#ffffff; }
    [data-theme="aquatic"] { color-scheme:light; --bg:#ecfeff; --panel:#ffffff; --card:#f0fdff; --muted:#0e7490; --text:#164e63; --line:#a5f3fc; --accent:#0284c7; --accent-fg:#ffffff; --good:#0d9488; --warn:#b45309; --bad:#e11d48; --hero-a:#075985; --hero-b:#0891b2; --hero-fg:#ffffff; }
    [data-theme="forest"] { color-scheme:light; --bg:#f0fdf4; --panel:#ffffff; --card:#f7fef9; --muted:#166534; --text:#14532d; --line:#bbf7d0; --accent:#16a34a; --accent-fg:#ffffff; --good:#15803d; --warn:#a16207; --bad:#dc2626; --hero-a:#14532d; --hero-b:#16a34a; --hero-fg:#ffffff; }
    [data-theme="sunset"] { color-scheme:light; --bg:#fff7ed; --panel:#ffffff; --card:#fffbf5; --muted:#9a3412; --text:#7c2d12; --line:#fed7aa; --accent:#ea580c; --accent-fg:#ffffff; --good:#15803d; --warn:#a16207; --bad:#dc2626; --hero-a:#9a3412; --hero-b:#ea580c; --hero-fg:#ffffff; }
    [data-theme="midnight"] { color-scheme:dark; --bg:#030712; --panel:#111827; --card:#182235; --muted:#9ca3af; --text:#f9fafb; --line:#374151; --accent:#818cf8; --accent-fg:#0f172a; --good:#34d399; --warn:#fbbf24; --bad:#fb7185; --hero-a:#111827; --hero-b:#312e81; --hero-fg:#f9fafb; }
    [data-theme="corporate"] { color-scheme:light; --bg:#f8fafc; --panel:#ffffff; --card:#f8fafc; --muted:#475569; --text:#0f172a; --line:#cbd5e1; --accent:#334155; --accent-fg:#ffffff; --good:#15803d; --warn:#b45309; --bad:#b91c1c; --hero-a:#0f172a; --hero-b:#334155; --hero-fg:#ffffff; }
    [data-theme="hc-black"] { color-scheme:dark; --bg:#000000; --panel:#0d0d0d; --card:#1a1a1a; --muted:#d1d5db; --text:#ffffff; --line:#ffffff; --accent:#ffff00; --accent-fg:#000000; --good:#55efc4; --warn:#ffd93d; --bad:#ff6b6b; --hero-a:#000000; --hero-b:#000000; --hero-fg:#ffffff; }
    [data-theme="hc-white"] { color-scheme:light; --bg:#ffffff; --panel:#ffffff; --card:#f5f5f5; --muted:#333333; --text:#000000; --line:#000000; --accent:#00008b; --accent-fg:#ffffff; --good:#006400; --warn:#7a4a00; --bad:#a40000; --hero-a:#ffffff; --hero-b:#ffffff; --hero-fg:#000000; }
    * { box-sizing:border-box; }
    :focus-visible { outline:3px solid var(--accent); outline-offset:2px; }
    body { margin:0; font-family:Inter,Segoe UI,Arial,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; }
    header { padding:2rem max(1rem,5vw); border-bottom:1px solid var(--line); background:linear-gradient(135deg,var(--hero-a),var(--hero-b)); color:var(--hero-fg); }
    h1,h2,h3 { line-height:1.2; }
    h1 { margin:.25rem 0; font-size:clamp(1.8rem,4vw,3rem); }
    h2 { margin-top:0; }
    .eyebrow { color:var(--accent); font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    header .subtitle { color:var(--hero-fg); opacity:.85; } .muted { color:var(--muted); }
    nav { display:flex; gap:.5rem; flex-wrap:wrap; padding:1rem max(1rem,5vw); position:sticky; top:0; background:rgba(11,16,32,.96); border-bottom:1px solid var(--line); z-index:2; }
    button,select { border:1px solid var(--line); background:var(--panel); color:var(--text); padding:.55rem .8rem; border-radius:.5rem; }
    button { cursor:pointer; }
    button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); }
    main { padding:1.5rem max(1rem,5vw) 4rem; }
    section { margin:0 0 1.5rem; padding:1.25rem; background:var(--panel); border:1px solid var(--line); border-radius:.8rem; }
    section[hidden] { display:none; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:.8rem; }
    .card { padding:1rem; border:1px solid var(--line); border-radius:.65rem; background:var(--card); }
    .metric { font-size:1.65rem; font-weight:800; }
    .good { color:var(--good); } .warn { color:var(--warn); } .bad { color:var(--bad); }
    .pill { display:inline-block; border:1px solid var(--line); border-radius:999px; padding:.15rem .55rem; margin:.1rem; font-size:.82rem; }
    table { width:100%; border-collapse:collapse; margin-top:.75rem; }
    th,td { padding:.65rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--muted); font-size:.85rem; text-transform:uppercase; }
    code { color:#b9d1ff; overflow-wrap:anywhere; }
    .scroll { overflow-x:auto; }
    .empty { padding:1rem; border:1px dashed var(--line); color:var(--muted); border-radius:.5rem; }
    #test-filter { width:100%; max-width:32rem; padding:.6rem; background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:.5rem; }
    .theme-control { margin-left:auto; display:flex; align-items:center; gap:.5rem; }
    .theme-control label { color:var(--muted); }
    .graph { width:100%; min-width:720px; height:auto; background:var(--card); border:1px solid var(--line); border-radius:.65rem; }
    .graph text { fill:var(--text); font:12px Inter,Segoe UI,Arial,sans-serif; }
    .graph .lane { fill:var(--muted); font-weight:700; text-transform:uppercase; }
    .graph .edge { stroke:var(--line); stroke-width:2; }
    .graph .node { fill:var(--panel); stroke:var(--accent); stroke-width:2; }
    .graph .changed { stroke:var(--warn); } .graph .scenario { stroke:var(--accent); } .graph .test { stroke:var(--good); }
    @media print { nav { display:none; } section[hidden] { display:block; } }
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
    ${navigationButton('code-graph', 'Code graph')}
    ${navigationButton('scenarios', 'Scenarios')}
    ${navigationButton('execution', 'CI execution')}
    ${navigationButton('safety', 'Shadow and replay')}
    <div class="theme-control"><label for="theme-select">Theme</label><select id="theme-select" aria-label="Report theme"><option value="default">Light</option><option value="aquatic">Aquatic</option><option value="forest">Forest</option><option value="sunset">Sunset</option><option value="midnight">Midnight</option><option value="corporate">Corporate</option><option value="hc-black">High contrast black</option><option value="hc-white">High contrast white</option></select></div>
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
    <section id="code-graph" data-report-section hidden>
      <h2>Code graph</h2>
      ${renderCodeGraph(plan, scenarios)}
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
    const themeSelect = document.querySelector('#theme-select');
    const applyTheme = (theme) => {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('playwright-codegraph-theme', theme); } catch {}
    };
    if (themeSelect) {
      let saved = null;
      try { saved = localStorage.getItem('playwright-codegraph-theme'); } catch {}
      const available = [...themeSelect.options].map((option) => option.value);
      const preferred = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'midnight' : 'default';
      themeSelect.value = available.includes(saved) ? saved : preferred;
      applyTheme(themeSelect.value);
      themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    }
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

function renderCodeGraph(plan: SelectionPlan | undefined, report: ScenarioCoverageReport | undefined): string {
  if (!plan && !report) return emptyState('No plan or scenario coverage artifact was found.');
  const changed = (plan?.changedFiles ?? []).slice(0, 12);
  const scenarios = (report?.entries ?? []).slice(0, 12);
  const testPaths = [...new Set(scenarios.flatMap((entry) => entry.testFiles).concat(plan?.tests.map((test) => test.path) ?? []))]
    .sort()
    .slice(0, 12);
  const rowHeight = 58;
  const height = Math.max(changed.length, scenarios.length, testPaths.length, 1) * rowHeight + 56;
  const node = (x: number, y: number, cssClass: string, label: string) =>
    `<g><rect class="node ${cssClass}" x="${x}" y="${y}" width="250" height="38" rx="8"/><text x="${x + 10}" y="${y + 24}">${escapeHtml(shortLabel(label))}</text><title>${escapeHtml(label)}</title></g>`;
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
  const impactGraph = `<div class="scroll"><svg class="graph" viewBox="0 0 910 ${height}" role="img" aria-labelledby="impact-graph-title impact-graph-desc"><title id="impact-graph-title">Code change impact graph</title><desc id="impact-graph-desc">Changed files connect to covered scenarios, which connect to selected tests.</desc><defs><marker id="impact-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line)"/></marker></defs><text class="lane" x="20" y="25">Changed files</text><text class="lane" x="330" y="25">Scenarios</text><text class="lane" x="640" y="25">Tests</text>${edges.join('')}${changed.map((file, index) => node(20, changedY[index]!, 'changed', file.path)).join('')}${scenarios.map((scenario, index) => node(330, scenarioY[index]!, 'scenario', scenario.title ?? scenario.scenarioId)).join('')}${testPaths.map((testFile, index) => node(640, testY[index]!, 'test', testFile)).join('')}</svg></div>`;
  const truncated =
    (plan?.changedFiles.length ?? 0) > changed.length ||
    (report?.entries.length ?? 0) > scenarios.length ||
    new Set(report?.entries.flatMap((entry) => entry.testFiles) ?? []).size > testPaths.length;
  return `<p class="muted">Deterministic traceability from changed code through scenario coverage to tests. The graph uses only report artifacts and makes no network requests.</p>${impactGraph}${truncated ? '<p class="warn">The visual graph is limited to 12 nodes per lane; tables retain the complete data.</p>' : ''}<h3>User journey workflows</h3>${renderJourneyWorkflows(report)}`;
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
          return `<g><rect class="node scenario" x="${index * 260 + 20}" y="55" width="220" height="72" rx="10"/><text x="${index * 260 + 32}" y="79">${escapeHtml(shortLabel(entry.title ?? entry.scenarioId, 28))}</text><text class="lane" x="${index * 260 + 32}" y="101">${escapeHtml(shortLabel(tags, 28))}</text><text x="${index * 260 + 32}" y="119">${escapeHtml(entry.criticality ?? '-')}</text><title>${escapeHtml(`${entry.scenarioId} | ${tags} | depends on: ${(entry.dependsOn ?? []).join(', ') || 'none'}`)}</title></g>`;
        })
        .join('');
      return `<div class="card"><h4>${escapeHtml(journey.title)} <span class="pill">${escapeHtml(journeyId)}</span></h4><div class="scroll"><svg class="graph" viewBox="0 0 ${width} 155" style="min-width:${width}px" role="img" aria-label="${escapeHtml(`${journey.title} scenario dependency workflow`)}"><defs><marker id="journey-arrow-${journeyIndex}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--line)"/></marker></defs>${dependencies.join('')}${nodes}</svg></div></div>`;
    })
    .join('');
}

function shortLabel(value: string, length = 34): string {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}

function renderScenarios(report: ScenarioCoverageReport | undefined): string {
  if (!report) return emptyState('No scenario-coverage.json artifact was found.');
  const countType = (type: string) =>
    report.entries.filter((entry) => (entry.tags ?? []).some((tag) => tag.toLowerCase() === type)).length;
  const rows = report.entries
    .map((entry) => `<tr><td><code>${escapeHtml(entry.scenarioId)}</code>${entry.title ? `<div class="muted">${escapeHtml(entry.title)}</div>` : ''}</td><td>${(entry.tags ?? []).map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join('') || '-'}</td><td>${escapeHtml(entry.criticality ?? '-')}</td><td>${entry.testFiles.length}</td><td>${entry.resolvedCodePaths.length}</td><td>${entry.staticallyLinkedCodePaths.length}</td><td>${entry.observedRuntimeFiles.length}</td><td class="${entry.gaps.length ? 'bad' : 'good'}">${entry.gaps.length ? escapeHtml(entry.gaps.join('; ')) : 'Covered'}</td></tr>`)
    .join('');
  return `<div class="grid">${metricCard('Scenarios', String(report.entries.length))}${metricCard('Happy', String(countType('happy-path')))}${metricCard('Positive', String(countType('positive')))}${metricCard('Negative', String(countType('negative')))}${metricCard('Edge', String(countType('edge')))}${metricCard('Corner', String(countType('corner')))}${metricCard('Coverage gaps', String(report.gaps.length), report.gaps.length ? 'bad' : 'good')}${metricCard('Static links', String(report.entries.reduce((total, entry) => total + entry.staticallyLinkedCodePaths.length, 0)))}${metricCard('Runtime files', String(report.entries.reduce((total, entry) => total + entry.observedRuntimeFiles.length, 0)))}</div><div class="scroll"><table><thead><tr><th>Scenario</th><th>Types</th><th>Criticality</th><th>Tests</th><th>Declared files</th><th>Static links</th><th>Runtime observed</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
