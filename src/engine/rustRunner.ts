import type {
  ExecutionOptions,
  ExecutionResult,
  ProblemSpec,
} from '../types/schema';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  buildTimeoutResult,
  type RawCaseOutcome,
} from './resultBuilder';
import {
  generateRustHarnessSource,
  parseRustcPlainDiagnostics,
  parseRustStdoutCases,
  VALID_RUST_IDENT,
} from './rustHarness';

const DEFAULT_RUST_TIMEOUT_MS = 3000;
const RUST_PLAYGROUND_URL = 'https://play.rust-lang.org/execute';

export async function executeRust(
  userCode: string,
  problemSpec: ProblemSpec,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_RUST_TIMEOUT_MS;
  const startedAt = performance.now();

  // Direct in-process server executor when running in Node without explicit HTTP apiBaseUrl (e.g. QA scripts)
  if (typeof window === 'undefined' && !options?.apiBaseUrl) {
    const baseHref = import.meta.url;
    const serverModuleUrl = new URL(
      ['..', '..', 'server', 'rustExecutor.ts'].join('/'),
      baseHref
    ).href;
    const mod = (await import(/* @vite-ignore */ serverModuleUrl)) as {
      executeRustServer: (req: {
        userCode: string;
        problemSpec: ProblemSpec;
        timeoutMs?: number;
      }) => Promise<ExecutionResult>;
    };
    return mod.executeRustServer({ userCode, problemSpec, timeoutMs });
  }

  const envApiBase =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL
      : '';
  const baseUrl = (options?.apiBaseUrl ?? envApiBase).replace(/\/+$/, '');

  // Try backend `/api/execute/rust` first when available (local Express dev/prod or custom API host)
  try {
    const response = await fetch(`${baseUrl}/api/execute/rust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode, problemSpec, timeoutMs }),
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as ExecutionResult;
      }
    }

    // Static hosting (e.g. GitHub Pages) returns 404/405 for `/api/execute/rust` -> fall back to Rust Playground API
    if (
      typeof window !== 'undefined' &&
      !options?.apiBaseUrl &&
      !envApiBase &&
      (response.status === 404 || response.status === 405)
    ) {
      return executeRustViaPlayground(userCode, problemSpec, timeoutMs, startedAt);
    }

    const errText = await response.text().catch(() => '');
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Rust execution server error (${response.status}): ${errText || response.statusText}`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'rustc-server',
    });
  } catch (err) {
    if (typeof window !== 'undefined' && !options?.apiBaseUrl && !envApiBase) {
      return executeRustViaPlayground(userCode, problemSpec, timeoutMs, startedAt);
    }

    const msg = err instanceof Error ? err.message : String(err);
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Could not reach Rust execution API (/api/execute/rust): ${msg}`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'rustc-server',
    });
  }
}

interface RustPlaygroundResponse {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Zero-backend static hosting fallback (e.g. GitHub Pages) using the official
 * Rust Playground CORS API (`https://play.rust-lang.org/execute`).
 */
async function executeRustViaPlayground(
  userCode: string,
  problemSpec: ProblemSpec,
  timeoutMs: number,
  startedAt: number
): Promise<ExecutionResult> {
  const fnName = problemSpec.functionName.trim();
  if (!VALID_RUST_IDENT.test(fnName)) {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Invalid Rust entry function identifier '${fnName}'.`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'rust-playground',
    });
  }

  const normalizedUserCode = userCode.replace(/\r\n/g, '\n');
  const userLineCount = normalizedUserCode.split('\n').length;
  const fullSource = generateRustHarnessSource(
    normalizedUserCode,
    fnName,
    problemSpec
  );

  try {
    const response = await fetch(RUST_PLAYGROUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'stable',
        mode: 'debug',
        edition: '2021',
        crateType: 'bin',
        tests: false,
        backtrace: false,
        code: fullSource,
      }),
    });

    if (!response.ok) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [
          {
            severity: 'error',
            message: `Rust Playground API error (${response.status}): ${response.statusText}`,
          },
        ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rust-playground',
      });
    }

    const data = (await response.json()) as RustPlaygroundResponse;
    const stdout = data.stdout ?? '';
    const stderr = data.stderr ?? '';

    if (/timeout|timed out|killed/i.test(stderr) && !data.success) {
      return buildTimeoutResult({
        tests: problemSpec.tests,
        timeoutMs,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rust-playground',
      });
    }

    const parsedCases = parseRustStdoutCases(stdout);
    const diagnostics = parseRustcPlainDiagnostics(stderr, userLineCount);

    if (!data.success && parsedCases.size === 0) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics:
          diagnostics.length > 0
            ? diagnostics
            : [
                {
                  severity: 'error',
                  message: stderr.trim() || 'Rust compilation failed on Rust Playground.',
                },
              ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rust-playground',
      });
    }

    const caseOutcomes: RawCaseOutcome[] = problemSpec.tests.map((_, idx) => {
      return (
        parsedCases.get(idx) ?? {
          status: 'error',
          passed: false,
          run: 'Error: missing test output from harness',
        }
      );
    });

    return buildExecutionResult({
      tests: problemSpec.tests,
      caseOutcomes,
      diagnostics,
      durationMs: performance.now() - startedAt,
      runnerUsed: 'rust-playground',
      timeoutMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Could not reach Rust Playground (${RUST_PLAYGROUND_URL}): ${msg}`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'rust-playground',
    });
  }
}
