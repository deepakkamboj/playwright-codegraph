import type { ChangedFile } from './types.js';
import { runProcess } from './process.js';
import { sortedUnique, toPosix } from './utils.js';

export interface GitChanges {
  readonly mergeBase: string;
  readonly files: readonly ChangedFile[];
}

export async function detectChanges(
  root: string,
  baseRef: string,
  includeUntracked: boolean,
  timeoutMs = 60_000,
): Promise<GitChanges> {
  if (!baseRef || baseRef.startsWith('-')) throw new Error('Unsafe Git base reference');
  const mergeBase = (await git(root, ['merge-base', 'HEAD', baseRef], timeoutMs)).trim();
  if (!/^[0-9a-f]{40,64}$/i.test(mergeBase)) throw new Error(`Invalid merge-base output: ${mergeBase}`);
  const files = new Map<string, ChangedFile>();
  for (const source of ['merge-base', 'staged', 'unstaged'] as const) {
    const args =
      source === 'merge-base'
        ? ['diff', '--name-status', '--find-renames', '-z', mergeBase, '--']
        : source === 'staged'
          ? ['diff', '--cached', '--name-status', '--find-renames', '-z', '--']
          : ['diff', '--name-status', '--find-renames', '-z', '--'];
    for (const change of parseNameStatus(await git(root, args, timeoutMs), source)) files.set(change.path, change);
  }
  if (includeUntracked) {
    const output = await git(root, ['ls-files', '--others', '--exclude-standard', '-z'], timeoutMs);
    for (const file of output.split('\0').filter(Boolean)) {
      const normalized = toPosix(file);
      files.set(normalized, { path: normalized, status: 'added', source: 'untracked' });
    }
  }
  return { mergeBase, files: [...files.values()].sort((left, right) => left.path.localeCompare(right.path)) };
}

export async function listRepositoryFiles(root: string, timeoutMs = 60_000): Promise<readonly string[]> {
  const files = (await git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], timeoutMs))
    .split('\0')
    .filter(Boolean)
    .map(toPosix);
  return sortedUnique(files);
}

function parseNameStatus(output: string, source: ChangedFile['source']): ChangedFile[] {
  const fields = output.split('\0').filter(Boolean);
  const changes: ChangedFile[] = [];
  for (let index = 0; index < fields.length; ) {
    const code = fields[index++] ?? '';
    const status = statusOf(code[0]);
    if (status === 'renamed' || status === 'copied') {
      const previousPath = toPosix(fields[index++] ?? '');
      const file = toPosix(fields[index++] ?? '');
      changes.push({ path: file, previousPath, status, source });
    } else {
      const file = toPosix(fields[index++] ?? '');
      changes.push({ path: file, status, source });
    }
  }
  return changes;
}

function statusOf(code: string | undefined): ChangedFile['status'] {
  return (
    {
      A: 'added',
      C: 'copied',
      D: 'deleted',
      M: 'modified',
      R: 'renamed',
      T: 'type-changed',
      U: 'unmerged',
    } as const
  )[code ?? ''] ?? 'unknown';
}

async function git(root: string, args: readonly string[], timeoutMs: number): Promise<string> {
  const result = await runProcess({ executable: 'git', args, cwd: root, timeoutMs });
  if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `git ${args[0] ?? ''} failed`);
  return result.stdout;
}
