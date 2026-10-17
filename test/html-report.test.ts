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
  assert.match(html, /Shadow and replay safety/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\.ts/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
});

test('rejects an empty artifact directory', () => {
  const root = temporaryRepository();
  assert.throws(
    () => generateHtmlReport({ artifactDirectory: root, outputFile: path.join(root, 'report.html') }),
    /No report artifacts found/,
  );
});
