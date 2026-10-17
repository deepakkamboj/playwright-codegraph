import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { CodegraphSelectionConfig, CommandConfig } from './config.js';
import { runProcess } from './process.js';
import type { SelectionPlan, TestKind } from './types.js';

export interface ExecutionResult {
  readonly inputFingerprint: string;
  readonly mode: SelectionPlan['mode'];
  readonly environment: {
    readonly runner: 'CI' | 'Local';
    readonly platform: string;
    readonly architecture: string;
    readonly nodeVersion: string;
  };
  readonly commands: readonly {
    readonly kind: TestKind;
    readonly executable: string;
    readonly args: readonly string[];
    readonly exitCode: number;
  }[];
  readonly exitCode: number;
}

export async function executePlan(
  plan: SelectionPlan,
  config: CodegraphSelectionConfig,
  timeoutMs = 0,
): Promise<ExecutionResult> {
  const environment = {
    runner: process.env.CI ? ('CI' as const) : ('Local' as const),
    platform: `${os.platform()} ${os.release()}`,
    architecture: os.arch(),
    nodeVersion: process.version,
  };
  const commands: {
    kind: TestKind;
    executable: string;
    args: readonly string[];
    exitCode: number;
  }[] = [];
  if (plan.mode === 'empty') {
    return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, environment, commands, exitCode: 0 };
  }
  for (const [kind, command] of [
    ['unit', config.unit],
    ['playwright', config.playwright],
  ] as const) {
    const files = plan.tests.filter((test) => test.kind === kind).map((test) => test.path);
    if (plan.mode !== 'full' && files.length === 0) continue;
    const args = chooseArgs(plan.mode, command, files);
    const cwd = command.cwd ? path.resolve(plan.repositoryRoot, command.cwd) : plan.repositoryRoot;
    const invocation = resolveInvocation(cwd, command.executable, args);
    const result = await runProcess({
      executable: invocation.executable,
      args: invocation.args,
      cwd,
      timeoutMs,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    commands.push({ kind, executable: invocation.executable, args: invocation.args, exitCode: result.exitCode });
    if (result.exitCode !== 0) {
      return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, environment, commands, exitCode: result.exitCode };
    }
  }
  return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, environment, commands, exitCode: 0 };
}

function resolveInvocation(
  cwd: string,
  executable: string,
  args: readonly string[],
): { readonly executable: string; readonly args: readonly string[] } {
  if (executable !== 'npx' || args.length === 0) return { executable, args };
  const binName = args[0];
  if (!binName || binName.startsWith('-')) throw new Error('npx runner commands must begin with a package binary name');
  const packageCandidates =
    binName === 'playwright'
      ? ['@playwright/test', 'playwright']
      : binName === 'rush'
        ? ['@microsoft/rush']
        : [binName];
  for (const packageName of packageCandidates) {
    const packageJsonPath = findPackageJson(cwd, packageName);
    if (!packageJsonPath) continue;
    const parsed: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const bin = (parsed as Record<string, unknown>).bin;
    const relativeBin =
      typeof bin === 'string'
        ? bin
        : bin && typeof bin === 'object' && !Array.isArray(bin)
          ? (bin as Record<string, unknown>)[binName]
          : undefined;
    if (typeof relativeBin === 'string' && relativeBin) {
      return {
        executable: process.execPath,
        args: [path.resolve(path.dirname(packageJsonPath), relativeBin), ...args.slice(1)],
      };
    }
  }
  throw new Error(`Could not resolve local package binary for npx command: ${binName}`);
}

function findPackageJson(start: string, packageName: string): string | undefined {
  let directory = path.resolve(start);
  while (true) {
    const candidate = path.join(directory, 'node_modules', ...packageName.split('/'), 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function chooseArgs(mode: SelectionPlan['mode'], command: CommandConfig, files: readonly string[]): readonly string[] {
  if (mode === 'full') return command.fullArgs;
  const args = command.args.flatMap((arg) => (arg === '{files}' ? files : [arg]));
  const length = command.executable.length + args.reduce((total, arg) => total + arg.length + 1, 0);
  return length > command.maxArgumentCharacters ? command.fullArgs : args;
}
