import assert from 'node:assert/strict';
import test from 'node:test';

import { replayShadowRecords } from '../src/replay.js';
import { temporaryRepository, write } from './helpers.js';

test('replay aggregates shadow misses and fallback runs', () => {
  const root = temporaryRepository();
  write(
    root,
    'run-1/shadow.json',
    JSON.stringify({
      inputFingerprint: 'sha256:one',
      selective: { mode: 'selective', exitCode: 0 },
      full: { mode: 'full', exitCode: 1 },
      missedFailure: true,
    }),
  );
  write(
    root,
    'run-2/shadow.json',
    JSON.stringify({
      inputFingerprint: 'sha256:two',
      selective: { mode: 'full', exitCode: 0 },
      full: { mode: 'full', exitCode: 0 },
      missedFailure: false,
    }),
  );

  assert.deepEqual(replayShadowRecords(root), {
    records: 2,
    selectivePasses: 2,
    fullFailures: 1,
    missedFailures: 1,
    fallbackRuns: 1,
  });
});
