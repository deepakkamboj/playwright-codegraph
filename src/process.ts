import { spawn } from 'node:child_process';

export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly input?: string;
  readonly timeoutMs: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export class ProcessFailure extends Error {
  public constructor(
    message: string,
    public readonly result?: ProcessResult,
    public readonly timedOut = false,
  ) {
    super(message);
  }
}

export async function runProcess(request: ProcessRequest): Promise<ProcessResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(request.executable, [...request.args], {
      cwd: request.cwd,
      env: { ...process.env, ...request.env },
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer =
      request.timeoutMs > 0
        ? setTimeout(() => {
            child.kill();
            if (!settled) {
              settled = true;
              reject(new ProcessFailure(`Process timed out: ${request.executable}`, undefined, true));
            }
          }, request.timeoutMs)
        : undefined;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', (error) => {
      if (timer) clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new ProcessFailure(`Could not start ${request.executable}: ${error.message}`));
      }
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.stdin.end(request.input);
  });
}
