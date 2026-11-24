import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Play,
  RotateCcw,
  Shuffle,
  Unlock,
} from 'lucide-react';
import {
  getProblem,
  getSection,
  getSectionsForLanguage,
  LANGUAGE_METADATA,
} from '../curriculum';
import { executionEngine } from '../engine';
import type {
  CobolBackendMode,
  CobolFormatMode,
  ExecutionResult,
  LanguageId,
  ProblemSpec,
  UserProgressStore,
} from '../types/schema';
import {
  convertCobolBuffer,
  detectCobolFormat,
  getCobolStarterForFormat,
} from '../utils/cobolFormatHelper';
import { renderFormattedText } from '../utils/formatDoc';
import {
  buildLanguageHref,
  buildProblemHref,
  buildSectionHref,
  navigateTo,
} from '../utils/router';
import { CobolSwitch } from './CobolSwitch';
import { CodeEditor } from './CodeEditor';
import { ConfirmDialog, type ConfirmDialogHandle } from './ConfirmDialog';
import { ResultsPanel } from './ResultsPanel';

export interface ProblemWorkspaceViewProps {
  language: LanguageId;
  sectionId: string;
  problemSlug: string;
  store: UserProgressStore;
  onSaveDraft: (
    problemId: string,
    code: string,
    cobolFormat?: CobolFormatMode
  ) => void;
  onCobolFormatChange: (
    problemId: string,
    format: CobolFormatMode,
    convertedCode: string
  ) => void;
  onRecordAttempt: (
    problemId: string,
    allPassed: boolean,
    code: string,
    cobolFormat?: CobolFormatMode
  ) => void;
  onRecordHintViewed: (problemId: string, viewedCount: number) => void;
  onRecordSolutionViewed: (problemId: string, isSolved: boolean) => void;
  onResetDraft: (
    problemId: string,
    starterCode: string,
    cobolFormat?: CobolFormatMode
  ) => void;
}

function getInitialEditorState(
  problem: ProblemSpec,
  store: UserProgressStore
): { code: string; cobolFormat: CobolFormatMode } {
  const savedEntry = store.problems[problem.id];
  if (problem.language === 'cobol') {
    const format: CobolFormatMode =
      savedEntry?.cobolFormat ??
      (savedEntry?.savedCode ? detectCobolFormat(savedEntry.savedCode) : 'free');
    const code =
      savedEntry?.savedCode ?? getCobolStarterForFormat(problem, format);
    return { code, cobolFormat: format };
  }
  return {
    code: savedEntry?.savedCode ?? problem.starterCode,
    cobolFormat: 'free',
  };
}

export const ProblemWorkspaceView: React.FC<ProblemWorkspaceViewProps> = ({
  language,
  sectionId,
  problemSlug,
  store,
  onSaveDraft,
  onCobolFormatChange,
  onRecordAttempt,
  onRecordHintViewed,
  onRecordSolutionViewed,
  onResetDraft,
}) => {
  const runnerSelectId = useId();
  const resetDialogRef = useRef<ConfirmDialogHandle | null>(null);

  const meta = LANGUAGE_METADATA[language];
  const section = getSection(language, sectionId);
  const problem = getProblem(language, sectionId, problemSlug);

  if (!section || !problem) {
    return (
      <div className="empty-state-card">
        <h1>Problem not found</h1>
        <p>
          Could not locate problem <code>{problemSlug}</code> inside{' '}
          <code>{sectionId}</code> ({meta.label}).
        </p>
        <a href={buildLanguageHref(language)} className="btn btn-primary">
          Back to {meta.label} Hub
        </a>
      </div>
    );
  }

  return (
    <ProblemWorkspaceInner
      key={problem.id}
      problem={problem}
      sectionTitle={section.title}
      sectionProblems={section.problems}
      language={language}
      runnerSelectId={runnerSelectId}
      resetDialogRef={resetDialogRef}
      store={store}
      onSaveDraft={onSaveDraft}
      onCobolFormatChange={onCobolFormatChange}
      onRecordAttempt={onRecordAttempt}
      onRecordHintViewed={onRecordHintViewed}
      onRecordSolutionViewed={onRecordSolutionViewed}
      onResetDraft={onResetDraft}
    />
  );
};

interface ProblemWorkspaceInnerProps {
  problem: ProblemSpec;
  sectionTitle: string;
  sectionProblems: ProblemSpec[];
  language: LanguageId;
  runnerSelectId: string;
  resetDialogRef: React.RefObject<ConfirmDialogHandle | null>;
  store: UserProgressStore;
  onSaveDraft: (
    problemId: string,
    code: string,
    cobolFormat?: CobolFormatMode
  ) => void;
  onCobolFormatChange: (
    problemId: string,
    format: CobolFormatMode,
    convertedCode: string
  ) => void;
  onRecordAttempt: (
    problemId: string,
    allPassed: boolean,
    code: string,
    cobolFormat?: CobolFormatMode
  ) => void;
  onRecordHintViewed: (problemId: string, viewedCount: number) => void;
  onRecordSolutionViewed: (problemId: string, isSolved: boolean) => void;
  onResetDraft: (
    problemId: string,
    starterCode: string,
    cobolFormat?: CobolFormatMode
  ) => void;
}

const ProblemWorkspaceInner: React.FC<ProblemWorkspaceInnerProps> = ({
  problem,
  sectionTitle,
  sectionProblems,
  language,
  runnerSelectId,
  resetDialogRef,
  store,
  onSaveDraft,
  onCobolFormatChange,
  onRecordAttempt,
  onRecordHintViewed,
  onRecordSolutionViewed,
  onResetDraft,
}) => {
  const meta = LANGUAGE_METADATA[language];
  const progress = store.problems[problem.id];

  const initial = useMemo(
    () => getInitialEditorState(problem, store),
    // Keyed by problem.id so initial state loads once per problem mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [problem.id]
  );

  const [code, setCode] = useState<string>(initial.code);
  const [cobolFormat, setCobolFormat] = useState<CobolFormatMode>(initial.cobolFormat);
  const [cobolBackend, setCobolBackend] = useState<CobolBackendMode>('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);

  // Progressive Hints state
  const [revealedHintCount, setRevealedHintCount] = useState<number>(() =>
    Math.min(problem.hints.length, Math.max(1, progress?.hintsViewedCount ?? 1))
  );
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [copiedSolution, setCopiedSolution] = useState(false);
  const [chanceNotice, setChanceNotice] = useState<string | null>(null);

  const isSolved = Boolean(progress?.solved || executionResult?.allPassed);

  const problemIdx = sectionProblems.findIndex((p) => p.id === problem.id);
  const prevProblem = problemIdx > 0 ? sectionProblems[problemIdx - 1] : null;
  const nextProblem =
    problemIdx >= 0 && problemIdx < sectionProblems.length - 1
      ? sectionProblems[problemIdx + 1]
      : null;

  const sampleTests = useMemo(
    () => problem.tests.filter((t) => !t.hidden).slice(0, 3),
    [problem.tests]
  );

  const handleCodeChange = useCallback(
    (nextCode: string) => {
      setCode(nextCode);
      onSaveDraft(
        problem.id,
        nextCode,
        problem.language === 'cobol' ? cobolFormat : undefined
      );
    },
    [problem.id, problem.language, cobolFormat, onSaveDraft]
  );

  const handleCobolFormatToggle = useCallback(
    (nextFormat: CobolFormatMode) => {
      if (nextFormat === cobolFormat) return;
      const converted = convertCobolBuffer(code, nextFormat, problem);
      setCobolFormat(nextFormat);
      setCode(converted);
      onCobolFormatChange(problem.id, nextFormat, converted);
    },
    [cobolFormat, code, problem, onCobolFormatChange]
  );

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setRunnerError(null);

    try {
      const result = await executionEngine.execute(language, code, problem, {
        cobolFormat: language === 'cobol' ? cobolFormat : undefined,
        cobolBackend: language === 'cobol' ? cobolBackend : undefined,
      });
      setExecutionResult(result);
      onRecordAttempt(
        problem.id,
        result.allPassed,
        code,
        language === 'cobol' ? cobolFormat : undefined
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Execution failed unexpectedly. Ensure the runner service is available.';
      setRunnerError(msg);
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning,
    language,
    code,
    problem,
    cobolFormat,
    cobolBackend,
    onRecordAttempt,
  ]);

  // Window-level Ctrl+Enter / Cmd+Enter fallback when focus is outside CodeMirror
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        void handleRun();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRun]);

  const handleChance = () => {
    const otherUnsolvedInSection = sectionProblems.filter(
      (p) => p.id !== problem.id && !store.problems[p.id]?.solved
    );

    if (otherUnsolvedInSection.length > 0) {
      const pick =
        otherUnsolvedInSection[
          Math.floor(Math.random() * otherUnsolvedInSection.length)
        ];
      setChanceNotice(null);
      navigateTo(buildProblemHref(language, problem.sectionId, pick.slug));
      return;
    }

    // Check if there are unfinished problems elsewhere in the language
    const allUnsolvedInLanguage = getSectionsForLanguage(language)
      .flatMap((s) => s.problems)
      .filter((p) => p.id !== problem.id && !store.problems[p.id]?.solved);

    if (allUnsolvedInLanguage.length > 0) {
      const pick =
        allUnsolvedInLanguage[
          Math.floor(Math.random() * allUnsolvedInLanguage.length)
        ];
      setChanceNotice(null);
      navigateTo(buildProblemHref(language, pick.sectionId, pick.slug));
      return;
    }

    if (!isSolved) {
      setChanceNotice(`"${problem.title}" is the final unsolved problem in ${meta.label}!`);
    } else {
      setChanceNotice(`All problems in ${meta.label} are already solved! ★`);
    }
  };

  const handleHintToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (event.currentTarget.open && problem.hints.length > 0) {
      onRecordHintViewed(problem.id, revealedHintCount);
    }
  };

  const handleRevealNextHint = () => {
    const nextCount = Math.min(problem.hints.length, revealedHintCount + 1);
    setRevealedHintCount(nextCount);
    onRecordHintViewed(problem.id, nextCount);
  };

  const canShowSolution =
    problem.showsolution || (problem.showpost && isSolved);
  const showLockedSolutionButton =
    !problem.showsolution && problem.showpost && !isSolved;

  const handleToggleSolution = () => {
    if (!canShowSolution) return;
    const nextOpen = !solutionOpen;
    setSolutionOpen(nextOpen);
    if (nextOpen) {
      onRecordSolutionViewed(problem.id, isSolved);
    }
  };

  const handleCopySolutionToEditor = () => {
    const targetCode =
      problem.language === 'cobol' && cobolFormat === 'fixed'
        ? convertCobolBuffer(problem.solution, 'fixed', problem)
        : problem.solution;
    handleCodeChange(targetCode);
    setCopiedSolution(true);
    window.setTimeout(() => setCopiedSolution(false), 1800);
  };

  const handleConfirmResetStarter = () => {
    const starter =
      problem.language === 'cobol'
        ? getCobolStarterForFormat(problem, cobolFormat)
        : problem.starterCode;
    setCode(starter);
    setExecutionResult(null);
    setRunnerError(null);
    onResetDraft(
      problem.id,
      starter,
      problem.language === 'cobol' ? cobolFormat : undefined
    );
  };

  const signatureLabel =
    language === 'js'
      ? `function ${problem.functionName}(…)`
      : language === 'rust'
        ? `pub fn ${problem.functionName}(…)`
        : `PROGRAM-ID. ${problem.functionName}.`;

  return (
    <div className="workspace-view">
      <div className="workspace-topbar">
        <div className="workspace-breadcrumb-cluster">
          <nav aria-label="Breadcrumbs" className="breadcrumb">
            <ol>
              <li>
                <a href={buildLanguageHref(language)}>{meta.label}</a>
              </li>
              <li>
                <a href={buildSectionHref(language, problem.sectionId)}>
                  {sectionTitle}
                </a>
              </li>
              <li>
                <a
                  href={buildProblemHref(language, problem.sectionId, problem.slug)}
                  aria-current="page"
                >
                  {problem.title}
                </a>
              </li>
            </ol>
          </nav>

          <span
            className="difficulty-pill"
            aria-label={`Difficulty rating ${problem.difficulty}`}
          >
            {problem.difficulty}
          </span>

          {isSolved && (
            <span className="solved-pill">
              <CheckCircle2 size={14} aria-hidden="true" focusable="false" />
              <span>Solved</span>
            </span>
          )}
        </div>

        <nav aria-label="Problem navigation" className="step-controls">
          {prevProblem ? (
            <a
              href={buildProblemHref(language, problem.sectionId, prevProblem.slug)}
              className="step-btn"
            >
              <ArrowLeft size={14} aria-hidden="true" focusable="false" />
              <span>prev</span>
            </a>
          ) : (
            <button type="button" className="step-btn" disabled>
              <ArrowLeft size={14} aria-hidden="true" focusable="false" />
              <span>prev</span>
            </button>
          )}

          {nextProblem ? (
            <a
              href={buildProblemHref(language, problem.sectionId, nextProblem.slug)}
              className="step-btn"
            >
              <span>next</span>
              <ArrowRight size={14} aria-hidden="true" focusable="false" />
            </a>
          ) : (
            <button type="button" className="step-btn" disabled>
              <span>next</span>
              <ArrowRight size={14} aria-hidden="true" focusable="false" />
            </button>
          )}

          <button
            type="button"
            className="step-btn is-chance"
            onClick={handleChance}
          >
            <Shuffle size={14} aria-hidden="true" focusable="false" />
            <span>chance</span>
          </button>
        </nav>
      </div>

      {chanceNotice && (
        <p className="inline-status-note" role="status">
          {chanceNotice}
        </p>
      )}

      <div className="workspace-columns">
        {/* Left Column: Problem Spec, Samples, Progressive Hints, Reference Solution */}
        <div className="workspace-left-pane">
          <div className="problem-spec-card">
            <h1 className="problem-title">{problem.title}</h1>
            <p className="problem-doc">{renderFormattedText(problem.doc)}</p>

            {problem.note && (
              <div className="problem-note-callout">
                <strong className="problem-note-label">Note:</strong>{' '}
                <span>{renderFormattedText(problem.note)}</span>
              </div>
            )}

            {sampleTests.length > 0 && (
              <div className="sample-cases-section">
                <h2 className="sub-heading">Sample Cases</h2>
                <ul className="sample-cases-list">
                  {sampleTests.map((test, idx) => (
                    <li key={idx} className="sample-case-item">
                      <code>
                        {test.call} <span className="sample-arrow">-&gt;</span>{' '}
                        {test.expectedDisplay}
                      </code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Progressive Hints Disclosure */}
          {problem.hints.length > 0 && (
            <details className="hint-disclosure" onToggle={handleHintToggle}>
              <summary className="hint-summary">
                <span className="hint-badge">H</span>
                <span>
                  Hints ({revealedHintCount} of {problem.hints.length})
                </span>
              </summary>
              <div className="hint-panel-body">
                <ol className="hint-list">
                  {problem.hints.slice(0, revealedHintCount).map((hint, idx) => (
                    <li key={idx} className="hint-item">
                      <p className="hint-text">{renderFormattedText(hint.text)}</p>
                      {hint.snippet && (
                        <pre
                          tabIndex={0}
                          role="region"
                          aria-label={`Hint ${idx + 1} code example`}
                          className="code-block hint-code-snippet"
                        >
                          <code>{hint.snippet}</code>
                        </pre>
                      )}
                    </li>
                  ))}
                </ol>

                {revealedHintCount < problem.hints.length && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm hint-next-btn"
                    onClick={handleRevealNextHint}
                  >
                    Next Hint ({revealedHintCount + 1} of {problem.hints.length})
                  </button>
                )}
              </div>
            </details>
          )}

          {/* Reference Solution State Machine (showsolution vs showpost) */}
          {(problem.showsolution || problem.showpost) && (
            <div className="solution-drawer-card">
              <div className="solution-drawer-bar">
                {showLockedSolutionButton ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled
                    >
                      <Lock size={14} aria-hidden="true" focusable="false" />
                      <span>Show Solution (Locked)</span>
                    </button>
                    <span className="solution-helper-note">
                      Pass all tests to unlock the reference solution
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-expanded={solutionOpen}
                      onClick={handleToggleSolution}
                    >
                      {solutionOpen ? (
                        <EyeOff size={14} aria-hidden="true" focusable="false" />
                      ) : problem.showsolution ? (
                        <Eye size={14} aria-hidden="true" focusable="false" />
                      ) : (
                        <Unlock size={14} aria-hidden="true" focusable="false" />
                      )}
                      <span>
                        {solutionOpen ? 'Hide Solution' : 'Show Solution'}
                      </span>
                    </button>
                    <span className="solution-helper-note">
                      {problem.showsolution
                        ? 'Warmup / intro problem — reference solution available anytime'
                        : 'Solved ★ — compare against the idiomatic reference solution'}
                    </span>
                  </>
                )}
              </div>

              {solutionOpen && canShowSolution && (
                <div className="solution-content">
                  <div className="solution-content-toolbar">
                    <span className="solution-content-label">
                      Reference Solution ({meta.label})
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={handleCopySolutionToEditor}
                    >
                      {copiedSolution ? (
                        <>
                          <Check size={13} aria-hidden="true" focusable="false" />
                          <span>Copied to Editor</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} aria-hidden="true" focusable="false" />
                          <span>Copy to Editor</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre
                    tabIndex={0}
                    role="region"
                    aria-label={`Reference solution for ${problem.title}`}
                    className="code-block solution-code-block"
                  >
                    <code>{problem.solution}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: CodeMirror 6 Editor + Toolbar + Live Test Results */}
        <div className="workspace-right-pane">
          <div className="editor-card">
            <div className="editor-toolbar">
              <code className="editor-signature">{signatureLabel}</code>

              {language === 'cobol' && (
                <div className="cobol-toolbar-controls">
                  <CobolSwitch
                    format={cobolFormat}
                    onChange={handleCobolFormatToggle}
                    disabled={isRunning}
                  />

                  <div className="cobol-runner-control">
                    <label htmlFor={runnerSelectId} className="cobol-runner-label">
                      Runner
                    </label>
                    <select
                      id={runnerSelectId}
                      value={cobolBackend}
                      disabled={isRunning}
                      onChange={(e) =>
                        setCobolBackend(e.currentTarget.value as CobolBackendMode)
                      }
                      className="cobol-runner-select"
                    >
                      <option value="auto">Auto (cobc 3.2 / WASM)</option>
                      <option value="wasm">Browser WASM</option>
                      <option value="server">Server cobc 3.2</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <CodeEditor
              value={code}
              language={language}
              cobolFormat={cobolFormat}
              onChange={handleCodeChange}
              onRun={() => void handleRun()}
              ariaLabel={`${problem.title} ${meta.label} solution editor`}
            />

            <div className="editor-action-bar">
              <div className="editor-primary-actions">
                <button
                  type="button"
                  className="btn btn-go"
                  onClick={() => void handleRun()}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <span className="spinner is-light" aria-hidden="true" />
                      <span>Running…</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} aria-hidden="true" focusable="false" />
                      <span>Go</span>
                    </>
                  )}
                </button>
                <span className="shortcut-hint" aria-hidden="true">
                  <kbd>Ctrl</kbd>+<kbd>Enter</kbd> / <kbd>⌘</kbd>+<kbd>↵</kbd>
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => resetDialogRef.current?.open()}
                disabled={isRunning}
              >
                <RotateCcw size={14} aria-hidden="true" focusable="false" />
                <span>Reset Starter Code</span>
              </button>
            </div>
          </div>

          <ResultsPanel
            result={executionResult}
            runnerError={runnerError}
            isRunning={isRunning}
          />
        </div>
      </div>

      <ConfirmDialog
        ref={resetDialogRef}
        title="Reset starter code?"
        description={`Replace your current editor code for "${problem.title}" with the clean starter template? Your solved checkmark and stars will not be lost.`}
        confirmLabel="Reset Starter Code"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmResetStarter}
      />
    </div>
  );
};
