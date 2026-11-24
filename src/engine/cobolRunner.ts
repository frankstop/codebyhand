import {
  normalizeCobolOutput,
  type CobolBackendMode,
  type CobolFormatMode,
  type ExecutionOptions,
  type ExecutionResult,
  type ProblemSpec,
} from '../types/schema';
import { parseCobcDiagnostics } from './cobolDiagnostics';
import type { CobolWasmWorkerMessage } from './cobolWasmWorker';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  buildTimeoutResult,
  type RawCaseOutcome,
} from './resultBuilder';

const DEFAULT_COBOL_TIMEOUT_MS = 2000;
const WASM_BOOTSTRAP_COMPILE_TIMEOUT_MS = 45000;

let sharedWasmWorker: Worker | null = null;
let nextWasmRequestId = 1;

export async function executeCobol(
  userCode: string,
  problemSpec: ProblemSpec,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const cobolFormat: CobolFormatMode = options?.cobolFormat ?? 'free';
  const cobolBackend: CobolBackendMode = options?.cobolBackend ?? 'auto';
  const timeoutMs = options?.timeoutMs ?? DEFAULT_COBOL_TIMEOUT_MS;

  if (cobolBackend === 'wasm') {
    return executeCobolWasm(userCode, problemSpec, cobolFormat, timeoutMs);
  }

  // Node/Headless mode without explicit apiBaseUrl -> invoke server executor directly
  if (typeof window === 'undefined' && !options?.apiBaseUrl) {
    const baseHref = import.meta.url;
    const serverModuleUrl = new URL(
      ['..', '..', 'server', 'cobolExecutor.ts'].join('/'),
      baseHref
    ).href;
    const mod = (await import(/* @vite-ignore */ serverModuleUrl)) as {
      executeCobolServer: (req: {
        userCode: string;
        problemSpec: ProblemSpec;
        cobolFormat?: CobolFormatMode;
        timeoutMs?: number;
      }) => Promise<ExecutionResult>;
    };
    return mod.executeCobolServer({
      userCode,
      problemSpec,
      cobolFormat,
      timeoutMs,
    });
  }

  // Try HTTP server endpoint (`/api/execute/cobol`)
  const startedAt = performance.now();
  const baseUrl = (options?.apiBaseUrl ?? '').replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/execute/cobol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userCode,
        problemSpec,
        cobolFormat,
        timeoutMs,
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as ExecutionResult;
      }
    }

    // In 'auto' mode inside a browser, fall back automatically to in-browser GnuCOBOL WASM
    if (
      cobolBackend === 'auto' &&
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined'
    ) {
      return executeCobolWasmInBrowserWorker(
        userCode,
        problemSpec,
        cobolFormat,
        timeoutMs
      );
    }

    const errText = await response.text().catch(() => '');
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `COBOL execution server error (${response.status}): ${errText || response.statusText}`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'cobc-server',
    });
  } catch (err) {
    if (
      cobolBackend === 'auto' &&
      typeof window !== 'undefined' &&
      typeof Worker !== 'undefined'
    ) {
      return executeCobolWasmInBrowserWorker(
        userCode,
        problemSpec,
        cobolFormat,
        timeoutMs
      );
    }

    const msg = err instanceof Error ? err.message : String(err);
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Could not reach COBOL execution API (/api/execute/cobol): ${msg}`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'cobc-server',
    });
  }
}

async function executeCobolWasm(
  userCode: string,
  problemSpec: ProblemSpec,
  cobolFormat: CobolFormatMode,
  timeoutMs: number
): Promise<ExecutionResult> {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    return executeCobolWasmInBrowserWorker(
      userCode,
      problemSpec,
      cobolFormat,
      timeoutMs
    );
  }
  return executeCobolWasmInNode(userCode, problemSpec, cobolFormat, timeoutMs);
}

function getBrowserWasmWorker(): Worker {
  if (!sharedWasmWorker) {
    sharedWasmWorker = new Worker(
      new URL('./cobolWasmWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return sharedWasmWorker;
}

function resetBrowserWasmWorker(): void {
  if (sharedWasmWorker) {
    sharedWasmWorker.terminate();
    sharedWasmWorker = null;
  }
}

function executeCobolWasmInBrowserWorker(
  userCode: string,
  problemSpec: ProblemSpec,
  cobolFormat: CobolFormatMode,
  timeoutMs: number
): Promise<ExecutionResult> {
  const startedAt = performance.now();
  const requestId = nextWasmRequestId++;
  const worker = getBrowserWasmWorker();
  const basePath =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : './';
  const assetBaseUrl = new URL(`${basePath}cobol-wasm/`, window.location.href).href;

  return new Promise<ExecutionResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const cleanupListeners = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
    };

    const startTimer = (ms: number, isRuntimePhase: boolean) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanupListeners();
        resetBrowserWasmWorker();

        if (isRuntimePhase) {
          resolve(
            buildTimeoutResult({
              tests: problemSpec.tests,
              timeoutMs,
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
        } else {
          resolve(
            buildCompileErrorResult({
              tests: problemSpec.tests,
              diagnostics: [
                {
                  severity: 'error',
                  message: `COBOL WASM toolchain load/compile timed out (> ${ms} ms).`,
                },
              ],
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
        }
      }, ms);
    };

    const onMessage = (event: MessageEvent<CobolWasmWorkerMessage>) => {
      const msg = event.data;
      if (!msg || msg.requestId !== requestId) return;

      if (msg.type === 'compiled') {
        // Compilation succeeded; arm strict per-suite runtime timeout (`timeoutMs * testCount` or `timeoutMs`)
        startTimer(timeoutMs, true);
        return;
      }

      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupListeners();

      if (msg.type === 'done') {
        resolve({
          ...msg.result,
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        });
      } else {
        resetBrowserWasmWorker();
        resolve(
          buildCompileErrorResult({
            tests: problemSpec.tests,
            diagnostics: [
              {
                severity: 'error',
                message: `COBOL WASM error: ${msg.error}`,
              },
            ],
            durationMs: performance.now() - startedAt,
            runnerUsed: 'cobol-wasm',
          })
        );
      }
    };

    const onError = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanupListeners();
      resetBrowserWasmWorker();
      event.preventDefault?.();
      resolve(
        buildCompileErrorResult({
          tests: problemSpec.tests,
          diagnostics: [
            {
              severity: 'error',
              message: event.message || 'COBOL WASM worker failed to load.',
            },
          ],
          durationMs: performance.now() - startedAt,
          runnerUsed: 'cobol-wasm',
        })
      );
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    startTimer(WASM_BOOTSTRAP_COMPILE_TIMEOUT_MS, false);

    worker.postMessage({
      requestId,
      userCode,
      problemSpec,
      cobolFormat,
      timeoutMs,
      assetBaseUrl,
    });
  });
}

async function executeCobolWasmInNode(
  userCode: string,
  problemSpec: ProblemSpec,
  cobolFormat: CobolFormatMode,
  timeoutMs: number
): Promise<ExecutionResult> {
  const startedAt = performance.now();
  const wtModName = 'node:' + 'worker_threads';
  const { Worker: NodeWorker } = (await import(
    /* @vite-ignore */ wtModName
  )) as typeof import('node:worker_threads');

  const baseHref = import.meta.url;
  const cobolWasmPkgUrl = new URL(
    ['..', '..', 'node_modules', '@live-codes', 'cobol-wasm', 'src', 'index.node.js'].join('/'),
    baseHref
  ).href;
  const llvmCobolUrl = new URL(
    ['..', '..', 'node_modules', '@wasm-idle', 'llvm-core', 'dist', 'cobol', 'src', 'index.js'].join('/'),
    baseHref
  ).href;

  const workerScript = `
    import { parentPort, workerData } from 'node:worker_threads';
    const { createCompiler } = await import(${JSON.stringify(cobolWasmPkgUrl)});
    const { createCobolCompiler, executeBrowserCobolArtifact } = await import(${JSON.stringify(llvmCobolUrl)});

    // Install packaged asset fetch shim via createCompiler()
    const bootstrapHolder = await createCompiler({ sourceFormat: workerData.cobolFormat });
    try {
      const compiler = await createCobolCompiler({
        runtimeBaseUrl: 'https://cobol-wasm-assets.invalid/cobol/',
        clangRuntimeBaseUrl: 'https://cobol-wasm-assets.invalid/clang/',
      });

      const code = workerData.userCode.endsWith('\\n')
        ? workerData.userCode
        : workerData.userCode + '\\n';

      const compileRes = await compiler.compile({
        code,
        fileName: 'prog.cob',
        sourceFormat: workerData.cobolFormat,
        log: false,
      });

      const rawDiag = compileRes.success
        ? (compileRes.stdout ?? '')
        : (compileRes.stdout?.trim() ? compileRes.stdout : (compileRes.stderr ?? ''));

      if (!compileRes.success || !compileRes.artifact) {
        parentPort.postMessage({ type: 'compile_error', rawDiag });
      } else {
        parentPort.postMessage({ type: 'compiled', rawDiag });
        const outputs = [];
        for (const tc of workerData.tests) {
          const outChunks = [];
          const errChunks = [];
          let sent = false;
          const stdinStr = tc.stdin
            ? (tc.stdin.endsWith('\\n') ? tc.stdin : tc.stdin + '\\n')
            : '';
          const execRes = await executeBrowserCobolArtifact(compileRes.artifact, {
            args: [],
            stdin: stdinStr ? () => { if (sent) return null; sent = true; return stdinStr; } : () => null,
            stdout: (c) => outChunks.push(c),
            stderr: (c) => errChunks.push(c),
          });
          outputs.push({
            exitCode: execRes.exitCode,
            stdout: outChunks.join(''),
            stderr: errChunks.join(''),
          });
        }
        parentPort.postMessage({ type: 'done', rawDiag, outputs });
      }
    } catch (err) {
      parentPort.postMessage({ type: 'fatal', error: err?.message || String(err) });
    } finally {
      bootstrapHolder.dispose();
    }
  `;

  return new Promise<ExecutionResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const worker = new NodeWorker(workerScript, {
      eval: true,
      workerData: {
        userCode: userCode.replace(/\r\n/g, '\n'),
        cobolFormat,
        tests: problemSpec.tests,
      },
    });

    const armTimer = (ms: number, runtimePhase: boolean) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        void worker.terminate();
        if (runtimePhase) {
          resolve(
            buildTimeoutResult({
              tests: problemSpec.tests,
              timeoutMs,
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
        } else {
          resolve(
            buildCompileErrorResult({
              tests: problemSpec.tests,
              diagnostics: [
                {
                  severity: 'error',
                  message: `COBOL WASM compile timed out (> ${ms} ms).`,
                },
              ],
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
        }
      }, ms);
    };

    armTimer(WASM_BOOTSTRAP_COMPILE_TIMEOUT_MS, false);

    worker.on(
      'message',
      (
        msg:
          | { type: 'compiled'; rawDiag: string }
          | { type: 'compile_error'; rawDiag: string }
          | {
              type: 'done';
              rawDiag: string;
              outputs: Array<{
                exitCode: number;
                stdout: string;
                stderr: string;
              }>;
            }
          | { type: 'fatal'; error: string }
      ) => {
        if (msg.type === 'compiled') {
          armTimer(timeoutMs, true);
          return;
        }

        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();

        if (msg.type === 'compile_error') {
          const diags = parseCobcDiagnostics(msg.rawDiag);
          resolve(
            buildCompileErrorResult({
              tests: problemSpec.tests,
              diagnostics:
                diags.length > 0
                  ? diags
                  : [
                      {
                        severity: 'error',
                        message: msg.rawDiag.trim() || 'COBOL WASM compilation failed.',
                      },
                    ],
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
          return;
        }

        if (msg.type === 'fatal') {
          resolve(
            buildCompileErrorResult({
              tests: problemSpec.tests,
              diagnostics: [{ severity: 'error', message: msg.error }],
              durationMs: performance.now() - startedAt,
              runnerUsed: 'cobol-wasm',
            })
          );
          return;
        }

        const diagnostics = parseCobcDiagnostics(msg.rawDiag);
        const caseOutcomes: RawCaseOutcome[] = problemSpec.tests.map(
          (tc, idx) => {
            const out = msg.outputs[idx];
            if (!out || out.exitCode !== 0) {
              return {
                status: 'error',
                passed: false,
                run: out?.stderr?.trim()
                  ? `Runtime error: ${out.stderr.trim()}`
                  : `Runtime error (exit code ${out?.exitCode ?? 'unknown'})`,
              };
            }
            const actualNorm = normalizeCobolOutput(out.stdout);
            const expectedNorm = normalizeCobolOutput(tc.expectedStdout ?? '');
            const passed = actualNorm === expectedNorm;
            return {
              status: passed ? 'pass' : 'fail',
              passed,
              run: actualNorm,
            };
          }
        );

        resolve(
          buildExecutionResult({
            tests: problemSpec.tests,
            caseOutcomes,
            diagnostics,
            durationMs: performance.now() - startedAt,
            runnerUsed: 'cobol-wasm',
            timeoutMs,
          })
        );
      }
    );

    worker.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(
        buildCompileErrorResult({
          tests: problemSpec.tests,
          diagnostics: [{ severity: 'error', message: err.message }],
          durationMs: performance.now() - startedAt,
          runnerUsed: 'cobol-wasm',
        })
      );
    });
  });
}
