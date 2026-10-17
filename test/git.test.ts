import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

import { listRepositoryFiles } from '../src/git.js';
import { temporaryRepository, write } from './helpers.js';

test('repository inventory includes tracked and untracked non-ignored files', async () => {
  const root = temporaryRepository();
  execFileSync('git', ['init', '-b', 'main'], { cwd: root });
  write(root, '.gitignore', 'ignored.ts\n');
  write(root, 'tracked.ts', 'export const tracked = true;');
  execFileSync('git', ['add', '.gitignore', 'tracked.ts'], { cwd: root });
  write(root, 'untracked.ts', 'export const untracked = true;');
  write(root, 'ignored.ts', 'export const ignored = true;');

  const files = await listRepositoryFiles(root);

  assert.deepEqual(files, ['.gitignore', 'tracked.ts', 'untracked.ts']);
});
