import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const testDirectory = path.resolve('test');
const testFiles = fs
  .readdirSync(testDirectory)
  .filter((file) => file.endsWith('.test.ts'))
  .sort()
  .map((file) => path.join(testDirectory, file));

if (testFiles.length === 0) {
  console.error('No test files found');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...testFiles], {
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
