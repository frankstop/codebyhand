import type {
  CompilerDiagnostic,
  ExecutionResult,
  OtherTestsSummary,
  TestCase,
  TestRowResult,
  TestStatus,
} from '../types/schema';

export interface RawCaseOutcome {
  status: TestStatus;
  passed: boolean;
  run: string;
}

export function buildExecutionResult(params: {
  tests: TestCase[];
  caseOutcomes: RawCaseOutcome[];
  diagnostics?: CompilerDiagnostic[];
  durationMs: number;
  runnerUsed: string;
  timeoutMs?: number;
}): ExecutionResult {
  const {
    tests,
    caseOutcomes,
    diagnostics = [],
    durationMs,
    runnerUsed,
    timeoutMs = 2000,
  } = params;

  const visibleResults: TestRowResult[] = [];
  const hiddenOutcomes: RawCaseOutcome[] = [];
  let anyTimedOut = false;
  let anyError = false;

  for (let i = 0; i < tests.length; i++) {
    const tc = tests[i];
    const outcome: RawCaseOutcome = caseOutcomes[i] ?? {
      status: 'timeout',
      passed: false,
      run: `Timed out (> ${timeoutMs} ms)`,
    };

    if (outcome.status === 'timeout') {
      anyTimedOut = true;
    } else if (outcome.status === 'error') {
      anyError = true;
    }

    if (tc.hidden) {
      hiddenOutcomes.push(outcome);
    } else {
      visibleResults.push({
        index: visibleResults.length,
        call: tc.call,
        expected: tc.expectedDisplay,
        run: outcome.run,
        status: outcome.status,
        passed: outcome.passed,
      });
    }
  }

  const otherTests = summarizeHiddenOutcomes(hiddenOutcomes, timeoutMs);
  const visibleAllPassed = visibleResults.every((r) => r.passed);
  const allPassed = !anyTimedOut && visibleAllPassed && otherTests.allPassed;

  let highLevelOutcome: ExecutionResult['outcome'];
  if (anyTimedOut) {
    highLevelOutcome = 'timeout';
  } else if (allPassed) {
    highLevelOutcome = 'passed';
  } else if (anyError) {
    highLevelOutcome = 'runtime_error';
  } else {
    highLevelOutcome = 'failed';
  }

  return {
    allPassed,
    outcome: highLevelOutcome,
    timedOut: anyTimedOut,
    durationMs: Math.max(0, Math.round(durationMs)),
    diagnostics,
    visibleResults,
    otherTests,
    runnerUsed,
  };
}

export function buildCompileErrorResult(params: {
  tests: TestCase[];
  diagnostics: CompilerDiagnostic[];
  durationMs: number;
  runnerUsed: string;
}): ExecutionResult {
  const { tests, diagnostics, durationMs, runnerUsed } = params;
  const hiddenTotal = tests.filter((tc) => tc.hidden).length;
  const safeDiagnostics: CompilerDiagnostic[] =
    diagnostics.length > 0
      ? diagnostics
      : [{ severity: 'error', message: 'Compilation failed.' }];

  const otherTests: OtherTestsSummary =
    hiddenTotal === 0
      ? {
          total: 0,
          passed: 0,
          allPassed: false,
          status: 'error',
          message: 'Other tests: none',
        }
      : {
          total: hiddenTotal,
          passed: 0,
          allPassed: false,
          status: 'error',
          message: `Other tests: not run (compile error)`,
        };

  return {
    allPassed: false,
    outcome: 'compile_error',
    timedOut: false,
    durationMs: Math.max(0, Math.round(durationMs)),
    diagnostics: safeDiagnostics,
    visibleResults: [],
    otherTests,
    runnerUsed,
  };
}

export function buildTimeoutResult(params: {
  tests: TestCase[];
  timeoutMs: number;
  durationMs: number;
  runnerUsed: string;
  partialOutcomes?: Map<number, RawCaseOutcome>;
  diagnostics?: CompilerDiagnostic[];
}): ExecutionResult {
  const {
    tests,
    timeoutMs,
    durationMs,
    runnerUsed,
    partialOutcomes,
    diagnostics = [],
  } = params;

  const timeoutLabel = `Timed out (> ${timeoutMs} ms)`;
  const visibleResults: TestRowResult[] = [];
  let hiddenTotal = 0;
  let hiddenPassed = 0;

  for (let i = 0; i < tests.length; i++) {
    const tc = tests[i];
    const partial = partialOutcomes?.get(i);
    if (tc.hidden) {
      hiddenTotal++;
      if (partial?.passed) {
        hiddenPassed++;
      }
    } else {
      if (partial) {
        visibleResults.push({
          index: visibleResults.length,
          call: tc.call,
          expected: tc.expectedDisplay,
          run: partial.run,
          status: partial.status,
          passed: partial.passed,
        });
      } else {
        visibleResults.push({
          index: visibleResults.length,
          call: tc.call,
          expected: tc.expectedDisplay,
          run: timeoutLabel,
          status: 'timeout',
          passed: false,
        });
      }
    }
  }

  const otherTests: OtherTestsSummary =
    hiddenTotal === 0
      ? {
          total: 0,
          passed: 0,
          allPassed: false,
          status: 'timeout',
          message: `Other tests: ${timeoutLabel}`,
        }
      : {
          total: hiddenTotal,
          passed: hiddenPassed,
          allPassed: false,
          status: 'timeout',
          message: `Other tests: timed out (> ${timeoutMs} ms) (${hiddenPassed}/${hiddenTotal} passed)`,
        };

  return {
    allPassed: false,
    outcome: 'timeout',
    timedOut: true,
    durationMs: Math.max(0, Math.round(durationMs)),
    diagnostics,
    visibleResults,
    otherTests,
    runnerUsed,
  };
}

function summarizeHiddenOutcomes(
  hiddenOutcomes: RawCaseOutcome[],
  timeoutMs: number
): OtherTestsSummary {
  const total = hiddenOutcomes.length;
  if (total === 0) {
    return {
      total: 0,
      passed: 0,
      allPassed: true,
      status: 'pass',
      message: 'Other tests: none',
    };
  }

  const passed = hiddenOutcomes.filter((o) => o.passed).length;
  const allPassed = passed === total;

  if (allPassed) {
    return {
      total,
      passed,
      allPassed: true,
      status: 'pass',
      message: `Other tests: ${passed}/${total} passed`,
    };
  }

  const hasTimeout = hiddenOutcomes.some((o) => o.status === 'timeout');
  if (hasTimeout) {
    return {
      total,
      passed,
      allPassed: false,
      status: 'timeout',
      message: `Other tests: timed out (> ${timeoutMs} ms) (${passed}/${total} passed)`,
    };
  }

  const hasError = hiddenOutcomes.some((o) => o.status === 'error');
  if (hasError) {
    return {
      total,
      passed,
      allPassed: false,
      status: 'error',
      message: `Other tests: failed on hidden case (${passed}/${total} passed)`,
    };
  }

  return {
    total,
    passed,
    allPassed: false,
    status: 'fail',
    message: `Other tests: failed on hidden case (${passed}/${total} passed)`,
  };
}
