import { spawn } from 'node:child_process';
import { augmentSystemPath } from './compilerPaths';

export interface SpawnOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs: number;
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  durationMs: number;
  spawnError?: Error;
}

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MiB cap against output-flood loops

export function spawnWithTimeout(
  command: string,
  args: string[],
  options: SpawnOptions
): Promise<SpawnResult> {
  const {
    cwd,
    stdin,
    timeoutMs,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    env,
  } = options;

  const startedAt = performance.now();
  const useProcessGroup = process.platform !== 'win32';

  return new Promise<SpawnResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    const child = spawn(command, args, {
      cwd,
      detached: useProcessGroup,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...env,
        PATH: augmentSystemPath(env?.PATH ?? process.env.PATH),
      },
    });

    const forceKill = () => {
      if (useProcessGroup && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
          return;
        } catch {
          // Fall back to direct child kill
        }
      }
      try {
        child.kill('SIGKILL');
      } catch {
        // Already exited
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      forceKill();
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdoutBytes >= maxOutputBytes) return;
      const remaining = maxOutputBytes - stdoutBytes;
      const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      stdoutChunks.push(slice);
      stdoutBytes += slice.length;
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrBytes >= maxOutputBytes) return;
      const remaining = maxOutputBytes - stderrBytes;
      const slice = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk;
      stderrChunks.push(slice);
      stderrBytes += slice.length;
    });

    child.stdin.on('error', () => {
      // Ignore EPIPE when child exits before consuming all stdin
    });

    if (stdin !== undefined && stdin.length > 0) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: null,
        signal: null,
        timedOut,
        durationMs: performance.now() - startedAt,
        spawnError: err,
      });
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode: code,
        signal,
        timedOut,
        durationMs: performance.now() - startedAt,
      });
    });
  });
}
