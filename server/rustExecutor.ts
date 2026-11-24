import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  CompilerDiagnostic,
  ExecutionResult,
  ProblemSpec,
} from '../src/types/schema';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  buildTimeoutResult,
  type RawCaseOutcome,
} from '../src/engine/resultBuilder';
import { resolveRustcBinary } from './compilerPaths';
import { spawnWithTimeout } from './processRunner';

const DEFAULT_RUST_RUN_TIMEOUT_MS = 3000;
const RUST_COMPILE_TIMEOUT_MS = 15000;
const CASE_PREFIX = '__CBH_CASE__:';
const VALID_RUST_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface RustExecuteRequest {
  userCode: string;
  problemSpec: ProblemSpec;
  timeoutMs?: number;
}

interface RustHarnessCasePayload {
  index: number;
  status: 'pass' | 'fail' | 'error';
  passed: boolean;
  run: string;
}

export async function executeRustServer(
  request: RustExecuteRequest
): Promise<ExecutionResult> {
  const { userCode, problemSpec } = request;
  const timeoutMs = request.timeoutMs ?? DEFAULT_RUST_RUN_TIMEOUT_MS;
  const startedAt = performance.now();

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
      runnerUsed: 'rustc-server',
    });
  }

  const normalizedUserCode = userCode.replace(/\r\n/g, '\n');
  const userLineCount = normalizedUserCode.split('\n').length;
  const fullSource = generateRustHarnessSource(
    normalizedUserCode,
    fnName,
    problemSpec
  );

  if (process.env.JUDGE0_API_URL?.trim()) {
    return executeRustViaJudge0({
      fullSource,
      userLineCount,
      problemSpec,
      timeoutMs,
      startedAt,
    });
  }

  const rustcBin = resolveRustcBinary();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cbh-rust-'));

  try {
    const mainRsPath = path.join(tmpDir, 'main.rs');
    const binName = process.platform === 'win32' ? 'runner.exe' : 'runner';
    const runnerPath = path.join(tmpDir, binName);

    await fs.writeFile(mainRsPath, fullSource, 'utf8');

    const compileRes = await spawnWithTimeout(
      rustcBin,
      ['--edition', '2021', '--error-format=json', mainRsPath, '-o', runnerPath],
      {
        cwd: tmpDir,
        timeoutMs: RUST_COMPILE_TIMEOUT_MS,
      }
    );

    if (compileRes.spawnError) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [
          {
            severity: 'error',
            message: `Failed to invoke rustc (${rustcBin}): ${compileRes.spawnError.message}`,
          },
        ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rustc-server',
      });
    }

    if (compileRes.timedOut) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [
          {
            severity: 'error',
            message: `Rust compilation timed out (> ${RUST_COMPILE_TIMEOUT_MS} ms).`,
          },
        ],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rustc-server',
      });
    }

    const diagnostics = parseRustcJsonDiagnostics(
      compileRes.stderr,
      userLineCount
    );

    if (compileRes.exitCode !== 0) {
      const errorDiagnostics =
        diagnostics.filter((d) => d.severity === 'error').length > 0
          ? diagnostics
          : [
              {
                severity: 'error' as const,
                message:
                  compileRes.stderr.trim() || 'Rust compilation failed.',
              },
            ];

      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: errorDiagnostics,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rustc-server',
      });
    }

    const runRes = await spawnWithTimeout(runnerPath, [], {
      cwd: tmpDir,
      timeoutMs,
    });

    const parsedCases = parseRustStdoutCases(runRes.stdout);

    if (runRes.timedOut) {
      return buildTimeoutResult({
        tests: problemSpec.tests,
        timeoutMs,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rustc-server',
        diagnostics,
      });
    }

    if (runRes.exitCode !== 0 && parsedCases.size < problemSpec.tests.length) {
      const crashMsg =
        runRes.stderr.trim() ||
        (runRes.signal
          ? `Process terminated by signal ${runRes.signal}`
          : `Process exited with code ${runRes.exitCode}`);
      const caseOutcomes: RawCaseOutcome[] = problemSpec.tests.map((_, idx) => {
        const existing = parsedCases.get(idx);
        if (existing) return existing;
        return {
          status: 'error',
          passed: false,
          run: `panic: ${crashMsg}`,
        };
      });

      return buildExecutionResult({
        tests: problemSpec.tests,
        caseOutcomes,
        diagnostics,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'rustc-server',
        timeoutMs,
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
      runnerUsed: 'rustc-server',
      timeoutMs,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function generateRustHarnessSource(
  normalizedUserCode: string,
  fnName: string,
  problemSpec: ProblemSpec
): string {
  const extraImports: string[] = [];
  for (const colType of ['HashMap', 'HashSet', 'BTreeMap', 'BTreeSet', 'VecDeque']) {
    const alreadyImported = new RegExp(`\\b${colType}\\b`).test(normalizedUserCode);
    if (!alreadyImported) {
      extraImports.push(`    #[allow(unused_imports)] use std::collections::${colType};`);
    }
  }

  const caseBlocks = problemSpec.tests.map((tc, index) => {
    const callExpr = tc.rustCallExpr ?? `${fnName}()`;
    const expectedExpr = tc.rustExpectedExpr ?? '()';

    return `        {
            let __res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let __actual = { ${callExpr} };
                let __expected = { ${expectedExpr} };
                let __passed: bool = __actual == __expected;
                let __formatted = (&&__CbhWrap(&__actual)).__fmt();
                (__passed, __formatted)
            }));
            match __res {
                Ok((__passed, __formatted)) => {
                    __emit_case(${index}, if __passed { "pass" } else { "fail" }, __passed, &__formatted);
                }
                Err(__panic_payload) => {
                    let __msg = __extract_panic_msg(__panic_payload);
                    __emit_case(${index}, "error", false, &format!("panic: {}", __msg));
                }
            }
        }`;
  });

  // Line 1: #![allow(...)]
  // Line 2 .. 1 + userLineCount: normalizedUserCode verbatim
  return `#![allow(unused_imports, dead_code, unused_mut, unused_variables)]
${normalizedUserCode}
mod __cbh_harness {
    use super::${fnName};
    use super::*;
${extraImports.join('\n')}
    use std::io::Write;

    struct __CbhWrap<T>(T);

    impl<K: Ord + std::fmt::Debug, V: std::fmt::Debug> __CbhWrap<&std::collections::HashMap<K, V>> {
        fn __fmt(&self) -> String {
            let mut pairs: Vec<_> = self.0.iter().collect();
            pairs.sort_by(|a, b| a.0.cmp(b.0));
            let inner: Vec<String> = pairs
                .iter()
                .map(|(k, v)| format!("{:?}: {:?}", k, v))
                .collect();
            format!("{{{}}}", inner.join(", "))
        }
    }

    impl<T: Ord + std::fmt::Debug> __CbhWrap<&std::collections::HashSet<T>> {
        fn __fmt(&self) -> String {
            let mut items: Vec<_> = self.0.iter().collect();
            items.sort();
            let inner: Vec<String> = items.iter().map(|v| format!("{:?}", v)).collect();
            format!("{{{}}}", inner.join(", "))
        }
    }

    trait __CbhFallback {
        fn __fmt(&self) -> String;
    }

    impl<T: std::fmt::Debug> __CbhFallback for __CbhWrap<T> {
        fn __fmt(&self) -> String {
            format!("{:?}", self.0)
        }
    }

    fn __json_escape(s: &str) -> String {
        let mut out = String::with_capacity(s.len() + 4);
        for ch in s.chars() {
            match ch {
                '\\\\' => out.push_str("\\\\\\\\"),
                '"' => out.push_str("\\\\\\""),
                '\\n' => out.push_str("\\\\n"),
                '\\r' => out.push_str("\\\\r"),
                '\\t' => out.push_str("\\\\t"),
                c if (c as u32) < 0x20 => {
                    out.push_str(&format!("\\\\u{:04x}", c as u32));
                }
                c => out.push(c),
            }
        }
        out
    }

    fn __extract_panic_msg(payload: Box<dyn std::any::Any + Send>) -> String {
        if let Some(s) = payload.downcast_ref::<&str>() {
            (*s).to_string()
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s.clone()
        } else {
            "explicit panic".to_string()
        }
    }

    fn __emit_case(index: usize, status: &str, passed: bool, run: &str) {
        println!(
            "\\n${CASE_PREFIX}{{\\"index\\":{},\\"status\\":\\"{}\\",\\"passed\\":{},\\"run\\":\\"{}\\"}}",
            index,
            status,
            passed,
            __json_escape(run)
        );
        let _ = std::io::stdout().flush();
    }

    pub fn run() {
        std::panic::set_hook(Box::new(|_| {}));
${caseBlocks.join('\n')}
    }
}

fn main() {
    __cbh_harness::run();
}
`;
}

interface RustcSpan {
  file_name?: string;
  line_start?: number;
  column_start?: number;
  is_primary?: boolean;
  label?: string | null;
}

interface RustcJsonMessage {
  $message_type?: string;
  message?: string;
  level?: string;
  spans?: RustcSpan[];
  children?: Array<{
    message?: string;
    level?: string;
    spans?: RustcSpan[];
  }>;
  rendered?: string;
}

export function parseRustcJsonDiagnostics(
  stderr: string,
  userLineCount: number
): CompilerDiagnostic[] {
  const maxMainUserLine = 1 + userLineCount; // Line 1 is #![allow(...)], Lines 2..=1+userLineCount are userCode
  const rawItems: Array<{
    diag: CompilerDiagnostic;
    inUserCode: boolean;
  }> = [];

  for (const rawLine of stderr.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith('{')) continue;

    let parsed: RustcJsonMessage;
    try {
      parsed = JSON.parse(trimmed) as RustcJsonMessage;
    } catch {
      continue;
    }

    const level = parsed.level;
    if (!level || level === 'failure-note' || !parsed.message) {
      continue;
    }
    if (
      parsed.message.startsWith('aborting due to') ||
      parsed.message.startsWith('For more information about this error')
    ) {
      continue;
    }

    const severity: CompilerDiagnostic['severity'] =
      level === 'error' || level === 'error: internal compiler error'
        ? 'error'
        : level === 'warning'
          ? 'warning'
          : 'info';

    const spans = (parsed.spans ?? []).filter((s) =>
      s.file_name ? s.file_name.endsWith('main.rs') : true
    );
    const primarySpan = spans.find((s) => s.is_primary) ?? spans[0];

    // Check whether primary span or any child/secondary span points into user lines 2..=maxMainUserLine
    const allCandidateSpans: RustcSpan[] = [
      ...spans,
      ...(parsed.children ?? []).flatMap((c) =>
        (c.spans ?? []).filter((s) =>
          s.file_name ? s.file_name.endsWith('main.rs') : true
        )
      ),
    ];

    const userSpan =
      (primarySpan &&
      primarySpan.line_start !== undefined &&
      primarySpan.line_start >= 2 &&
      primarySpan.line_start <= maxMainUserLine
        ? primarySpan
        : undefined) ??
      allCandidateSpans.find(
        (s) =>
          s.line_start !== undefined &&
          s.line_start >= 2 &&
          s.line_start <= maxMainUserLine
      );

    let line: number | undefined;
    let column: number | undefined;
    let inUserCode = false;

    if (userSpan && userSpan.line_start !== undefined) {
      line = userSpan.line_start - 1;
      column = userSpan.column_start;
      inUserCode = true;
    } else if (
      primarySpan &&
      primarySpan.line_start !== undefined &&
      /unclosed delimiter|unexpected closing delimiter|this file contains an unclosed delimiter/i.test(
        parsed.message
      )
    ) {
      line = userLineCount;
      column = 1;
      inUserCode = true;
    }

    // Filter internal harness artifacts caused by unclosed braces in userCode
    if (
      !inUserCode &&
      /__cbh_harness|__CbhWrap|__CbhFallback|__emit_case/.test(parsed.message)
    ) {
      continue;
    }

    rawItems.push({
      inUserCode,
      diag: {
        severity,
        message: parsed.message,
        line,
        column,
        raw: parsed.rendered ?? parsed.message,
      },
    });
  }

  const hasUserError = rawItems.some(
    (item) => item.inUserCode && item.diag.severity === 'error'
  );
  if (hasUserError) {
    // When there are direct errors in userCode, drop secondary cascading errors inside __cbh_harness
    return rawItems
      .filter((item) => item.inUserCode || item.diag.severity !== 'error')
      .map((item) => item.diag);
  }

  return rawItems.map((item) => item.diag);
}

function parseRustStdoutCases(stdout: string): Map<number, RawCaseOutcome> {
  const results = new Map<number, RawCaseOutcome>();

  for (const line of stdout.split(/\r?\n/)) {
    const prefixIdx = line.indexOf(CASE_PREFIX);
    if (prefixIdx === -1) continue;
    const jsonPart = line.slice(prefixIdx + CASE_PREFIX.length).trim();
    try {
      const payload = JSON.parse(jsonPart) as RustHarnessCasePayload;
      results.set(payload.index, {
        status: payload.status,
        passed: payload.passed,
        run: payload.run,
      });
    } catch {
      // Ignore malformed debug stdout lines
    }
  }

  return results;
}

async function executeRustViaJudge0(params: {
  fullSource: string;
  userLineCount: number;
  problemSpec: ProblemSpec;
  timeoutMs: number;
  startedAt: number;
}): Promise<ExecutionResult> {
  const { fullSource, userLineCount, problemSpec, timeoutMs, startedAt } =
    params;
  const baseUrl = process.env.JUDGE0_API_URL!.replace(/\/+$/, '');
  const apiKey = process.env.JUDGE0_API_KEY?.trim();
  const apiHost = process.env.JUDGE0_API_HOST?.trim();
  const languageId = Number(process.env.JUDGE0_RUST_LANG_ID) || 73;

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

  const response = await fetch(
    `${baseUrl}/submissions?base64_encoded=true&wait=true`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language_id: languageId,
        source_code: Buffer.from(fullSource, 'utf8').toString('base64'),
        cpu_time_limit: Math.max(1, Number((timeoutMs / 1000).toFixed(2))),
        wall_time_limit: Math.max(2, Number(((timeoutMs + 1000) / 1000).toFixed(2))),
      }),
    }
  );

  if (!response.ok) {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Judge0 proxy error (${response.status} ${response.statusText})`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'judge0-rust',
    });
  }

  const data = (await response.json()) as {
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
    status?: { id: number; description: string };
  };

  const decodeB64 = (val?: string | null) =>
    val ? Buffer.from(val, 'base64').toString('utf8') : '';

  const compileOutput = decodeB64(data.compile_output);
  const stdout = decodeB64(data.stdout);
  const stderr = decodeB64(data.stderr);
  const statusId = data.status?.id ?? 0;

  if (statusId === 6) {
    // Compilation Error
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: parsePlainRustDiagnostics(compileOutput, userLineCount),
      durationMs: performance.now() - startedAt,
      runnerUsed: 'judge0-rust',
    });
  }

  if (statusId === 5) {
    // Time Limit Exceeded
    return buildTimeoutResult({
      tests: problemSpec.tests,
      timeoutMs,
      durationMs: performance.now() - startedAt,
      runnerUsed: 'judge0-rust',
    });
  }

  const parsedCases = parseRustStdoutCases(stdout);
  const caseOutcomes: RawCaseOutcome[] = problemSpec.tests.map((_, idx) => {
    return (
      parsedCases.get(idx) ?? {
        status: 'error',
        passed: false,
        run: stderr.trim() ? `panic: ${stderr.trim()}` : 'Error: missing test output',
      }
    );
  });

  return buildExecutionResult({
    tests: problemSpec.tests,
    caseOutcomes,
    durationMs: performance.now() - startedAt,
    runnerUsed: 'judge0-rust',
    timeoutMs,
  });
}

function parsePlainRustDiagnostics(
  compileOutput: string,
  userLineCount: number
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const lines = compileOutput.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(error|warning)(?:\[[A-Z0-9]+\])?:\s*(.+)$/);
    if (!m) continue;
    const severity = m[1] === 'warning' ? 'warning' : 'error';
    const message = m[2];
    let line: number | undefined;
    let column: number | undefined;

    if (i + 1 < lines.length) {
      const locMatch = lines[i + 1].match(/-->\s*[^:]+:(\d+):(\d+)/);
      if (locMatch) {
        const rawLine = Number(locMatch[1]);
        if (rawLine >= 2 && rawLine <= 1 + userLineCount) {
          line = rawLine - 1;
          column = Number(locMatch[2]);
        }
      }
    }

    diagnostics.push({ severity, message, line, column, raw: compileOutput });
  }

  if (diagnostics.length === 0 && compileOutput.trim()) {
    diagnostics.push({ severity: 'error', message: compileOutput.trim() });
  }
  return diagnostics;
}
