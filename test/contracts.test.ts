import assert from 'node:assert/strict';
import test from 'node:test';

import { PLAN_SCHEMA_VERSION, type SelectionPlan } from '../src/index.js';

test('selection plans expose a stable versioned contract', () => {
  const plan: SelectionPlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    inputFingerprint: 'sha256:fixture',
    repositoryRoot: 'C:/repo',
    baseRef: 'origin/main',
    mergeBase: null,
    mode: 'full',
    fullRunReasons: [{ code: 'codegraph-unavailable', detail: 'codegraph was not found' }],
    changedFiles: [],
    changedProjects: [],
    tests: [],
    warnings: [],
  };

  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.mode, 'full');
  assert.equal(plan.fullRunReasons[0]?.code, 'codegraph-unavailable');
});
