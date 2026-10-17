import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import type { CodegraphAdapter, CodegraphAffectedRequest } from '../src/types.js';
import { buildScenarioCoverage, loadScenarioInventory, parseV8RuntimeFiles } from '../src/scenarios.js';
import { temporaryRepository, write } from './helpers.js';

class FakeCodegraph implements CodegraphAdapter {
  public getVersion(): Promise<string> {
    return Promise.resolve('1.6.2');
  }
  public status(): Promise<void> {
    return Promise.resolve();
  }
  public build(): Promise<void> {
    return Promise.resolve();
  }
  public sync(): Promise<void> {
    return Promise.resolve();
  }
  public affected(request: CodegraphAffectedRequest): Promise<readonly string[]> {
    return Promise.resolve(request.files.includes('packages/cart/src/cart.ts') ? ['apps/e2e/cart.spec.ts'] : []);
  }
}

test('scenario registry links annotations and verifies declared code paths through codegraph', async () => {
  const root = temporaryRepository();
  write(
    root,
    'test-scenarios.yml',
    `schemaVersion: 1
customerJourneys:
  - id: commerce
    title: Commerce
    userJourneys:
      - id: checkout
        title: Checkout
        actor: shopper
        scenarios:
          - id: checkout.add-cart
            title: Add an item
            criticality: critical
            requirementRefs: [REQ-1]
            owners: [commerce]
            tags: [smoke]
            codePaths: [packages/cart/src/**]
`,
  );
  write(root, 'apps/e2e/cart.spec.ts', `// @scenario checkout.add-cart\n`);
  write(root, 'packages/cart/src/cart.ts', 'export const cart = [];');
  const files = ['apps/e2e/cart.spec.ts', 'packages/cart/src/cart.ts'];

  const inventory = loadScenarioInventory(root, 'test-scenarios.yml', ['apps/e2e/cart.spec.ts']);
  const report = await buildScenarioCoverage(inventory, files, new FakeCodegraph(), 12);

  assert.deepEqual(inventory.testsByScenario.get('checkout.add-cart'), ['apps/e2e/cart.spec.ts']);
  assert.deepEqual(report.entries[0]?.staticallyLinkedCodePaths, ['packages/cart/src/cart.ts']);
  assert.deepEqual(report.gaps, []);
});

test('unknown scenario annotations fail validation', () => {
  const root = temporaryRepository();
  write(root, 'test-scenarios.yml', 'schemaVersion: 1\ncustomerJourneys: []\n');
  write(root, 'x.spec.ts', '// @scenario missing.id');
  assert.throws(() => loadScenarioInventory(root, 'test-scenarios.yml', ['x.spec.ts']), /Unknown scenario annotation/);
});

test('V8 runtime evidence includes only files with observed execution', () => {
  const root = temporaryRepository();
  write(
    root,
    'coverage.json',
    JSON.stringify([
      {
        url: 'packages/cart/src/cart.ts',
        functions: [{ ranges: [{ startOffset: 0, endOffset: 10, count: 1 }] }],
      },
      {
        url: 'packages/cart/src/unused.ts',
        functions: [{ ranges: [{ startOffset: 0, endOffset: 10, count: 0 }] }],
      },
    ]),
  );

  assert.deepEqual([...parseV8RuntimeFiles(root, path.join(root, 'coverage.json'))], ['packages/cart/src/cart.ts']);
});
