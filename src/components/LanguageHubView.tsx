import React, { useId, useMemo, useState } from 'react';
import { ArrowRight, Check, Search, Shuffle, Star, X } from 'lucide-react';
import { getSectionsForLanguage, LANGUAGE_METADATA } from '../curriculum';
import type { LanguageId, UserProgressStore } from '../types/schema';
import {
  computeLanguageStats,
  computeSectionStarStats,
} from '../utils/progressStore';
import {
  buildProblemHref,
  buildSectionHref,
  navigateTo,
} from '../utils/router';
import { StarRating } from './StarRating';

export interface LanguageHubViewProps {
  language: LanguageId;
  store: UserProgressStore;
}

type HubFilterMode = 'all' | 'unsolved' | 'hints';

export const LanguageHubView: React.FC<LanguageHubViewProps> = ({
  language,
  store,
}) => {
  const searchInputId = useId();
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<HubFilterMode>('all');
  const [chanceMessage, setChanceMessage] = useState<string | null>(null);

  const meta = LANGUAGE_METADATA[language];
  const sections = getSectionsForLanguage(language);
  const langStats = computeLanguageStats(language, store);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => {
        const sectionTitleMatches =
          !normalizedQuery ||
          section.title.toLowerCase().includes(normalizedQuery) ||
          section.description.toLowerCase().includes(normalizedQuery);

        const matchingProblems = section.problems.filter((problem) => {
          const isSolved = Boolean(store.problems[problem.id]?.solved);
          if (filterMode === 'unsolved' && isSolved) return false;
          if (filterMode === 'hints' && problem.hints.length === 0) return false;

          if (!normalizedQuery || sectionTitleMatches) {
            return true;
          }

          return (
            problem.title.toLowerCase().includes(normalizedQuery) ||
            problem.slug.toLowerCase().includes(normalizedQuery) ||
            problem.functionName.toLowerCase().includes(normalizedQuery)
          );
        });

        return {
          section,
          matchingProblems,
          visible:
            matchingProblems.length > 0 ||
            (section.problems.length === 0 && sectionTitleMatches),
        };
      })
      .filter((entry) => entry.visible);
  }, [sections, normalizedQuery, filterMode, store.problems]);

  const handleLanguageChance = () => {
    const allProblems = sections.flatMap((s) => s.problems);
    if (allProblems.length === 0) {
      setChanceMessage('Curriculum problems are still loading.');
      return;
    }
    const unsolved = allProblems.filter((p) => !store.problems[p.id]?.solved);
    if (unsolved.length === 0) {
      setChanceMessage(`All ${allProblems.length} ${meta.label} problems solved! ★`);
      return;
    }
    const chosen = unsolved[Math.floor(Math.random() * unsolved.length)];
    setChanceMessage(null);
    navigateTo(buildProblemHref(language, chosen.sectionId, chosen.slug));
  };

  return (
    <div className="hub-view">
      <section className="hub-hero" aria-labelledby="hub-main-heading">
        <div className="hub-hero-copy">
          <div className="hub-title-row">
            <h1 id="hub-main-heading" className="page-title">
              {meta.label}
            </h1>
            <span className="tech-badge">{meta.badge}</span>
          </div>
          <p className="hub-tagline">{meta.tagline}</p>
        </div>

        <div className="hub-hero-stats">
          <div className="stat-metric">
            <span className="stat-metric-label">Solved</span>
            <strong className="stat-metric-value">
              {langStats.solvedProblems}
              <span className="stat-metric-denom"> / {langStats.totalProblems}</span>
            </strong>
          </div>
          <div className="stat-metric">
            <span className="stat-metric-label">Gold Stars</span>
            <strong className="stat-metric-value is-gold">
              <Star
                size={16}
                aria-hidden="true"
                focusable="false"
                className="star-icon is-earned"
              />
              <span>
                {langStats.earnedStars}
                <span className="stat-metric-denom"> / {langStats.totalStarSlots}</span>
              </span>
            </strong>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-chance-hero"
            onClick={handleLanguageChance}
          >
            <Shuffle size={15} aria-hidden="true" focusable="false" />
            <span>Chance</span>
          </button>
        </div>
      </section>

      {chanceMessage && (
        <p className="inline-status-note" role="status">
          {chanceMessage}
        </p>
      )}

      <search className="hub-search-bar">
        <div className="search-input-wrap">
          <label htmlFor={searchInputId} className="sr-only">
            Filter {meta.label} sections and problems
          </label>
          <Search
            size={16}
            aria-hidden="true"
            focusable="false"
            className="search-input-icon"
          />
          <input
            id={searchInputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder={`Filter ${meta.label} sections or problems…`}
            className="search-input"
          />
          {query && (
            <button
              type="button"
              className="search-clear-btn"
              aria-label="Clear filter"
              onClick={() => setQuery('')}
            >
              <X size={14} aria-hidden="true" focusable="false" />
            </button>
          )}
        </div>

        <div className="hub-filter-pills" role="group" aria-label="Problem filter">
          <button
            type="button"
            aria-pressed={filterMode === 'all'}
            className={`filter-pill ${filterMode === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All
          </button>
          <button
            type="button"
            aria-pressed={filterMode === 'unsolved'}
            className={`filter-pill ${filterMode === 'unsolved' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('unsolved')}
          >
            Unsolved
          </button>
          <button
            type="button"
            aria-pressed={filterMode === 'hints'}
            className={`filter-pill ${filterMode === 'hints' ? 'is-active' : ''}`}
            onClick={() => setFilterMode('hints')}
          >
            Has Hints (H)
          </button>
        </div>
      </search>

      {sections.length === 0 ? (
        <div className="empty-state-card">
          <h2>No {meta.label} sections loaded yet</h2>
          <p>
            The {meta.label} problem curriculum is empty or being initialized. Switch tracks above or refresh shortly.
          </p>
        </div>
      ) : filteredSections.length === 0 ? (
        <div className="empty-state-card">
          <h2>No matching sections or problems</h2>
          <p>
            No {meta.label} problems matched <code>{query}</code> with the selected filter.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setQuery('');
              setFilterMode('all');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="section-cards-grid">
          {filteredSections.map(({ section, matchingProblems }) => {
            const stats = computeSectionStarStats(section, store);
            const [minDiff, maxDiff] = section.difficultyRange;
            const completionRatio =
              stats.totalProblems > 0
                ? Math.round((stats.solvedCount / stats.totalProblems) * 100)
                : 0;

            return (
              <article key={section.id} className="section-card">
                <div className="section-card-top">
                  <div className="section-card-heading-group">
                    <h2 className="section-card-title">
                      <a href={buildSectionHref(language, section.id)}>
                        {section.title}
                      </a>
                    </h2>
                    <StarRating
                      solvedCount={stats.solvedCount}
                      totalProblems={stats.totalProblems}
                    />
                  </div>
                  <span
                    className="difficulty-pill"
                    aria-label={`Difficulty rating ${minDiff} to ${maxDiff}`}
                  >
                    {minDiff}–{maxDiff}
                  </span>
                </div>

                <p className="section-card-desc">{section.description}</p>

                <div className="section-progress-row">
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{ '--progress-pct': `${completionRatio}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="section-count-label">
                    {stats.solvedCount} / {stats.totalProblems} solved
                  </span>
                </div>

                <ul className="problem-pill-list" aria-label={`${section.title} problems`}>
                  {matchingProblems.map((problem) => {
                    const isSolved = Boolean(store.problems[problem.id]?.solved);
                    const hasHints = problem.hints.length > 0;

                    return (
                      <li key={problem.id}>
                        <a
                          href={buildProblemHref(language, section.id, problem.slug)}
                          className={`problem-pill ${isSolved ? 'is-solved' : ''}`.trim()}
                        >
                          {isSolved && (
                            <>
                              <Check
                                size={13}
                                aria-hidden="true"
                                focusable="false"
                                className="solved-check-icon"
                              />
                              <span className="sr-only">Solved: </span>
                            </>
                          )}
                          <span className="problem-pill-title">{problem.title}</span>
                          {hasHints && (
                            <span
                              className="hint-badge"
                              aria-label="Hints available"
                            >
                              H
                            </span>
                          )}
                        </a>
                      </li>
                    );
                  })}
                </ul>

                <div className="section-card-footer">
                  <a
                    href={buildSectionHref(language, section.id)}
                    className="section-detail-link"
                  >
                    <span>Open section view</span>
                    <ArrowRight size={13} aria-hidden="true" focusable="false" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
