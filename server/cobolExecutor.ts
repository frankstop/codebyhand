import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeCobolOutput,
  type CobolFormatMode,
  type ExecutionResult,
  type ProblemSpec,
} from '../src/types/schema';
import { parseCobcDiagnostics } from '../src/engine/cobolDiagnostics';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  type RawCaseOutcome,
} from '../src/engine/resultBuilder';
import { resolveCobcBinary } from './compilerPaths';
import { spawnWithTimeout } from './processRunner';

const DEFAULT_COBOL_TEST_TIMEOUT_MS = 2000;
const COBOL_COMPILE_TIMEOUT_MS = 15000;

export interface CobolExecuteRequest {
  userCode: string;
  problemSpec: ProblemSpec;
  cobolFormat?: CobolFormatMode;
  timeoutMs?: number;
}

export async function executeCobolServer(
  request: CobolExecuteRequest
): Promise<ExecutionResult> {
  const { userCode, problemSpec } = request;
  const cobolFormat: CobolFormatMode = request.cobolFormat ?? 'free';
  const timeoutMs = request.timeoutMs ?? DEFAULT_COBOL_TEST_TIMEOUT_MS;
  const startedAt = performance.now();

  const normalizedSource = ensureTrailingNewline(
    userCode.replace(/\r\n/g, '\n')
  );

  if (process.env.JUDGE0_API_URL?.trim()) {
    return executeCobolViaJudge0({
      normalizedSource,
      cobolFormat,
      problemSpec,
      timeoutMs,
      startedAt,
    });
  }

  const cobcBin = resolveCobcBinary();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cbh-cobol-'));

  try {
    const srcPath = path.join(tmpDir, 'prog.cob');
    const binName = process.platform === 'win32' ? 'prog.exe' : 'prog';
    const binPath = path.join(tmpDir, binName);

    await fs.writeFile(srcPath, normalizedSource, 'utf8');

    const formatFlag = cobolFormat === 'fixed' ? '-fixed' : '-free';
    const compileRes = await spawnWithTimeout(
      cobcBin,
      ['-x', formatFlag, 'prog.cob', '-o', binName],
      {
        cwd: tmpDir,
        timeoutMs: COBOL_COMPILE_TIMEOUT_MS,
      }
    );

    if (compileRes.spawnError) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [
          {
            severity: 'error',
            message: `Failed to invoke cobc (${cobcBin}): ${compileRes.spawnError.message}`,
          },
        ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'cobc-server',
      });
    }

    if (compileRes.timedOut) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [
          {
            severity: 'error',
            message: `COBOL compilation timed out (> ${COBOL_COMPILE_TIMEOUT_MS} ms).`,
          },
        ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'cobc-server',
      });
    }

    const combinedCompileText = [compileRes.stderr, compileRes.stdout]
      .filter(Boolean)
      .join('\n');
    const diagnostics = parseCobcDiagnostics(combinedCompileText);

    if (compileRes.exitCode !== 0) {
      const errorDiagnostics =
        diagnostics.filter((d) => d.severity === 'error').length > 0
          ? diagnostics
          : [
              {
                severity: 'error' as const,
                message:
                  combinedCompileText.trim() || 'COBOL compilation failed.',
              },
            ];

      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: errorDiagnostics,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'cobc-server',
      });
    }

    // Run compiled binary against all test cases in parallel with strict per-test timeout
    const caseOutcomes = await Promise.all(
      problemSpec.tests.map(async (tc): Promise<RawCaseOutcome> => {
        const stdinText = formatCobolStdin(tc.stdin);
        const runRes = await spawnWithTimeout(binPath, [], {
          cwd: tmpDir,
          stdin: stdinText,
          timeoutMs,
        });

        if (runRes.timedOut) {
          return {
            status: 'timeout',
            passed: false,
            run: `Timed out (> ${timeoutMs} ms)`,
          };
        }

        if (runRes.exitCode !== 0) {
          const errDetail = runRes.stderr.trim();
          return {
            status: 'error',
            passed: false,
            run: errDetail
              ? `Runtime error: ${errDetail}`
              : `Runtime error (exit code ${runRes.exitCode})`,
          };
        }

        const actualNorm = normalizeCobolOutput(runRes.stdout);
        const expectedNorm = normalizeCobolOutput(tc.expectedStdout ?? '');
        const passed = actualNorm === expectedNorm;

        return {
          status: passed ? 'pass' : 'fail',
          passed,
          run: actualNorm,
        };
      })
    );

    return buildExecutionResult({
      tests: problemSpec.tests,
      caseOutcomes,
      diagnostics,
      durationMs: performance.now() - startedAt,
      runnerUsed: 'cobc-server',
      timeoutMs,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function ensureTrailingNewline(code: string): string {
  return code.endsWith('\n') ? code : `${code}\n`;
}

function formatCobolStdin(stdin?: string): string {
  if (!stdin) return '';
  const normalized = stdin.replace(/\r\n/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

async function executeCobolViaJudge0(params: {
  normalizedSource: string;
  cobolFormat: CobolFormatMode;
  problemSpec: ProblemSpec;
  timeoutMs: number;
  startedAt: number;
}): Promise<ExecutionResult> {
  const { normalizedSource, cobolFormat, problemSpec, timeoutMs, startedAt } =
    params;
  const baseUrl = process.env.JUDGE0_API_URL!.replace(/\/+$/, '');
  const apiKey = process.env.JUDGE0_API_KEY?.trim();
  const apiHost = process.env.JUDGE0_API_HOST?.trim();
  const languageId = Number(process.env.JUDGE0_COBOL_LANG_ID) || 77;
  const compilerOptions = cobolFormat === 'fixed' ? '-fixed' : '-free';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['X-Auth-Token'] = apiKey;
    headers['X-RapidAPI-Key'] = apiKey;
  }
  if (apiHost) {
    headers['X-RapidAPI-Host'] = apiHost;
  }

  const decodeB64 = (val?: string | null) =>
    val ? Buffer.from(val, 'base64').toString('utf8') : '';

  let compileErrorResult: ExecutionResult | null = null;

  const caseOutcomes = await Promise.all(
    problemSpec.tests.map(async (tc): Promise<RawCaseOutcome> => {
      const response = await fetch(
        `${baseUrl}/submissions?base64_encoded=true&wait=true`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            language_id: languageId,
            source_code: Buffer.from(normalizedSource, 'utf8').toString('base64'),
            stdin: Buffer.from(formatCobolStdin(tc.stdin), 'utf8').toString(
              'base64'
            ),
            compiler_options: compilerOptions,
            cpu_time_limit: Math.max(1, Number((timeoutMs / 1000).toFixed(2))),
            wall_time_limit: Math.max(
              2,
              Number(((timeoutMs + 1000) / 1000).toFixed(2))
            ),
          }),
        }
      );

      if (!response.ok) {
        return {
          status: 'error',
          passed: false,
          run: `Judge0 proxy error (${response.status})`,
        };
      }

      const data = (await response.json()) as {
        stdout?: string | null;
        stderr?: string | null;
        compile_output?: string | null;
        status?: { id: number; description: string };
      };

      const statusId = data.status?.id ?? 0;
      const compileOutput = decodeB64(data.compile_output);

      if (statusId === 6 && !compileErrorResult) {
        compileErrorResult = buildCompileErrorResult({
          tests: problemSpec.tests,
          diagnostics: parseCobcDiagnostics(compileOutput),
          durationMs: performance.now() - startedAt,
          runnerUsed: 'judge0-cobol',
        });
      }

      if (statusId === 5) {
        return {
          status: 'timeout',
          passed: false,
          run: `Timed out (> ${timeoutMs} ms)`,
        };
      }

      if (statusId !== 3) {
        const stderr = decodeB64(data.stderr);
        return {
          status: 'error',
          passed: false,
          run: stderr.trim()
            ? `Runtime error: ${stderr.trim()}`
            : `Runtime error (${data.status?.description ?? statusId})`,
        };
      }

      const actualNorm = normalizeCobolOutput(decodeB64(data.stdout));
      const expectedNorm = normalizeCobolOutput(tc.expectedStdout ?? '');
      const passed = actualNorm === expectedNorm;
      return {
        status: passed ? 'pass' : 'fail',
        passed,
        run: actualNorm,
      };
    })
  );

  if (compileErrorResult) {
    return compileErrorResult;
  }

  return buildExecutionResult({
    tests: problemSpec.tests,
    caseOutcomes,
    durationMs: performance.now() - startedAt,
    runnerUsed: 'judge0-cobol',
    timeoutMs,
  });
}
