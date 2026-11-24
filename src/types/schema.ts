/**
 * Phase 1 — Locked Shared TypeScript Contracts for CodeByHand
 * Shared across Curriculum Authors (JS, Rust, COBOL), ExecutionEngine, Frontend UX, and QA Suite.
 */

export type LanguageId = 'js' | 'rust' | 'cobol';

export type CobolFormatMode = 'free' | 'fixed';

export type CobolBackendMode = 'auto' | 'server' | 'wasm';

export interface HintItem {
  /** Progressive guidance text without giving away the complete solution */
  text: string;
  /** Optional short illustrative code snippet rendered inside <pre><code> */
  snippet?: string;
}

export interface TestCase {
  /**
   * Human-readable call/input rendered in sample previews and the Results Table `Call / Input` column.
   * Examples:
   * - JS: `sleepIn(false, false)`
   * - Rust: `sleep_in(false, false)`
   * - COBOL: `OVERTIME-PAY("45 20.00")`
   */
  call: string;

  /**
   * Human-readable expected value rendered in sample previews (`call -> expectedDisplay`)
   * and in the Results Table `Expected` column.
   */
  expectedDisplay: string;

  /**
   * If true, this case is part of the hidden `"other tests"` suite summarized at the bottom
   * of the Results Table so learners cannot hardcode lookup tables.
   * Visible cases (`hidden?: false`) appear individually in the Results Table, and the first 3
   * visible cases appear as sample examples under the problem description.
   */
  hidden?: boolean;

  // --- JavaScript execution fields ---
  /** JSON-serializable argument list passed to `problem.functionName(...args)` */
  args?: unknown[];
  /** JSON-serializable expected return value */
  expected?: unknown;
  /**
   * Optional raw JavaScript expression evaluating to the argument array `[arg1, arg2, ...]`.
   * Useful when passing non-JSON values such as ES6 `new Map(...)`.
   */
  jsArgsExpr?: string;
  /**
   * Optional raw JavaScript expression evaluating to the expected value.
   * Useful when returning ES6 `new Map(...)`.
   */
  jsExpectedExpr?: string;

  // --- Rust execution fields ---
  /**
   * Exact Rust expression invoking the learner's function for this test case.
   * Example: `sleep_in(false, false)` or `first_last6(&[1, 2, 6])`
   */
  rustCallExpr?: string;
  /**
   * Exact Rust expression evaluating to the expected value of matching return type.
   * Example: `true`, `vec![1, 2, 3]`, `"hello".to_string()`, `Some(42)`
   */
  rustExpectedExpr?: string;

  // --- COBOL execution fields ---
  /** Standard input lines fed to the COBOL program (newline-delimited) */
  stdin?: string;
  /** Expected stdout output emitted by `DISPLAY` statements */
  expectedStdout?: string;
}

export interface ProblemSpec {
  /** Globally unique problem ID, e.g. `js-warmup-1-sleep-in` */
  id: string;
  /** URL-friendly slug within the section, e.g. `sleepIn` or `sleep_in` or `overtime-pay` */
  slug: string;
  /** Target language track */
  language: LanguageId;
  /** Parent section ID, e.g. `warmup-1` */
  sectionId: string;
  /** Display title of the function/program unit, e.g. `sleepIn`, `sleep_in`, `OVERTIME-PAY` */
  title: string;
  /** Numeric CodingBat-style difficulty rating (100-499) */
  difficulty: number;
  /** Short, unambiguous problem statement pushing all difficulty to logic */
  doc: string;
  /** Optional language-construct `Note:` tip on introductory problems */
  note?: string;
  /** Entry-point function name (JS/Rust) or PROGRAM-ID / unit name (COBOL) */
  functionName: string;
  /** Zero-setup starter code shown in the editor (Free-Format default for COBOL) */
  starterCode: string;
  /** Optional explicit Fixed-Format starter template for COBOL when fixed-format mode is toggled */
  starterCodeFixed?: string;
  /** Progressive hints (`H` badge shown on problem lists when `hints.length > 0`) */
  hints: HintItem[];
  /**
   * If true, the `Show Solution` button is available BEFORE solving (used on Warmup-1, Warmup-2,
   * and the first 2 problems of newly introduced topic sections to prevent blank-screen paralysis).
   */
  showsolution: boolean;
  /**
   * If true (and `showsolution` is false), the `Show Solution` button unlocks AFTER the learner
   * passes 100% of visible + hidden test cases so they can compare against the reference solution.
   */
  showpost: boolean;
  /** Clean, commented, idiomatic reference solution that passes 100% of visible + hidden tests */
  solution: string;
  /** Suite of unit tests: at least 5 visible (`hidden: false/undefined`) + 7-10 hidden (`hidden: true`) */
  tests: TestCase[];
}

export interface SectionSpec {
  /** Section slug within the language, e.g. `warmup-1`, `ownership-borrowing-1`, `pic-fixed-point-1` */
  id: string;
  /** Target language track */
  language: LanguageId;
  /** Human-readable section name, e.g. `Warmup-1`, `Ownership & Borrowing-1`, `PIC & Fixed-Point-1` */
  title: string;
  /** Short summary shown on the Home / Language Hub section card */
  description: string;
  /** Numeric difficulty range `[min, max]`, e.g. `[100, 199]` */
  difficultyRange: [number, number];
  /** Ordered list of 6-8+ graded problems in this section */
  problems: ProblemSpec[];
}

export interface CompilerDiagnostic {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  raw?: string;
}

export type TestStatus = 'pass' | 'fail' | 'error' | 'timeout';

export interface TestRowResult {
  /** Index in visible test list */
  index: number;
  /** Call / Input string */
  call: string;
  /** Expected value string */
  expected: string;
  /** Actual value or runtime error/panic/timeout message from learner's run */
  run: string;
  /** Pass/fail/error/timeout status */
  status: TestStatus;
  /** Whether test passed */
  passed: boolean;
}

export interface OtherTestsSummary {
  total: number;
  passed: number;
  allPassed: boolean;
  status: TestStatus;
  /** Summary label e.g. `Other tests: 8/8 passed` or `Other tests: failed on hidden case (6/8 passed)` */
  message: string;
}

export interface ExecutionResult {
  /** Overall run status: true ONLY when compilation succeeded, no timeout occurred, and 100% of visible + hidden tests passed */
  allPassed: boolean;
  /** High-level execution outcome */
  outcome: 'passed' | 'failed' | 'compile_error' | 'runtime_error' | 'timeout';
  /** True if execution hit the time limit (e.g. infinite loop) */
  timedOut: boolean;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Structured compiler/syntax diagnostics (JS SyntaxError, Rust rustc, COBOL cobc) */
  diagnostics: CompilerDiagnostic[];
  /** Per-row results for all visible (`!hidden`) test cases */
  visibleResults: TestRowResult[];
  /** Aggregated result for all hidden (`hidden: true`) test cases */
  otherTests: OtherTestsSummary;
  /** Which execution backend handled the run (e.g. `'web-worker'`, `'node-vm'`, `'rustc-server'`, `'cobc-server'`, `'cobol-wasm'`) */
  runnerUsed?: string;
}

export interface ExecutionOptions {
  /** COBOL source format mode (`'free'` default or `'fixed'`) */
  cobolFormat?: CobolFormatMode;
  /** COBOL execution backend preference */
  cobolBackend?: CobolBackendMode;
  /** Override timeout in milliseconds */
  timeoutMs?: number;
  /** API base URL override when running outside browser (e.g. QA scripts) */
  apiBaseUrl?: string;
}

export interface ExecutionEngine {
  execute(
    language: LanguageId,
    userCode: string,
    problemSpec: ProblemSpec,
    options?: ExecutionOptions
  ): Promise<ExecutionResult>;
}

export interface ProblemProgressEntry {
  solved: boolean;
  solvedAt?: string;
  savedCode?: string;
  cobolFormat?: CobolFormatMode;
  hintsViewedCount?: number;
  solutionViewedPreSolve?: boolean;
  solutionViewedPostSolve?: boolean;
  attempts?: number;
}

export interface UserProgressStore {
  version: 1;
  updatedAt: string;
  selectedLanguage: LanguageId;
  problems: Record<string, ProblemProgressEntry>;
}

/**
 * Shared COBOL stdout normalization:
 * Preserves leading & internal spaces (critical for edited PIC masks like `$ZZ,ZZ9.99-`),
 * trims trailing spaces per line (standard COBOL fixed-width DISPLAY padding),
 * and strips trailing blank newlines at EOF.
 */
export function normalizeCobolOutput(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}
