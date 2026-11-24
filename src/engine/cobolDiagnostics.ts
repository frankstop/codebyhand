import type { CompilerDiagnostic } from '../types/schema';

const ANSI_ESCAPE = /\u001b\[[0-9;]*[A-Za-z]/g;
const WASM_WORKSPACE_PREFIX = /__wasm_cobol_\d+\//g;
const RUNTIME_STEP_LINE = /^\s*>|^\s*done\.?\s*$/;

/**
 * Parses GnuCOBOL (`cobc` and `@live-codes/cobol-wasm`) diagnostics into structured CompilerDiagnostic items.
 * Example line:
 *   `prog.cob:14: error: 'WS-TOTAL' is not defined`
 *   `prog.cob:14:8: warning: ...`
 */
export function parseCobcDiagnostics(rawInput: string): CompilerDiagnostic[] {
  const cleaned = rawInput
    .replace(ANSI_ESCAPE, '')
    .replace(WASM_WORKSPACE_PREFIX, '');

  const lines = cleaned.split(/\r?\n/);
  const diagnostics: CompilerDiagnostic[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line || RUNTIME_STEP_LINE.test(line)) continue;

    const match = line.match(
      /(?:^|[/\\])([^/\\:\s]+\.cob(?:ol)?):(\d+)(?::(\d+))?:\s*(error|warning|note):\s*(.+)$/i
    );
    if (!match) continue;

    const lineNum = Number(match[2]);
    const colNum = match[3] ? Number(match[3]) : undefined;
    const rawLevel = match[4].toLowerCase();
    const message = match[5].trim();

    const severity: CompilerDiagnostic['severity'] =
      rawLevel === 'error'
        ? 'error'
        : rawLevel === 'warning'
          ? 'warning'
          : 'info';

    // Collect context snippet lines that immediately follow (e.g. `   14 >     ADD 1 TO ...`)
    const rawBlock: string[] = [line];
    while (
      i + 1 < lines.length &&
      /^\s+\d+\s*[|>]/.test(lines[i + 1])
    ) {
      i++;
      rawBlock.push(lines[i].trimEnd());
    }

    diagnostics.push({
      severity,
      message,
      line: Number.isFinite(lineNum) && lineNum >= 1 ? lineNum : undefined,
      column:
        colNum !== undefined && Number.isFinite(colNum) && colNum >= 1
          ? colNum
          : undefined,
      raw: rawBlock.join('\n'),
    });
  }

  return diagnostics;
}
