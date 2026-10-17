import path from 'node:path';

import type { CodegraphSelectionConfig, CommandConfig } from './config.js';
import { runProcess } from './process.js';
import type { SelectionPlan, TestKind } from './types.js';

export interface ExecutionResult {
  readonly inputFingerprint: string;
  readonly mode: SelectionPlan['mode'];
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
  const commands: {
    kind: TestKind;
    executable: string;
    args: readonly string[];
    exitCode: number;
  }[] = [];
  if (plan.mode === 'empty') return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, commands, exitCode: 0 };
  for (const [kind, command] of [
    ['unit', config.unit],
    ['playwright', config.playwright],
  ] as const) {
    const files = plan.tests.filter((test) => test.kind === kind).map((test) => test.path);
    if (plan.mode !== 'full' && files.length === 0) continue;
    const args = chooseArgs(plan.mode, command, files);
    const result = await runProcess({
      executable: command.executable,
      args,
      cwd: command.cwd ? path.resolve(plan.repositoryRoot, command.cwd) : plan.repositoryRoot,
      timeoutMs,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    commands.push({ kind, executable: command.executable, args, exitCode: result.exitCode });
    if (result.exitCode !== 0) {
      return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, commands, exitCode: result.exitCode };
    }
  }
  return { inputFingerprint: plan.inputFingerprint, mode: plan.mode, commands, exitCode: 0 };
}

function chooseArgs(mode: SelectionPlan['mode'], command: CommandConfig, files: readonly string[]): readonly string[] {
  if (mode === 'full') return command.fullArgs;
  const args = command.args.flatMap((arg) => (arg === '{files}' ? files : [arg]));
  const length = command.executable.length + args.reduce((total, arg) => total + arg.length + 1, 0);
  return length > command.maxArgumentCharacters ? command.fullArgs : args;
}
