import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_CONFIG } from '../src/config.js';
import { loadRushWorkspace } from '../src/rush.js';
import { loadScenarioInventory } from '../src/scenarios.js';
import { selectTests } from '../src/selection.js';
import { canonicalJson } from '../src/utils.js';
import { temporaryRepository, write } from './helpers.js';

function fixture() {
  const root = temporaryRepository();
  write(
    root,
    'rush.json',
    JSON.stringify({
      projects: [
        { packageName: '@scope/cart', projectFolder: 'packages/cart' },
        { packageName: '@scope/app', projectFolder: 'apps/app' },
      ],
    }),
  );
  write(root, 'packages/cart/package.json', JSON.stringify({ name: '@scope/cart' }));
  write(root, 'apps/app/package.json', JSON.stringify({ name: '@scope/app', dependencies: { '@scope/cart': 'workspace:*' } }));
  write(root, 'apps/app/src/app.test.ts', 'test("app", () => {});');
  write(root, 'packages/cart/src/cart.ts', 'export const cart = [];');
  write(root, 'packages/cart/src/cart.test.ts', '// @scenario cart.add');
  write(
    root,
    'test-scenarios.yml',
    `schemaVersion: 1
customerJourneys:
  - id: commerce
    title: Commerce
    userJourneys:
      - id: cart
        title: Cart
        scenarios:
          - id: cart.add
            title: Add
            criticality: critical
            requirementRefs: []
            owners: []
            tags: []
            codePaths: [packages/cart/src/cart.ts]
`,
  );
  const files = [
    'apps/app/package.json',
    'apps/app/src/app.test.ts',
    'packages/cart/package.json',
    'packages/cart/src/cart.test.ts',
    'packages/cart/src/cart.ts',
  ];
  return {
    root,
    files,
    workspace: loadRushWorkspace(root),
    scenarios: loadScenarioInventory(root, 'test-scenarios.yml', ['packages/cart/src/cart.test.ts']),
  };
}

test('scenario edges select linked tests and planning is byte deterministic', () => {
  const data = fixture();
  const input = {
    root: data.root,
    baseRef: 'origin/main',
    mergeBase: 'a'.repeat(40),
    config: DEFAULT_CONFIG,
    workspace: data.workspace,
    changedFiles: [{ path: 'packages/cart/src/cart.ts', status: 'modified', source: 'merge-base' }] as const,
    repositoryFiles: data.files,
    codegraphVersion: '1.6.2',
    codegraphAffectedTests: [],
    scenarios: data.scenarios,
  };

  const first = selectTests(input);
  const second = selectTests(input);

  assert.equal(first.mode, 'selective');
  assert.ok(first.tests.find((selected) => selected.path === 'packages/cart/src/cart.test.ts')?.reasons.some((reason) => reason.code === 'covers'));
  assert.ok(first.tests.find((selected) => selected.path === 'apps/app/src/app.test.ts')?.reasons.some((reason) => reason.code === 'dependent-project'));
  assert.equal(canonicalJson(first), canonicalJson(second));
});

test('unknown root changes fail open to the full suite', () => {
  const data = fixture();
  const plan = selectTests({
    root: data.root,
    baseRef: 'origin/main',
    mergeBase: 'a'.repeat(40),
    config: DEFAULT_CONFIG,
    workspace: data.workspace,
    changedFiles: [{ path: 'unknown.txt', status: 'modified', source: 'merge-base' }],
    repositoryFiles: data.files,
    codegraphVersion: '1.6.2',
    codegraphAffectedTests: [],
    scenarios: data.scenarios,
  });

  assert.equal(plan.mode, 'full');
  assert.equal(plan.fullRunReasons[0]?.code, 'unknown-file');
  assert.ok(plan.tests.every((selected) => selected.reasons.some((reason) => reason.code === 'full-fallback')));
});

test('scenario coverage gaps fail open even when codegraph selected a test', () => {
  const data = fixture();
  const plan = selectTests({
    root: data.root,
    baseRef: 'origin/main',
    mergeBase: 'a'.repeat(40),
    config: DEFAULT_CONFIG,
    workspace: data.workspace,
    changedFiles: [{ path: 'packages/cart/src/cart.ts', status: 'modified', source: 'merge-base' }],
    repositoryFiles: data.files,
    codegraphVersion: '1.6.2',
    codegraphAffectedTests: ['packages/cart/src/cart.test.ts'],
    scenarios: data.scenarios,
    scenarioCoverageGaps: ['cart.add: static link missing'],
  });

  assert.equal(plan.mode, 'full');
  assert.equal(plan.fullRunReasons[0]?.code, 'unsafe-input');
});

test('explicit full mode inventories every test with a deterministic reason', () => {
  const data = fixture();
  const plan = selectTests({
    root: data.root,
    baseRef: 'HEAD',
    mergeBase: 'a'.repeat(40),
    config: DEFAULT_CONFIG,
    workspace: data.workspace,
    changedFiles: [],
    repositoryFiles: data.files,
    codegraphVersion: '1.6.2',
    codegraphAffectedTests: [],
    scenarios: data.scenarios,
    forceFull: true,
  });

  assert.equal(plan.mode, 'full');
  assert.equal(plan.tests.length, 2);
  assert.equal(plan.fullRunReasons[0]?.code, 'manual-full-run');
  assert.ok(plan.tests.every((selected) => selected.reasons.some((reason) => reason.code === 'full-fallback')));
});
