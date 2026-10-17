import path from 'node:path';

import type { CodegraphConfig } from './config.js';
import type { CodegraphAdapter, CodegraphAffectedRequest } from './types.js';
import { ProcessFailure, runProcess } from './process.js';
import { repositoryRelative, sortedUnique } from './utils.js';

export class CodegraphError extends Error {
  public constructor(
    message: string,
    public readonly kind: 'unavailable' | 'incompatible' | 'failed' | 'timeout',
  ) {
    super(message);
  }
}

export class CliCodegraphAdapter implements CodegraphAdapter {
  public constructor(
    private readonly root: string,
    private readonly config: CodegraphConfig,
  ) {}

  public async getVersion(): Promise<string> {
    const output = await this.invoke(['--version']);
    const version = output.trim().replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new CodegraphError(`Unrecognized codegraph version: ${version}`, 'incompatible');
    if (version.split('.')[0] !== this.config.minimumVersion.split('.')[0]) {
      throw new CodegraphError(`codegraph ${version} is outside the supported 1.x protocol`, 'incompatible');
    }
    if (compareVersions(version, this.config.minimumVersion) < 0) {
      throw new CodegraphError(
        `codegraph ${version} is older than required ${this.config.minimumVersion}`,
        'incompatible',
      );
    }
    return version;
  }

  public async status(): Promise<void> {
    const output = await this.invoke(['status', '--json', this.root]);
    let status: unknown;
    try {
      status = JSON.parse(output);
    } catch {
      throw new CodegraphError('codegraph status returned malformed JSON', 'failed');
    }
    if (!status || typeof status !== 'object' || (status as { initialized?: unknown }).initialized !== true) {
      throw new CodegraphError('codegraph index is not initialized', 'failed');
    }
  }

  public async build(force: boolean): Promise<void> {
    await this.invoke(force ? ['index', '--force', '--quiet', this.root] : ['init', '--yes', this.root]);
  }

  public async sync(): Promise<void> {
    await this.invoke(['sync', this.root]);
  }

  public async affected(request: CodegraphAffectedRequest): Promise<readonly string[]> {
    if (request.files.length === 0) return [];
    const args = ['affected', '--stdin', '--quiet', '--depth', String(request.depth), '--path', this.root];
    if (request.testFilter) args.push('--filter', request.testFilter);
    const output = await this.invoke(args, `${request.files.join('\n')}\n`);
    return sortedUnique(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((file) => repositoryRelative(this.root, path.resolve(this.root, file))),
    );
  }

  private async invoke(args: readonly string[], input?: string): Promise<string> {
    try {
      const result = await runProcess({
        executable: this.config.executable,
        args,
        cwd: this.root,
        ...(input === undefined ? {} : { input }),
        timeoutMs: this.config.timeoutMs,
        env: { DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? '1', NO_COLOR: '1' },
      });
      if (result.exitCode !== 0) {
        throw new CodegraphError(
          `codegraph exited ${result.exitCode}: ${sanitize(result.stderr || result.stdout)}`,
          'failed',
        );
      }
      return result.stdout;
    } catch (error) {
      if (error instanceof CodegraphError) throw error;
      if (error instanceof ProcessFailure) {
        throw new CodegraphError(error.message, error.timedOut ? 'timeout' : 'unavailable');
      }
      throw error;
    }
  }
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').slice(0, 3).map(Number);
  const b = right.split('.').slice(0, 3).map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function sanitize(value: string): string {
  return value.replaceAll(/\r?\n/g, ' ').trim().slice(0, 500);
}
