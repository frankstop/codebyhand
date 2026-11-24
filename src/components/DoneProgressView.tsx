import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  RotateCcw,
  Star,
  Upload,
} from 'lucide-react';
import {
  getAllProblems,
  getSection,
  getSectionsForLanguage,
  LANGUAGE_METADATA,
} from '../curriculum';
import type { LanguageId, ProblemSpec, UserProgressStore } from '../types/schema';
import {
  computeGlobalStats,
  computeSectionStarStats,
} from '../utils/progressStore';
import {
  buildLanguageHref,
  buildProblemHref,
  buildSectionHref,
} from '../utils/router';
import { ConfirmDialog, type ConfirmDialogHandle } from './ConfirmDialog';
import {
  ImportProgressDialog,
  type ImportProgressDialogHandle,
} from './ImportProgressDialog';
import { StarRating } from './StarRating';

export interface DoneProgressViewProps {
  store: UserProgressStore;
  onImportProgress: (incoming: UserProgressStore, mode: 'merge' | 'replace') => void;
  onResetAllProgress: () => void;
}

const LANGUAGES: LanguageId[] = ['js', 'rust', 'cobol'];

function formatTimestamp(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const DoneProgressView: React.FC<DoneProgressViewProps> = ({
  store,
  onImportProgress,
  onResetAllProgress,
}) => {
  const importDialogRef = useRef<ImportProgressDialogHandle | null>(null);
  const resetDialogRef = useRef<ConfirmDialogHandle | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const globalStats = computeGlobalStats(store);

  const problemLookup = useMemo(() => {
    const map = new Map<string, ProblemSpec>();
    for (const p of getAllProblems()) {
      map.set(p.id, p);
    }
    return map;
  }, []);

  const sectionRows = useMemo(() => {
    return LANGUAGES.flatMap((lang) => {
      const meta = LANGUAGE_METADATA[lang];
      return getSectionsForLanguage(lang).map((section) => {
        const stats = computeSectionStarStats(section, store);
        const pct =
          stats.totalProblems > 0
            ? Math.round((stats.solvedCount / stats.totalProblems) * 100)
            : 0;
        return {
          language: lang,
          languageLabel: meta.label,
          section,
          stats,
          pct,
        };
      });
    });
  }, [store]);

  const solvedLog = useMemo(() => {
    return Object.entries(store.problems)
      .filter(([, entry]) => entry.solved)
      .map(([problemId, entry]) => {
        const spec = problemLookup.get(problemId);
        const section = spec
          ? getSection(spec.language, spec.sectionId)
          : undefined;
        return {
          problemId,
          entry,
          spec,
          sectionTitle: section?.title ?? spec?.sectionId ?? 'Custom / Imported',
        };
      })
      .sort((a, b) => {
        const ta = a.entry.solvedAt ?? '';
        const tb = b.entry.solvedAt ?? '';
        return tb.localeCompare(ta);
      });
  }, [store.problems, problemLookup]);

  const handleExportJson = () => {
    const payload = JSON.stringify(store, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `codebyhand-progress-${dateStamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatusMessage('Exported progress JSON file.');
  };

  const handleImportConfirmed = (
    incoming: UserProgressStore,
    mode: 'merge' | 'replace'
  ) => {
    onImportProgress(incoming, mode);
    const solvedIncoming = Object.values(incoming.problems).filter(
      (p) => p.solved
    ).length;
    setStatusMessage(
      `Imported progress (${solvedIncoming} solved problem${solvedIncoming === 1 ? '' : 's'}, mode: ${mode}).`
    );
  };

  const handleResetConfirmed = () => {
    onResetAllProgress();
    setStatusMessage('All local progress has been reset.');
  };

  return (
    <div className="done-view">
      <div className="done-header-bar">
        <div>
          <h1 className="page-title">Done &amp; Progress</h1>
          <p className="done-subtitle">
            Local-first progress across JavaScript, Rust, and COBOL —{' '}
            <strong>{globalStats.solvedProblems}</strong> of{' '}
            <strong>{globalStats.totalProblems}</strong> solved,{' '}
            <strong>{globalStats.earnedStars}</strong> gold stars earned.
          </p>
        </div>

        <div className="done-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleExportJson}
          >
            <Download size={14} aria-hidden="true" focusable="false" />
            <span>Export Progress (JSON)</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => importDialogRef.current?.open()}
          >
            <Upload size={14} aria-hidden="true" focusable="false" />
            <span>Import Progress (JSON)</span>
          </button>

          <button
            type="button"
            className="btn btn-danger-outline btn-sm"
            onClick={() => resetDialogRef.current?.open()}
          >
            <RotateCcw size={14} aria-hidden="true" focusable="false" />
            <span>Reset All Progress</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <p className="inline-status-note" role="status">
          {statusMessage}
        </p>
      )}

      {/* Language Track Summary Cards */}
      <section aria-label="Language completion summary" className="done-language-cards">
        {LANGUAGES.map((lang) => {
          const meta = LANGUAGE_METADATA[lang];
          const stats = globalStats.byLanguage[lang];
          const pct =
            stats.totalProblems > 0
              ? Math.round((stats.solvedProblems / stats.totalProblems) * 100)
              : 0;

          return (
            <article key={lang} className="done-lang-card">
              <div className="done-lang-card-header">
                <h2 className="done-lang-title">
                  <a href={buildLanguageHref(lang)}>{meta.label}</a>
                </h2>
                <span className="tech-badge">{meta.badge}</span>
              </div>

              <div className="done-lang-metrics">
                <span className="done-lang-solved">
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                    focusable="false"
                    className="solved-check-icon"
                  />
                  <strong>{stats.solvedProblems}</strong> / {stats.totalProblems} solved
                </span>
                <span className="done-lang-stars">
                  <Star
                    size={16}
                    aria-hidden="true"
                    focusable="false"
                    className="star-icon is-earned"
                  />
                  <strong>{stats.earnedStars}</strong> / {stats.totalStarSlots} stars
                </span>
              </div>

              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-fill"
                  style={{ '--progress-pct': `${pct}%` } as React.CSSProperties}
                />
              </div>
              <span className="done-pct-caption">{pct}% complete</span>
            </article>
          );
        })}
      </section>

      {/* Per-Section Completion Table */}
      <section aria-labelledby="section-breakdown-heading" className="done-section-block">
        <h2 id="section-breakdown-heading" className="section-block-heading">
          Per-Section Completion
        </h2>

        {sectionRows.length === 0 ? (
          <p className="muted-empty">No curriculum sections available yet.</p>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="section-completion-caption"
            className="table-wrapper"
          >
            <table
              className="results-table progress-table"
              style={
                {
                  '--label-1': '"Section"',
                  '--label-2': '"Language"',
                  '--label-3': '"Gold Stars"',
                  '--label-4': '"Solved"',
                  '--label-5': '"Completion"',
                } as React.CSSProperties
              }
            >
              <caption id="section-completion-caption" className="sr-only">
                Per-section completion and gold stars across languages
              </caption>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Language</th>
                  <th scope="col">Gold Stars</th>
                  <th scope="col">Solved</th>
                  <th scope="col">Completion</th>
                </tr>
              </thead>
              <tbody>
                {sectionRows.map(({ language, languageLabel, section, stats, pct }) => (
                  <tr key={`${language}-${section.id}`}>
                    <th scope="row">
                      <a
                        href={buildSectionHref(language, section.id)}
                        className="table-link"
                      >
                        {section.title}
                      </a>
                    </th>
                    <td>{languageLabel}</td>
                    <td>
                      <StarRating
                        solvedCount={stats.solvedCount}
                        totalProblems={stats.totalProblems}
                      />
                    </td>
                    <td className="mono-cell">
                      {stats.solvedCount} / {stats.totalProblems}
                    </td>
                    <td className="mono-cell">{pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Chronological Solved Log */}
      <section aria-labelledby="solved-log-heading" className="done-section-block">
        <h2 id="solved-log-heading" className="section-block-heading">
          Chronological Solved Log
        </h2>

        {solvedLog.length === 0 ? (
          <div className="empty-state-card is-compact">
            <p>
              No solved problems recorded yet. Pick a problem in{' '}
              <a href={buildLanguageHref('js')}>JavaScript</a>,{' '}
              <a href={buildLanguageHref('rust')}>Rust</a>, or{' '}
              <a href={buildLanguageHref('cobol')}>COBOL</a> and press <strong>Go</strong>!
            </p>
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="solved-log-caption"
            className="table-wrapper"
          >
            <table
              className="results-table log-table"
              style={
                {
                  '--label-1': '"Problem"',
                  '--label-2': '"Track / Section"',
                  '--label-3': '"Solved At"',
                  '--label-4': '"Attempts"',
                  '--label-5': '"Notes"',
                } as React.CSSProperties
              }
            >
              <caption id="solved-log-caption" className="sr-only">
                Chronological history of solved coding problems
              </caption>
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Track / Section</th>
                  <th scope="col">Solved At</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {solvedLog.map(({ problemId, entry, spec, sectionTitle }) => {
                  const hintsCount = entry.hintsViewedCount ?? 0;
                  const usedPreSolve = Boolean(entry.solutionViewedPreSolve);

                  return (
                    <tr key={problemId}>
                      <th scope="row" className="mono-cell">
                        {spec ? (
                          <a
                            href={buildProblemHref(
                              spec.language,
                              spec.sectionId,
                              spec.slug
                            )}
                            className="table-link"
                          >
                            {spec.title}
                          </a>
                        ) : (
                          problemId
                        )}
                      </th>
                      <td>
                        {spec
                          ? `${LANGUAGE_METADATA[spec.language].label} · ${sectionTitle}`
                          : sectionTitle}
                      </td>
                      <td>{formatTimestamp(entry.solvedAt)}</td>
                      <td className="mono-cell">{entry.attempts ?? 1}</td>
                      <td>
                        <div className="log-badges">
                          {!usedPreSolve && hintsCount === 0 && (
                            <span className="assist-chip is-clean">
                              Unaided ★
                            </span>
                          )}
                          {hintsCount > 0 && (
                            <span className="assist-chip is-hint">
                              Hints ({hintsCount})
                            </span>
                          )}
                          {usedPreSolve && (
                            <span className="assist-chip is-solution">
                              Pre-solve solution viewed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ImportProgressDialog
        ref={importDialogRef}
        onImport={handleImportConfirmed}
      />

      <ConfirmDialog
        ref={resetDialogRef}
        title="Reset all progress?"
        description="This permanently clears all solved checkmarks, gold stars, and saved code drafts from this browser. Export a JSON backup first if you want to keep your history."
        confirmLabel="Reset All Progress"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleResetConfirmed}
      />
    </div>
  );
};
