import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Shuffle,
} from 'lucide-react';
import {
  getSection,
  getSectionsForLanguage,
  LANGUAGE_METADATA,
} from '../curriculum';
import type { LanguageId, UserProgressStore } from '../types/schema';
import { renderFormattedText } from '../utils/formatDoc';
import { computeSectionStarStats } from '../utils/progressStore';
import {
  buildLanguageHref,
  buildProblemHref,
  buildSectionHref,
  navigateTo,
} from '../utils/router';
import { StarRating } from './StarRating';

export interface SectionDetailViewProps {
  language: LanguageId;
  sectionId: string;
  store: UserProgressStore;
}

export const SectionDetailView: React.FC<SectionDetailViewProps> = ({
  language,
  sectionId,
  store,
}) => {
  const [chanceStatus, setChanceStatus] = useState<string | null>(null);
  const meta = LANGUAGE_METADATA[language];
  const sections = getSectionsForLanguage(language);
  const section = getSection(language, sectionId);

  if (!section) {
    return (
      <div className="empty-state-card">
        <h1>Section not found</h1>
        <p>
          Could not find section <code>{sectionId}</code> in {meta.label}.
        </p>
        <a href={buildLanguageHref(language)} className="btn btn-primary">
          Back to {meta.label} Hub
        </a>
      </div>
    );
  }

  const sectionIndex = sections.findIndex((s) => s.id === section.id);
  const prevSection = sectionIndex > 0 ? sections[sectionIndex - 1] : null;
  const nextSection =
    sectionIndex >= 0 && sectionIndex < sections.length - 1
      ? sections[sectionIndex + 1]
      : null;

  const stats = computeSectionStarStats(section, store);
  const [minDiff, maxDiff] = section.difficultyRange;

  const handleSectionChance = () => {
    const unsolvedInSection = section.problems.filter(
      (p) => !store.problems[p.id]?.solved
    );
    if (unsolvedInSection.length > 0) {
      const pick =
        unsolvedInSection[Math.floor(Math.random() * unsolvedInSection.length)];
      setChanceStatus(null);
      navigateTo(buildProblemHref(language, section.id, pick.slug));
      return;
    }

    const unsolvedInLang = sections
      .flatMap((s) => s.problems)
      .filter((p) => !store.problems[p.id]?.solved);

    if (unsolvedInLang.length > 0) {
      const pick =
        unsolvedInLang[Math.floor(Math.random() * unsolvedInLang.length)];
      navigateTo(buildProblemHref(language, pick.sectionId, pick.slug));
      return;
    }

    setChanceStatus(`Every problem in ${meta.label} is solved! ★`);
  };

  return (
    <div className="section-detail-view">
      <div className="section-nav-bar">
        <nav aria-label="Breadcrumbs" className="breadcrumb">
          <ol>
            <li>
              <a href={buildLanguageHref(language)}>{meta.label}</a>
            </li>
            <li>
              <a
                href={buildSectionHref(language, section.id)}
                aria-current="page"
              >
                {section.title}
              </a>
            </li>
          </ol>
        </nav>

        <nav aria-label="Section navigation" className="step-controls">
          {prevSection ? (
            <a
              href={buildSectionHref(language, prevSection.id)}
              className="step-btn"
            >
              <ArrowLeft size={14} aria-hidden="true" focusable="false" />
              <span>prev section</span>
            </a>
          ) : (
            <button type="button" className="step-btn" disabled>
              <ArrowLeft size={14} aria-hidden="true" focusable="false" />
              <span>prev section</span>
            </button>
          )}

          {nextSection ? (
            <a
              href={buildSectionHref(language, nextSection.id)}
              className="step-btn"
            >
              <span>next section</span>
              <ArrowRight size={14} aria-hidden="true" focusable="false" />
            </a>
          ) : (
            <button type="button" className="step-btn" disabled>
              <span>next section</span>
              <ArrowRight size={14} aria-hidden="true" focusable="false" />
            </button>
          )}

          <button
            type="button"
            className="step-btn is-chance"
            onClick={handleSectionChance}
          >
            <Shuffle size={14} aria-hidden="true" focusable="false" />
            <span>chance</span>
          </button>
        </nav>
      </div>

      <section className="section-hero-card" aria-labelledby="section-page-title">
        <div className="section-hero-header">
          <div className="section-title-cluster">
            <h1 id="section-page-title" className="page-title">
              {section.title}
            </h1>
            <StarRating
              solvedCount={stats.solvedCount}
              totalProblems={stats.totalProblems}
              size={18}
            />
            <span className="difficulty-pill">
              Difficulty {minDiff}–{maxDiff}
            </span>
          </div>
          <span className="section-solved-summary">
            <strong>{stats.solvedCount}</strong> of{' '}
            <strong>{stats.totalProblems}</strong> solved (1 ★ per 3 solved)
          </span>
        </div>
        <p className="section-hero-desc">{section.description}</p>
        {chanceStatus && (
          <p className="inline-status-note" role="status">
            {chanceStatus}
          </p>
        )}
      </section>

      <section aria-labelledby="section-problems-heading" className="section-problems-block">
        <h2 id="section-problems-heading" className="sr-only">
          Problems in {section.title}
        </h2>
        <ol className="section-problem-list">
          {section.problems.map((problem, index) => {
            const progress = store.problems[problem.id];
            const isSolved = Boolean(progress?.solved);
            const hasHints = problem.hints.length > 0;

            return (
              <li key={problem.id} className="section-problem-row">
                <a
                  href={buildProblemHref(language, section.id, problem.slug)}
                  className={`section-problem-link ${isSolved ? 'is-solved' : ''}`.trim()}
                >
                  <div className="section-problem-main">
                    <span className="problem-index-num">{index + 1}.</span>
                    {isSolved ? (
                      <CheckCircle2
                        size={18}
                        aria-hidden="true"
                        focusable="false"
                        className="row-status-icon is-solved"
                      />
                    ) : (
                      <Circle
                        size={18}
                        aria-hidden="true"
                        focusable="false"
                        className="row-status-icon is-unsolved"
                      />
                    )}
                    <span className="sr-only">
                      {isSolved ? 'Solved:' : 'Unsolved:'}{' '}
                    </span>
                    <span className="section-problem-title">{problem.title}</span>
                    {hasHints && (
                      <span className="hint-badge" aria-label="Hints available">
                        H
                      </span>
                    )}
                    <span className="difficulty-pill is-compact">
                      {problem.difficulty}
                    </span>
                  </div>
                  <p className="section-problem-excerpt">
                    {renderFormattedText(problem.doc)}
                  </p>
                </a>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};
