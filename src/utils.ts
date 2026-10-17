import { createHash } from 'node:crypto';
import path from 'node:path';

export function toPosix(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function repositoryRelative(root: string, value: string): string {
  const relative = toPosix(path.relative(root, path.resolve(root, value)));
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes repository root: ${value}`);
  }
  return relative;
}

export function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

export function fingerprint(parts: readonly string[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part).update('\0');
  return `sha256:${hash.digest('hex')}`;
}
