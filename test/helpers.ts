import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function temporaryRepository(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-codegraph-'));
}

export function write(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}
