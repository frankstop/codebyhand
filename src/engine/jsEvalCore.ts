import type {
  CompilerDiagnostic,
  ExecutionResult,
  ProblemSpec,
} from '../types/schema';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  type RawCaseOutcome,
} from './resultBuilder';

const VALID_JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function deepEqualJs(
  actual: unknown,
  expected: unknown,
  seen: WeakMap<object, object> = new WeakMap()
): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (Number.isNaN(actual) && Number.isNaN(expected)) return true;
    if (actual === expected) return true; // includes -0 === +0
    if (
      Number.isFinite(actual) &&
      Number.isFinite(expected) &&
      !Number.isInteger(actual) &&
      !Number.isInteger(expected)
    ) {
      return Math.abs(actual - expected) <= 1e-9;
    }
    return false;
  }

  if (Object.is(actual, expected)) {
    return true;
  }

  if (
    actual === null ||
    expected === null ||
    typeof actual !== 'object' ||
    typeof expected !== 'object'
  ) {
    return false;
  }

  if (seen.get(actual) === expected) {
    return true;
  }
  seen.set(actual, expected);

  // Arrays
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!deepEqualJs(actual[i], expected[i], seen)) return false;
    }
    return true;
  }

  const tagA = Object.prototype.toString.call(actual);
  const tagB = Object.prototype.toString.call(expected);
  if (tagA !== tagB) return false;

  // Map
  if (tagA === '[object Map]') {
    const mapA = actual as Map<unknown, unknown>;
    const mapB = expected as Map<unknown, unknown>;
    if (mapA.size !== mapB.size) return false;
    for (const [k, v] of mapA.entries()) {
      if (mapB.has(k)) {
        if (!deepEqualJs(v, mapB.get(k), seen)) return false;
      } else if (k !== null && typeof k === 'object') {
        let matched = false;
        for (const [kb, vb] of mapB.entries()) {
          if (deepEqualJs(k, kb, seen) && deepEqualJs(v, vb, seen)) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // Set
  if (tagA === '[object Set]') {
    const setA = actual as Set<unknown>;
    const setB = expected as Set<unknown>;
    if (setA.size !== setB.size) return false;
    for (const item of setA.values()) {
      if (setB.has(item)) continue;
      if (item !== null && typeof item === 'object') {
        let matched = false;
        for (const candidate of setB.values()) {
          if (deepEqualJs(item, candidate, seen)) {
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  // Date / RegExp
  if (tagA === '[object Date]') {
    return Object.is((actual as Date).getTime(), (expected as Date).getTime());
  }
  if (tagA === '[object RegExp]') {
    return String(actual) === String(expected);
  }

  // Plain objects
  const objA = actual as Record<string, unknown>;
  const objB = expected as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key)) return false;
    if (!deepEqualJs(objA[key], objB[key], seen)) return false;
  }
  return true;
}

export function formatJsValue(
  val: unknown,
  seen: WeakSet<object> = new WeakSet()
): string {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'number') return Object.is(val, -0) ? '0' : String(val);
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'bigint') return `${val}n`;
  if (typeof val === 'symbol') return val.toString();
  if (typeof val === 'function') {
    return `[Function${val.name ? `: ${val.name}` : ''}]`;
  }

  if (typeof val === 'object') {
    if (seen.has(val)) return '[Circular]';
    seen.add(val);

    if (Array.isArray(val)) {
      const inner = val.map((item) => formatJsValue(item, seen)).join(', ');
      seen.delete(val);
      return `[${inner}]`;
    }

    const tag = Object.prototype.toString.call(val);
    if (tag === '[object Map]') {
      const map = val as Map<unknown, unknown>;
      const entries = Array.from(map.entries()).map(
        ([k, v]) => `${formatJsValue(k, seen)}: ${formatJsValue(v, seen)}`
      );
      seen.delete(val);
      return `Map{${entries.join(', ')}}`;
    }

    if (tag === '[object Set]') {
      const set = val as Set<unknown>;
      const items = Array.from(set.values()).map((item) =>
        formatJsValue(item, seen)
      );
      seen.delete(val);
      return `Set{${items.join(', ')}}`;
    }

    if (tag === '[object Date]') {
      seen.delete(val);
      return (val as Date).toISOString();
    }

    if (tag === '[object RegExp]') {
      seen.delete(val);
      return String(val);
    }

    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(
      (k) => `${JSON.stringify(k)}: ${formatJsValue(obj[k], seen)}`
    );
    seen.delete(val);
    return `{${pairs.join(', ')}}`;
  }

  return String(val);
}

export function formatJsRuntimeError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message ?? 'Runtime error');
    return `Error: ${msg}`;
  }
  return `Error: ${String(err)}`;
}

export function cloneInputValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback for non-cloneable values
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneInputValue(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    copy[key] = cloneInputValue((value as Record<string, unknown>)[key]);
  }
  return copy as T;
}

export function parseJsSyntaxDiagnostic(
  err: unknown,
  functionConstructorOffset = 0
): CompilerDiagnostic {
  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  const stack =
    err && typeof err === 'object' && 'stack' in err
      ? String((err as { stack: unknown }).stack ?? '')
      : '';

  let line: number | undefined;
  let column: number | undefined;

  // Node vm.Script format: "solution.js:3\n  const x = ;\n            ^\n"
  const vmMatch = stack.match(/solution\.js:(\d+)(?::(\d+))?/);
  if (vmMatch) {
    line = Math.max(1, Number(vmMatch[1]));
    if (vmMatch[2]) {
      column = Math.max(1, Number(vmMatch[2]));
    } else {
      const stackLines = stack.split('\n');
      const headerIdx = stackLines.findIndex((l) => l.includes('solution.js:'));
      if (headerIdx >= 0 && headerIdx + 2 < stackLines.length) {
        const caretIdx = stackLines[headerIdx + 2].indexOf('^');
        if (caretIdx >= 0) {
          column = caretIdx + 1;
        }
      }
    }
  }

  // Firefox / Safari properties
  if (line === undefined && err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.lineNumber === 'number') {
      const adjusted = anyErr.lineNumber - functionConstructorOffset;
      if (adjusted >= 1) line = adjusted;
    }
    if (typeof anyErr.columnNumber === 'number' && anyErr.columnNumber >= 1) {
      column = anyErr.columnNumber;
    }
  }

  // V8 Function constructor stack fallback: "<anonymous>:4:12"
  if (line === undefined) {
    const anonMatch = stack.match(/<anonymous>:(\d+):(\d+)/);
    if (anonMatch) {
      const adjusted = Number(anonMatch[1]) - functionConstructorOffset;
      if (adjusted >= 1) {
        line = adjusted;
        column = Number(anonMatch[2]);
      }
    }
  }

  return {
    severity: 'error',
    message,
    line,
    column,
    raw: stack || message,
  };
}

export interface JsScopeBinding {
  fn: unknown;
  evalExpr: (expr: string) => unknown;
}

export function runBoundJsSuite(params: {
  binding: JsScopeBinding;
  problemSpec: ProblemSpec;
  startedAt: number;
  runnerUsed: string;
  timeoutMs: number;
}): ExecutionResult {
  const { binding, problemSpec, startedAt, runnerUsed, timeoutMs } = params;
  const fnName = problemSpec.functionName.trim();

  if (typeof binding.fn !== 'function') {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message:
            binding.fn === undefined
              ? `Function '${fnName}' was not found. Make sure you define function ${fnName}(...).`
              : `'${fnName}' must be a function, but got ${typeof binding.fn}.`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed,
    });
  }

  const targetFn = binding.fn as (...args: unknown[]) => unknown;
  const caseOutcomes: RawCaseOutcome[] = [];

  for (const tc of problemSpec.tests) {
    try {
      const rawArgs = tc.jsArgsExpr
        ? binding.evalExpr(tc.jsArgsExpr)
        : cloneInputValue(tc.args ?? []);
      const argsList = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

      const expected = tc.jsExpectedExpr
        ? binding.evalExpr(tc.jsExpectedExpr)
        : tc.expected;

      const actual = targetFn(...argsList);
      const passed = deepEqualJs(actual, expected);
      caseOutcomes.push({
        status: passed ? 'pass' : 'fail',
        passed,
        run: formatJsValue(actual),
      });
    } catch (err) {
      caseOutcomes.push({
        status: 'error',
        passed: false,
        run: formatJsRuntimeError(err),
      });
    }
  }

  return buildExecutionResult({
    tests: problemSpec.tests,
    caseOutcomes,
    durationMs: performance.now() - startedAt,
    runnerUsed,
    timeoutMs,
  });
}

export function evaluateJsDirect(
  userCode: string,
  problemSpec: ProblemSpec,
  runnerUsed: string,
  timeoutMs: number
): ExecutionResult {
  const startedAt = performance.now();
  const fnName = problemSpec.functionName.trim();

  if (!VALID_JS_IDENT.test(fnName)) {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [
        {
          severity: 'error',
          message: `Invalid target function identifier '${fnName}'.`,
        },
      ],
      durationMs: performance.now() - startedAt,
      runnerUsed,
    });
  }

  // Step 1: Pure syntax check on userCode alone (`new Function` adds 2 header lines in V8/SM)
  try {
    new Function(userCode);
  } catch (err) {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [parseJsSyntaxDiagnostic(err, 2)],
      durationMs: performance.now() - startedAt,
      runnerUsed,
    });
  }

  // Step 2: Evaluate userCode in isolated function scope & extract target function
  let binding: JsScopeBinding;
  try {
    const factory = new Function(
      `${userCode}\n;const __cbhTarget = (typeof ${fnName} !== 'undefined') ? ${fnName} : undefined;\n` +
        `return {\n` +
        `  fn: __cbhTarget,\n` +
        `  evalExpr: function(__cbhExpr) { return (0, eval)('(' + __cbhExpr + ')'); }\n` +
        `};`
    ) as () => JsScopeBinding;
    binding = factory();
  } catch (err) {
    const isSyntax =
      err &&
      typeof err === 'object' &&
      (err as { name?: string }).name === 'SyntaxError';
    if (isSyntax) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [parseJsSyntaxDiagnostic(err, 2)],
        durationMs: performance.now() - startedAt,
        runnerUsed,
      });
    }

    const errMsg = formatJsRuntimeError(err);
    const caseOutcomes: RawCaseOutcome[] = problemSpec.tests.map(() => ({
      status: 'error',
      passed: false,
      run: errMsg,
    }));
    return buildExecutionResult({
      tests: problemSpec.tests,
      caseOutcomes,
      durationMs: performance.now() - startedAt,
      runnerUsed,
      timeoutMs,
    });
  }

  return runBoundJsSuite({
    binding,
    problemSpec,
    startedAt,
    runnerUsed,
    timeoutMs,
  });
}
