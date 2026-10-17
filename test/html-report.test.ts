import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { generateHtmlReport } from '../src/html-report.js';
import { temporaryRepository, write } from './helpers.js';

test('generates a standalone escaped quality dashboard from all artifact types', () => {
  const root = temporaryRepository();
  const artifacts = path.join(root, 'artifacts');
  write(
    root,
    'artifacts/plan.json',
    JSON.stringify({
      schemaVersion: 1,
      inputFingerprint: 'sha256:test',
      repositoryRoot: root,
      baseRef: 'origin/main',
      mergeBase: 'a'.repeat(40),
      mode: 'selective',
      fullRunReasons: [],
      changedFiles: [{ path: '<script>alert(1)</script>.ts', status: 'modified', source: 'merge-base' }],
      changedProjects: ['@demo/core'],
      tests: [
        {
          path: 'packages/core/src/index.test.ts',
          kind: 'unit',
          bucket: 'full',
          project: '@demo/core',
          reasons: [{ code: 'codegraph-reachable', detail: 'affected' }],
        },
      ],
      warnings: [],
    }),
  );
  write(
    root,
    'artifacts/scenario-coverage.json',
    JSON.stringify({
      schemaVersion: 1,
      inputFingerprint: 'sha256:scenarios',
      entries: [
        {
          scenarioId: 'checkout.happy-path',
          title: 'Complete checkout',
          journeyId: 'checkout',
          journeyTitle: 'Checkout',
          dependsOn: [],
          criticality: 'critical',
          tags: ['happy-path', 'positive'],
          testFiles: ['checkout.spec.ts'],
          resolvedCodePaths: ['checkout.ts'],
          staticallyLinkedCodePaths: ['checkout.ts'],
          observedRuntimeFiles: ['checkout.ts'],
          gaps: [],
        },
      ],
      gaps: [],
    }),
  );
  write(
    root,
    'artifacts/execution.json',
    JSON.stringify({
      inputFingerprint: 'sha256:test',
      mode: 'selective',
      environment: {
        runner: 'CI',
        platform: 'linux 6.8',
        architecture: 'x64',
        nodeVersion: 'v22.15.0',
      },
      commands: [{ kind: 'unit', executable: 'node', args: ['vitest'], exitCode: 0 }],
      exitCode: 0,
    }),
  );
  write(
    root,
    'artifacts/shadow.json',
    JSON.stringify({
      inputFingerprint: 'sha256:test',
      selective: { mode: 'selective', commands: [], exitCode: 0 },
      full: { mode: 'full', commands: [], exitCode: 0 },
      missedFailure: false,
    }),
  );
  write(
    root,
    'artifacts/replay.json',
    JSON.stringify({ records: 4, selectivePasses: 4, fullFailures: 0, missedFailures: 0, fallbackRuns: 1 }),
  );
  const outputFile = path.join(root, 'report.html');

  generateHtmlReport({ artifactDirectory: artifacts, outputFile, title: 'PR <42>' });

  const html = fs.readFileSync(outputFile, 'utf8');
  assert.match(html, /PR &lt;42&gt;/);
  assert.match(html, /Pull-request impact/);
  assert.match(html, /checkout\.happy-path/);
  assert.match(html, /Code graph/);
  assert.match(html, /User journey workflows/);
  assert.match(html, /Complete checkout/);
  assert.match(html, /happy-path/);
  assert.match(html, /High contrast black/);
  for (const theme of ['default', 'aquatic', 'forest', 'sunset', 'midnight', 'corporate', 'hc-black', 'hc-white']) {
    assert.match(html, new RegExp(`data-theme="${theme}"|value="${theme}"`));
  }
  assert.match(html, /Shadow and replay safety/);
  assert.match(html, /Test execution environment/);
  assert.match(html, /linux 6\.8/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\.ts/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.match(html, /--bg:#fffaf5/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /class="report-navigation"/);
  assert.match(html, /class="workspace-tools"/);
  assert.match(html, /id="copy-run-brief"/);
  assert.match(html, /class="run-header"/);
  assert.match(html, /class="brand-mark"/);
  assert.match(html, /class="tabs" role="tablist"/);
  assert.match(html, /class="nav-icon"/);
  assert.match(html, /class="run-brief"/);
  assert.match(html, /class="brief-measure"/);
  assert.match(html, /class="readiness-ring"/);
  assert.match(html, /class="outcome-tiles"/);
  assert.match(html, /class="outcome-tile/);
  assert.match(html, /class="chart-grid"/);
  assert.match(html, /Selection flow/);
  assert.match(html, /Replay safety/);
  assert.match(html, /id="impact-changed-gradient"/);
  assert.match(html, /id="impact-scenario-gradient"/);
  assert.match(html, /id="impact-test-gradient"/);
  assert.match(html, /class="section-heading"/);
  assert.match(html, /data-tab="settings"/);
  assert.match(html, /id="settings-theme-select"/);
  assert.match(html, /id="print-report"/);
  assert.match(html, /id="reset-theme"/);
  assert.match(html, /class="outcome-tiles outcome-tiles-auto"/);
  assert.doesNotMatch(html, /class="status-strip"/);
  assert.match(html, /data-open-tab="pr-impact"/);
  assert.match(html, /class="tab-panel" role="tabpanel" aria-labelledby=/);
  assert.match(html, /class="page-foot"/);
  assert.match(html, /Change &rarr; Scenario &rarr; Test/);
  assert.match(html, />Light coffee</);
  assert.match(html, /event\.key === 'ArrowRight'/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /window\.addEventListener\('hashchange'/);
});

test('rejects an empty artifact directory', () => {
  const root = temporaryRepository();
  assert.throws(
    () => generateHtmlReport({ artifactDirectory: root, outputFile: path.join(root, 'report.html') }),
    /No report artifacts found/,
  );
});
