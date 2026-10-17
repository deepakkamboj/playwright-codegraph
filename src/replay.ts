import fs from 'node:fs';
import path from 'node:path';

import type { ShadowResult } from './shadow.js';

export interface ReplaySummary {
  readonly records: number;
  readonly selectivePasses: number;
  readonly fullFailures: number;
  readonly missedFailures: number;
  readonly fallbackRuns: number;
}

export function replayShadowRecords(directory: string): ReplaySummary {
  const records = findFiles(directory, 'shadow.json').map(readShadow);
  return {
    records: records.length,
    selectivePasses: records.filter((record) => record.selective.exitCode === 0).length,
    fullFailures: records.filter((record) => record.full.exitCode !== 0).length,
    missedFailures: records.filter((record) => record.missedFailure).length,
    fallbackRuns: records.filter((record) => record.selective.mode === 'full').length,
  };
}

function findFiles(directory: string, name: string): string[] {
  if (!fs.existsSync(directory)) throw new Error(`Replay directory not found: ${directory}`);
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findFiles(absolute, name));
    else if (entry.isFile() && entry.name === name) files.push(absolute);
  }
  return files.sort();
}

function readShadow(file: string): ShadowResult {
  const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Invalid shadow record: ${file}`);
  const record = parsed as Record<string, unknown>;
  if (
    typeof record.inputFingerprint !== 'string' ||
    typeof record.missedFailure !== 'boolean' ||
    !record.selective ||
    typeof record.selective !== 'object' ||
    !record.full ||
    typeof record.full !== 'object'
  ) {
    throw new Error(`Invalid shadow record: ${file}`);
  }
  return parsed as ShadowResult;
}
