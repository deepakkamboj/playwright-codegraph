import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRushWorkspace } from '../src/rush.js';
import { temporaryRepository, write } from './helpers.js';

test('Rush workspace models dependencies, dependents, and longest-folder ownership', () => {
  const root = temporaryRepository();
  write(
    root,
    'rush.json',
    JSON.stringify({
      projects: [
        { packageName: '@scope/core', projectFolder: 'packages/core' },
        { packageName: '@scope/app', projectFolder: 'apps/app' },
      ],
    }),
  );
  write(root, 'packages/core/package.json', JSON.stringify({ name: '@scope/core' }));
  write(root, 'apps/app/package.json', JSON.stringify({ name: '@scope/app', dependencies: { '@scope/core': 'workspace:*' } }));

  const workspace = loadRushWorkspace(root);

  assert.deepEqual(workspace.projects.find((project) => project.name === '@scope/core')?.dependents, ['@scope/app']);
  assert.equal(workspace.projectForFile('apps/app/src/index.ts')?.name, '@scope/app');
  assert.equal(workspace.projectForFile('outside.ts'), undefined);
});
