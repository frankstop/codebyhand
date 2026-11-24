import type {
  ExecutionOptions,
  ExecutionResult,
  ProblemSpec,
} from '../types/schema';
import {
  cloneInputValue,
  deepEqualJs,
  formatJsRuntimeError,
  formatJsValue,
  parseJsSyntaxDiagnostic,
  runBoundJsSuite,
  type JsScopeBinding,
} from './jsEvalCore';
import {
  buildCompileErrorResult,
  buildExecutionResult,
  buildTimeoutResult,
  type RawCaseOutcome,
} from './resultBuilder';

const DEFAULT_JS_TIMEOUT_MS = 2000;
const VALID_JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export async function executeJs(
  userCode: string,
  problemSpec: ProblemSpec,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_JS_TIMEOUT_MS;

  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    return executeJsInBrowserWorker(userCode, problemSpec, timeoutMs);
  }

  return executeJsInNodeVm(userCode, problemSpec, timeoutMs);
}

function executeJsInBrowserWorker(
  userCode: string,
  problemSpec: ProblemSpec,
  timeoutMs: number
): Promise<ExecutionResult> {
  const startedAt = performance.now();

  return new Promise<ExecutionResult>((resolve) => {
    let settled = false;
    const worker = new Worker(new URL('./jsWorker.ts', import.meta.url), {
      type: 'module',
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve(
        buildTimeoutResult({
          tests: problemSpec.tests,
          timeoutMs,
          durationMs: performance.now() - startedAt,
          runnerUsed: 'web-worker',
        })
      );
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<ExecutionResult>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve({
        ...event.data,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
    };

    worker.onerror = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      event.preventDefault?.();
      resolve(
        buildCompileErrorResult({
          tests: problemSpec.tests,
          diagnostics: [
            {
              severity: 'error',
              message: event.message || 'Worker script execution error',
              line: event.lineno || undefined,
              column: event.colno || undefined,
            },
          ],
          durationMs: performance.now() - startedAt,
          runnerUsed: 'web-worker',
        })
      );
    };

    worker.postMessage({ userCode, problemSpec, timeoutMs });
  });
}

async function executeJsInNodeVm(
  userCode: string,
  problemSpec: ProblemSpec,
  timeoutMs: number
): Promise<ExecutionResult> {
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
      runnerUsed: 'node-vm',
    });
  }

  const vmModName = 'node:' + 'vm';
  const vm = (await import(/* @vite-ignore */ vmModName)) as typeof import('node:vm');

  // Step 1: Compile userCode verbatim with filename 'solution.js' for 1-indexed line & caret column diagnostics
  try {
    new vm.Script(userCode, { filename: 'solution.js' });
  } catch (err) {
    return buildCompileErrorResult({
      tests: problemSpec.tests,
      diagnostics: [parseJsSyntaxDiagnostic(err, 0)],
      durationMs: performance.now() - startedAt,
      runnerUsed: 'node-vm',
    });
  }

  const noop = () => {};
  const context = vm.createContext({
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    structuredClone,
  });

  // Step 2: Evaluate userCode and bind target function inside isolated VM context
  let binding: JsScopeBinding;
  try {
    const setupSource =
      `${userCode}\n;` +
      `({\n` +
      `  fn: (typeof ${fnName} !== 'undefined') ? ${fnName} : undefined,\n` +
      `  evalExpr: function(__cbhExpr) { return (0, eval)('(' + __cbhExpr + ')'); }\n` +
      `})`;
    binding = vm.runInContext(setupSource, context, {
      filename: 'solution.js',
      timeout: timeoutMs,
    }) as JsScopeBinding;
  } catch (err) {
    if (isVmTimeoutError(err)) {
      return buildTimeoutResult({
        tests: problemSpec.tests,
        timeoutMs,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'node-vm',
      });
    }
    if (
      err &&
      typeof err === 'object' &&
      (err as { name?: string }).name === 'SyntaxError'
    ) {
      return buildCompileErrorResult({
        tests: problemSpec.tests,
        diagnostics: [parseJsSyntaxDiagnostic(err, 0)],
        durationMs: performance.now() - startedAt,
        runnerUsed: 'node-vm',
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
      runnerUsed: 'node-vm',
      timeoutMs,
    });
  }

  // Step 3: Execute suite inside VM watchdog budget so infinite loops inside fn(...) time out cleanly
  const elapsed = performance.now() - startedAt;
  const remainingMs = Math.max(1, Math.ceil(timeoutMs - elapsed));

  try {
    context.__cbhRunSuite = () =>
      runBoundJsSuite({
        binding,
        problemSpec,
        startedAt,
        runnerUsed: 'node-vm',
        timeoutMs,
      });

    // Note: invoke targetFn inside vm.runInContext so V8's C++ watchdog preempts while(true){} inside user functions!
    const wrappedBinding: JsScopeBinding = {
      fn:
        typeof binding.fn === 'function'
          ? (...args: unknown[]) => {
              context.__cbhTargetFn = binding.fn;
              context.__cbhCallArgs = args;
              const stepRemaining = Math.max(
                1,
                Math.ceil(timeoutMs - (performance.now() - startedAt))
              );
              return vm.runInContext(
                '__cbhTargetFn(...__cbhCallArgs)',
                context,
                {
                  filename: 'solution.js',
                  timeout: stepRemaining,
                }
              );
            }
          : binding.fn,
      evalExpr: (expr: string) => {
        const stepRemaining = Math.max(
          1,
          Math.ceil(timeoutMs - (performance.now() - startedAt))
        );
        // Clone plain JSON inputs into the VM realm via eval or pass expr directly
        return vm.runInContext(`(${expr})`, context, {
          filename: 'test-expr.js',
          timeout: stepRemaining,
        });
      },
    };

    // Wait: if runBoundJsSuite catches errors per test case, a VM timeout error thrown by vm.runInContext
    // must NOT be swallowed as a regular runtime error! Let's rethrow timeout errors out of wrappedBinding.fn!
    const timeoutAwareSpecTests = problemSpec.tests;
    if (typeof wrappedBinding.fn !== 'function') {
      return runBoundJsSuite({
        binding: wrappedBinding,
        problemSpec,
        startedAt,
        runnerUsed: 'node-vm',
        timeoutMs,
      });
    }

    const caseOutcomes: RawCaseOutcome[] = [];
    const targetInvoker = wrappedBinding.fn as (...args: unknown[]) => unknown;

    for (let i = 0; i < timeoutAwareSpecTests.length; i++) {
      if (performance.now() - startedAt >= timeoutMs) {
        return buildTimeoutResult({
          tests: problemSpec.tests,
          timeoutMs,
          durationMs: performance.now() - startedAt,
          runnerUsed: 'node-vm',
        });
      }

      const tc = timeoutAwareSpecTests[i];
      try {
        const rawArgs = tc.jsArgsExpr
          ? wrappedBinding.evalExpr(tc.jsArgsExpr)
          : cloneInputValue(tc.args ?? []);
        const argsList = Array.isArray(rawArgs) ? rawArgs : [rawArgs];

        const expected = tc.jsExpectedExpr
          ? wrappedBinding.evalExpr(tc.jsExpectedExpr)
          : tc.expected;

        const actual = targetInvoker(...argsList);
        const passed = deepEqualJs(actual, expected);
        caseOutcomes.push({
          status: passed ? 'pass' : 'fail',
          passed,
          run: formatJsValue(actual),
        });
      } catch (err) {
        if (isVmTimeoutError(err)) {
          return buildTimeoutResult({
            tests: problemSpec.tests,
            timeoutMs,
            durationMs: performance.now() - startedAt,
            runnerUsed: 'node-vm',
          });
        }
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
      runnerUsed: 'node-vm',
      timeoutMs,
    });
  } catch (err) {
    if (isVmTimeoutError(err)) {
      return buildTimeoutResult({
        tests: problemSpec.tests,
        timeoutMs,
        durationMs: performance.now() - startedAt,
        runnerUsed: 'node-vm',
      });
    }
    throw err;
  }
}

function isVmTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; message?: string };
  if (anyErr.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') return true;
  if (
    typeof anyErr.message === 'string' &&
    /Script execution timed out/i.test(anyErr.message)
  ) {
    return true;
  }
  return false;
}
