import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generateHtmlReport } from '../dist/html-report.js';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-codegraph-report-'));
const write = (name, value) => fs.writeFileSync(path.join(temporaryDirectory, name), `${JSON.stringify(value, null, 2)}\n`);

write('plan.json', {
  schemaVersion: 1,
  inputFingerprint: 'sha256:7ac99f5c3cf8c573b5ad99139e257867d9367b75fe60a5c468d550871f54f93a',
  repositoryRoot: '/workspace/commerce-platform',
  baseRef: 'origin/main',
  mergeBase: 'c73a6e9d0d1f4a6a82c7d0d4cb1d880612f4de2a',
  mode: 'selective',
  fullRunReasons: [],
  changedFiles: [
    { path: 'packages/payments/src/card/authorize.ts', status: 'modified', source: 'merge-base' },
    { path: 'packages/cart/src/quantity.ts', status: 'modified', source: 'merge-base' },
    { path: 'apps/store/src/checkout/summary.ts', status: 'modified', source: 'merge-base' },
    { path: 'apps/store/src/checkout/summary.test.ts', status: 'modified', source: 'merge-base' },
  ],
  changedProjects: ['@commerce/cart', '@commerce/payments', '@commerce/store'],
  tests: [
    {
      path: 'packages/payments/src/card/authorize.test.ts',
      kind: 'unit',
      bucket: 'full',
      project: '@commerce/payments',
      reasons: [
        { code: 'codegraph-reachable', detail: 'required codegraph reported affected' },
        { code: 'covers', detail: 'scenario checkout.card.happy-path covers changed code' },
      ],
    },
    {
      path: 'packages/payments/src/card/declined.test.ts',
      kind: 'unit',
      bucket: 'full',
      project: '@commerce/payments',
      reasons: [
        { code: 'codegraph-reachable', detail: 'required codegraph reported affected' },
        { code: 'covers', detail: 'scenario checkout.card.declined covers changed code' },
      ],
    },
    {
      path: 'packages/cart/src/quantity.test.ts',
      kind: 'unit',
      bucket: 'full',
      project: '@commerce/cart',
      reasons: [{ code: 'codegraph-reachable', detail: 'required codegraph reported affected' }],
    },
    {
      path: 'apps/store/src/checkout/summary.test.ts',
      kind: 'unit',
      bucket: 'full',
      project: '@commerce/store',
      reasons: [
        { code: 'changed-test', detail: 'test file changed', changedFile: 'apps/store/src/checkout/summary.test.ts' },
      ],
    },
    {
      path: 'apps/e2e/tests/checkout/card-payment.spec.ts',
      kind: 'playwright',
      bucket: 'core',
      project: '@commerce/e2e',
      reasons: [
        { code: 'mapping', detail: 'explicit mapping rule matched' },
        { code: 'core-safety', detail: 'configured core safety test' },
      ],
    },
    {
      path: 'apps/e2e/tests/checkout/maximum-quantity.spec.ts',
      kind: 'playwright',
      bucket: 'smoke',
      project: '@commerce/e2e',
      reasons: [
        { code: 'covers', detail: 'scenario checkout.quantity.maximum covers changed code' },
        { code: 'smoke-safety', detail: '@commerce/e2e is a distant workspace dependent' },
      ],
    },
  ],
  warnings: [],
});

write('scenario-coverage.json', {
  schemaVersion: 1,
  inputFingerprint: 'sha256:cf68c1599f8a6383ccd4bbb8c7c99086d1b0f6ced619275cd5b407fbb6273f99',
  entries: [
    {
      scenarioId: 'checkout.card.happy-path',
      title: 'Authorize card payment',
      journeyId: 'checkout',
      journeyTitle: 'Complete checkout',
      dependsOn: [],
      criticality: 'critical',
      tags: ['happy-path', 'positive', 'smoke'],
      testFiles: ['packages/payments/src/card/authorize.test.ts', 'apps/e2e/tests/checkout/card-payment.spec.ts'],
      resolvedCodePaths: ['packages/payments/src/card/authorize.ts', 'apps/store/src/checkout/summary.ts'],
      staticallyLinkedCodePaths: ['packages/payments/src/card/authorize.ts', 'apps/store/src/checkout/summary.ts'],
      observedRuntimeFiles: ['packages/payments/src/card/authorize.ts', 'apps/store/src/checkout/summary.ts'],
      gaps: [],
    },
    {
      scenarioId: 'checkout.card.declined',
      title: 'Handle declined card',
      journeyId: 'checkout',
      journeyTitle: 'Complete checkout',
      dependsOn: ['checkout.card.happy-path'],
      criticality: 'high',
      tags: ['negative', 'recovery'],
      testFiles: ['packages/payments/src/card/declined.test.ts'],
      resolvedCodePaths: ['packages/payments/src/card/authorize.ts'],
      staticallyLinkedCodePaths: ['packages/payments/src/card/authorize.ts'],
      observedRuntimeFiles: ['packages/payments/src/card/authorize.ts'],
      gaps: [],
    },
    {
      scenarioId: 'checkout.quantity.maximum',
      title: 'Validate maximum quantity',
      journeyId: 'checkout',
      journeyTitle: 'Complete checkout',
      dependsOn: ['checkout.card.happy-path'],
      criticality: 'medium',
      tags: ['edge'],
      testFiles: ['packages/cart/src/quantity.test.ts', 'apps/e2e/tests/checkout/maximum-quantity.spec.ts'],
      resolvedCodePaths: ['packages/cart/src/quantity.ts'],
      staticallyLinkedCodePaths: ['packages/cart/src/quantity.ts'],
      observedRuntimeFiles: ['packages/cart/src/quantity.ts'],
      gaps: [],
    },
    {
      scenarioId: 'checkout.summary.normal',
      title: 'Review order summary',
      journeyId: 'checkout',
      journeyTitle: 'Complete checkout',
      dependsOn: ['checkout.quantity.maximum'],
      criticality: 'high',
      tags: ['positive'],
      testFiles: ['apps/store/src/checkout/summary.test.ts'],
      resolvedCodePaths: ['apps/store/src/checkout/summary.ts'],
      staticallyLinkedCodePaths: ['apps/store/src/checkout/summary.ts'],
      observedRuntimeFiles: ['apps/store/src/checkout/summary.ts'],
      gaps: [],
    },
    {
      scenarioId: 'checkout.order.security',
      title: 'Protect unusual order input',
      journeyId: 'checkout',
      journeyTitle: 'Complete checkout',
      dependsOn: ['checkout.summary.normal'],
      criticality: 'critical',
      tags: ['corner', 'security'],
      testFiles: ['apps/e2e/tests/checkout/card-payment.spec.ts'],
      resolvedCodePaths: ['apps/store/src/checkout/summary.ts'],
      staticallyLinkedCodePaths: ['apps/store/src/checkout/summary.ts'],
      observedRuntimeFiles: [],
      gaps: [],
    },
  ],
  gaps: [],
});

write('execution.json', {
  inputFingerprint: 'sha256:7ac99f5c3cf8c573b5ad99139e257867d9367b75fe60a5c468d550871f54f93a',
  mode: 'selective',
  commands: [
    { kind: 'unit', executable: 'node', args: ['vitest.mjs', 'run', '4 selected files'], exitCode: 0 },
    { kind: 'playwright', executable: 'node', args: ['playwright', 'test', '2 selected files'], exitCode: 0 },
  ],
  exitCode: 0,
});

write('shadow.json', {
  inputFingerprint: 'sha256:7ac99f5c3cf8c573b5ad99139e257867d9367b75fe60a5c468d550871f54f93a',
  selective: { mode: 'selective', commands: [], exitCode: 0 },
  full: { mode: 'full', commands: [], exitCode: 0 },
  missedFailure: false,
});

write('replay.json', {
  records: 148,
  selectivePasses: 142,
  fullFailures: 6,
  missedFailures: 0,
  fallbackRuns: 9,
});

const outputFile = path.resolve('docs/codegraph-quality-report-sample.html');
generateHtmlReport({
  artifactDirectory: temporaryDirectory,
  outputFile,
  title: 'Checkout PR #184 Quality Report',
});
fs.rmSync(temporaryDirectory, { recursive: true, force: true });
console.log(outputFile);
