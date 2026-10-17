import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_CONFIG } from '../src/config.js';
import { executePlan } from '../src/executor.js';
import { PLAN_SCHEMA_VERSION, type SelectionPlan } from '../src/types.js';

test('records the test execution environment for empty plans', async () => {
  const plan: SelectionPlan = {
    schemaVersion: PLAN_SCHEMA_VERSION,
    inputFingerprint: 'sha256:environment',
    repositoryRoot: process.cwd(),
    baseRef: 'origin/main',
    mergeBase: null,
    mode: 'empty',
    fullRunReasons: [],
    changedFiles: [],
    changedProjects: [],
    tests: [],
    warnings: [],
  };

  const result = await executePlan(plan, DEFAULT_CONFIG);

  assert.match(result.environment.runner, /^(CI|Local)$/);
  assert.ok(result.environment.platform.length > 0);
  assert.ok(result.environment.architecture.length > 0);
  assert.equal(result.environment.nodeVersion, process.version);
});
