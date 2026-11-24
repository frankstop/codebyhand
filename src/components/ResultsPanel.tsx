import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Terminal, XCircle } from 'lucide-react';
import type { ExecutionResult, TestStatus } from '../types/schema';

export interface ResultsPanelProps {
  result: ExecutionResult | null;
  runnerError: string | null;
  isRunning: boolean;
}

function renderStatusBadge(status: TestStatus) {
  switch (status) {
    case 'pass':
      return (
        <span className="status-pill is-pass">
          <CheckCircle2 size={14} aria-hidden="true" focusable="false" />
          <span>OK</span>
        </span>
      );
    case 'timeout':
      return (
        <span className="status-pill is-fail">
          <Clock size={14} aria-hidden="true" focusable="false" />
          <span>Timeout</span>
        </span>
      );
    case 'error':
      return (
        <span className="status-pill is-fail">
          <AlertCircle size={14} aria-hidden="true" focusable="false" />
          <span>Error</span>
        </span>
      );
    case 'fail':
    default:
      return (
        <span className="status-pill is-fail">
          <XCircle size={14} aria-hidden="true" focusable="false" />
          <span>Fail</span>
        </span>
      );
  }
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  result,
  runnerError,
  isRunning,
}) => {
  if (isRunning) {
    return (
      <div className="results-placeholder is-running" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Compiling and running test suite…</span>
      </div>
    );
  }

  if (runnerError) {
    return (
      <div className="outcome-banner is-error" role="alert">
        <AlertCircle size={18} aria-hidden="true" focusable="false" />
        <div className="outcome-banner-content">
          <strong>Runner Error</strong>
          <span>{runnerError}</span>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-placeholder">
        <Terminal size={16} aria-hidden="true" focusable="false" />
        <span>
          Press <strong>Go</strong> or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>⌘</kbd>+<kbd>Enter</kbd> on Mac) to run all test cases.
        </span>
      </div>
    );
  }

  const visiblePassedCount = result.visibleResults.filter((r) => r.passed).length;
  const visibleTotal = result.visibleResults.length;

  let bannerClass = 'outcome-banner is-fail';
  let bannerTitle = `Keep trying — ${visiblePassedCount}/${visibleTotal} visible tests passed`;

  if (result.allPassed) {
    bannerClass = 'outcome-banner is-pass';
    bannerTitle = 'All Correct! ★';
  } else if (result.timedOut || result.outcome === 'timeout') {
    bannerClass = 'outcome-banner is-error';
    bannerTitle = 'Timed out — execution exceeded time limit';
  } else if (result.outcome === 'compile_error') {
    bannerClass = 'outcome-banner is-error';
    bannerTitle = 'Compile / Syntax Error';
  } else if (
    visiblePassedCount === visibleTotal &&
    visibleTotal > 0 &&
    !result.otherTests.allPassed
  ) {
    bannerClass = 'outcome-banner is-fail';
    bannerTitle = `Visible tests passed, but hidden edge cases failed (${result.otherTests.passed}/${result.otherTests.total} other tests passed)`;
  }

  const hasRows = result.visibleResults.length > 0 || result.otherTests.total > 0;

  return (
    <div className="results-panel" aria-live="polite">
      <div className={bannerClass} role={result.allPassed ? 'status' : 'alert'}>
        <div className="outcome-banner-main">
          {result.allPassed ? (
            <CheckCircle2 size={18} aria-hidden="true" focusable="false" />
          ) : result.timedOut ? (
            <Clock size={18} aria-hidden="true" focusable="false" />
          ) : (
            <AlertCircle size={18} aria-hidden="true" focusable="false" />
          )}
          <strong>{bannerTitle}</strong>
        </div>
        <div className="outcome-banner-meta">
          <span>{Math.round(result.durationMs)} ms</span>
          {result.runnerUsed && (
            <span className="runner-chip">{result.runnerUsed}</span>
          )}
        </div>
      </div>

      {result.diagnostics.length > 0 && (
        <section className="diagnostics-panel" aria-label="Compiler and syntax diagnostics">
          <h2 className="diagnostics-heading">Diagnostics</h2>
          <ul className="diagnostics-list">
            {result.diagnostics.map((diag, idx) => (
              <li key={idx} className={`diagnostic-item is-${diag.severity}`}>
                <div className="diagnostic-header">
                  <span className={`diag-severity is-${diag.severity}`}>
                    {diag.severity}
                  </span>
                  {typeof diag.line === 'number' && (
                    <span className="diag-loc">
                      Line {diag.line}
                      {typeof diag.column === 'number' ? `:${diag.column}` : ''}
                    </span>
                  )}
                  <span className="diag-summary">{diag.message}</span>
                </div>
                {diag.raw && diag.raw.trim() !== diag.message.trim() && (
                  <pre
                    tabIndex={0}
                    role="region"
                    aria-label={`Raw compiler output ${idx + 1}`}
                    className="code-block diagnostic-raw"
                  >
                    <code>{diag.raw}</code>
                  </pre>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasRows && (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="results-table-caption"
          className="table-wrapper"
        >
          <table
            className="results-table"
            style={
              {
                '--label-1': '"Call / Input"',
                '--label-2': '"Expected"',
                '--label-3': '"Run"',
                '--label-4': '"Status"',
              } as React.CSSProperties
            }
          >
            <caption id="results-table-caption" className="results-table-caption">
              Test Case Results ({visiblePassedCount}/{visibleTotal} visible
              {result.otherTests.total > 0
                ? `, ${result.otherTests.passed}/${result.otherTests.total} hidden`
                : ''}
              )
            </caption>
            <thead>
              <tr>
                <th scope="col">Call / Input</th>
                <th scope="col">Expected</th>
                <th scope="col">Run</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.visibleResults.map((row) => (
                <tr
                  key={row.index}
                  className={row.passed ? 'result-row is-pass' : 'result-row is-fail'}
                >
                  <th scope="row" className="mono-cell">
                    {row.call}
                  </th>
                  <td className="mono-cell">{row.expected}</td>
                  <td className="mono-cell">{row.run}</td>
                  <td className="status-cell">{renderStatusBadge(row.status)}</td>
                </tr>
              ))}

              {result.otherTests.total > 0 && (
                <tr
                  className={
                    result.otherTests.allPassed
                      ? 'result-row other-tests-row is-pass'
                      : 'result-row other-tests-row is-fail'
                  }
                >
                  <th scope="row" className="other-tests-label">
                    Other tests
                  </th>
                  <td className="mono-cell">All pass</td>
                  <td className="mono-cell">
                    {result.otherTests.message
                      ? result.otherTests.message.replace(/^other tests:\s*/i, '')
                      : `${result.otherTests.passed}/${result.otherTests.total} passed`}
                  </td>
                  <td className="status-cell">
                    {renderStatusBadge(result.otherTests.status)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
