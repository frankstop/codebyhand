import type { CompilerDiagnostic, ProblemSpec } from '../types/schema';
import type { RawCaseOutcome } from './resultBuilder';

export const CASE_PREFIX = '__CBH_CASE__:';
export const VALID_RUST_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface RustHarnessCasePayload {
  index: number;
  status: 'pass' | 'fail' | 'error';
  passed: boolean;
  run: string;
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

export function parseRustStdoutCases(stdout: string): Map<number, RawCaseOutcome> {
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

/**
 * Parses human-readable `rustc` stderr (such as output returned by `play.rust-lang.org/execute`)
 * and maps `src/main.rs:LINE:COL` spans back to 1-indexed editor lines.
 */
export function parseRustcPlainDiagnostics(
  stderr: string,
  userLineCount: number
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const lines = stderr.split(/\r?\n/);
  const maxUserLine = 1 + userLineCount;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = /^(error|warning)(?:\[[^\]]+\])?:\s*(.+)$/.exec(line.trim());
    if (!headerMatch) continue;

    const severity: CompilerDiagnostic['severity'] =
      headerMatch[1] === 'error' ? 'error' : 'warning';
    const message = headerMatch[2].trim();

    if (
      message.startsWith('aborting due to') ||
      message.startsWith('could not compile') ||
      /__cbh_harness|__CbhWrap|__CbhFallback|__emit_case/.test(message)
    ) {
      continue;
    }

    let mappedLine: number | undefined;
    let mappedCol: number | undefined;
    const rawLines = [line];

    for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
      const next = lines[j];
      if (/^(error|warning)(?:\[[^\]]+\])?:/.test(next.trim())) break;
      rawLines.push(next);
      const locMatch = /-->\s+[^:]+:(\d+):(\d+)/.exec(next);
      if (locMatch && mappedLine === undefined) {
        const rawLineNum = Number(locMatch[1]);
        const rawColNum = Number(locMatch[2]);
        if (rawLineNum >= 2 && rawLineNum <= maxUserLine) {
          mappedLine = rawLineNum - 1;
          mappedCol = rawColNum;
        }
      }
    }

    diagnostics.push({
      severity,
      message,
      line: mappedLine,
      column: mappedCol,
      raw: rawLines.join('\n').trim(),
    });
  }

  return diagnostics;
}
