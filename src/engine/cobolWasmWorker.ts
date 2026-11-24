import {
  createCobolCompiler,
  executeBrowserCobolArtifact,
  type BrowserCobolCompiler,
} from '@wasm-idle/llvm-core/cobol';
import {
  normalizeCobolOutput,
  type CobolFormatMode,
  type ExecutionResult,
  type ProblemSpec,
} from '../types/schema';
import { parseCobcDiagnostics } from './cobolDiagnostics';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  type RawCaseOutcome,
} from './resultBuilder';

export interface CobolWasmWorkerRequest {
  requestId: number;
  userCode: string;
  problemSpec: ProblemSpec;
  cobolFormat: CobolFormatMode;
  timeoutMs: number;
  assetBaseUrl: string;
}

export type CobolWasmWorkerMessage =
  | { type: 'compiled'; requestId: number }
  | { type: 'done'; requestId: number; result: ExecutionResult }
  | { type: 'fatal'; requestId: number; error: string };

const ANSI_ESCAPE = /\u001b\[[0-9;]*[A-Za-z]/g;

// Ensure non-COOP/COEP origins do not fail `buf instanceof SharedArrayBuffer` inside @wasm-idle/llvm-core
function ensureSharedArrayBufferStub(): void {
  if (typeof globalThis.SharedArrayBuffer === 'undefined') {
    (globalThis as Record<string, unknown>).SharedArrayBuffer =
      class SharedArrayBuffer {
        constructor() {
          throw new Error('SharedArrayBuffer is not available in this context');
        }
      };
  }
}

let compilerPromise: Promise<BrowserCobolCompiler> | null = null;
let cachedBaseUrl = '';

function getOrCreateWasmCompiler(
  assetBaseUrl: string
): Promise<BrowserCobolCompiler> {
  if (!compilerPromise || cachedBaseUrl !== assetBaseUrl) {
    ensureSharedArrayBufferStub();
    cachedBaseUrl = assetBaseUrl;
    const normalizedBase = assetBaseUrl.endsWith('/')
      ? assetBaseUrl
      : `${assetBaseUrl}/`;
    const cobolBaseUrl = new URL('cobol/', normalizedBase).href;
    const clangBaseUrl = new URL('clang/', normalizedBase).href;

    compilerPromise = createCobolCompiler({
      runtimeBaseUrl: cobolBaseUrl,
      clangRuntimeBaseUrl: clangBaseUrl,
    }).catch((err) => {
      compilerPromise = null;
      throw err;
    });
  }
  return compilerPromise;
}

function makeOneShotStdin(rawInput?: string): () => string | null {
  if (!rawInput) return () => null;
  const normalized = rawInput.replace(/\r\n/g, '\n');
  const payload = normalized.endsWith('\n') ? normalized : `${normalized}\n`;
  let consumed = false;
  return () => {
    if (consumed) return null;
    consumed = true;
    return payload;
  };
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<CobolWasmWorkerRequest>) => void) | null;
  postMessage: (message: CobolWasmWorkerMessage) => void;
};

workerScope.onmessage = async (event: MessageEvent<CobolWasmWorkerRequest>) => {
  const {
    requestId,
    userCode,
    problemSpec,
    cobolFormat,
    timeoutMs,
    assetBaseUrl,
  } = event.data;
  const startedAt = performance.now();

  try {
    const compiler = await getOrCreateWasmCompiler(assetBaseUrl);
    const normalizedSource = userCode.replace(/\r\n/g, '\n');
    const codeWithNewline = normalizedSource.endsWith('\n')
      ? normalizedSource
      : `${normalizedSource}\n`;

    const compileResult = await compiler.compile({
      code: codeWithNewline,
      fileName: 'prog.cob',
      sourceFormat: cobolFormat,
      log: false,
    });

    const rawDiagText = compileResult.success
      ? (compileResult.stdout ?? '')
      : compileResult.stdout?.trim()
        ? compileResult.stdout
        : (compileResult.stderr ?? '');
    const diagnostics = parseCobcDiagnostics(rawDiagText);

    if (!compileResult.success || !compileResult.artifact) {
      const errorDiagnostics =
        diagnostics.filter((d) => d.severity === 'error').length > 0
          ? diagnostics
          : [
              {
                severity: 'error' as const,
                message:
                  rawDiagText.replace(ANSI_ESCAPE, '').trim() ||
                  'COBOL WASM compilation failed.',
              },
            ];

      workerScope.postMessage({
        type: 'done',
        requestId,
        result: buildCompileErrorResult({
          tests: problemSpec.tests,
          diagnostics: errorDiagnostics,
          durationMs: performance.now() - startedAt,
          runnerUsed: 'cobol-wasm',
        }),
      });
      return;
    }

    // Signal main thread that asset bootstrap + compilation finished so strict runtime timeout begins
    workerScope.postMessage({ type: 'compiled', requestId });

    const caseOutcomes: RawCaseOutcome[] = [];
    for (const tc of problemSpec.tests) {
      const stdoutChunks: string[] = [];
      const stderrChunks: string[] = [];

      const execRes = await executeBrowserCobolArtifact(
        compileResult.artifact,
        {
          args: [],
          stdin: makeOneShotStdin(tc.stdin),
          stdout: (chunk: string) => stdoutChunks.push(chunk),
          stderr: (chunk: string) => stderrChunks.push(chunk),
        }
      );

      if (execRes.exitCode !== 0) {
        const stderrClean = stderrChunks
          .join('')
          .replace(ANSI_ESCAPE, '')
          .trim();
        caseOutcomes.push({
          status: 'error',
          passed: false,
          run: stderrClean
            ? `Runtime error: ${stderrClean}`
            : `Runtime error (exit code ${execRes.exitCode})`,
        });
      } else {
        const rawStdout = stdoutChunks.join('').replace(ANSI_ESCAPE, '');
        const actualNorm = normalizeCobolOutput(rawStdout);
        const expectedNorm = normalizeCobolOutput(tc.expectedStdout ?? '');
        const passed = actualNorm === expectedNorm;
        caseOutcomes.push({
          status: passed ? 'pass' : 'fail',
          passed,
          run: actualNorm,
        });
      }
    }

    workerScope.postMessage({
      type: 'done',
      requestId,
      result: buildExecutionResult({
        tests: problemSpec.tests,
        caseOutcomes,
        diagnostics,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'cobol-wasm',
        timeoutMs,
      }),
    });
  } catch (err) {
    workerScope.postMessage({
      type: 'fatal',
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
