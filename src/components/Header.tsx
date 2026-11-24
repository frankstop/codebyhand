import React from 'react';
import { Award, CheckCircle2, Code2, Star } from 'lucide-react';
import { LANGUAGE_METADATA } from '../curriculum';
import type { LanguageId, UserProgressStore } from '../types/schema';
import { computeGlobalStats } from '../utils/progressStore';
import {
  type AppRoute,
  buildDoneHref,
  buildLanguageHref,
} from '../utils/router';

export interface HeaderProps {
  route: AppRoute;
  store: UserProgressStore;
  onSelectLanguage: (lang: LanguageId) => void;
}

const LANGUAGE_ORDER: LanguageId[] = ['js', 'rust', 'cobol'];

export const Header: React.FC<HeaderProps> = ({
  route,
  store,
  onSelectLanguage,
}) => {
  const globalStats = computeGlobalStats(store);
  const activeLanguage: LanguageId | null =
    route.view === 'done' ? null : route.language;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          href={buildLanguageHref(activeLanguage ?? store.selectedLanguage)}
          className="brand-link"
        >
          <span className="brand-mark" aria-hidden="true">
            <Code2 size={18} aria-hidden="true" focusable="false" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">CodeByHand</span>
            <span className="brand-tagline">zero-setup coding practice</span>
          </span>
        </a>

        <nav aria-label="Language tracks" className="language-nav">
          <ul className="language-tabs">
            {LANGUAGE_ORDER.map((lang) => {
              const meta = LANGUAGE_METADATA[lang];
              const langStats = globalStats.byLanguage[lang];
              const isCurrentTrack = activeLanguage === lang;
              const isCurrentHubPage = route.view === 'hub' && route.language === lang;

              return (
                <li key={lang}>
                  <a
                    href={buildLanguageHref(lang)}
                    aria-current={isCurrentHubPage ? 'page' : undefined}
                    className={`language-tab ${isCurrentTrack ? 'is-active' : ''}`.trim()}
                    onClick={() => onSelectLanguage(lang)}
                  >
                    <span className="language-tab-label">{meta.label}</span>
                    <span className="language-tab-count">
                      {langStats.solvedProblems}/{langStats.totalProblems}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="header-utilities">
          <div
            className="global-score-cluster"
            aria-label={`${globalStats.earnedStars} gold stars earned and ${globalStats.solvedProblems} of ${globalStats.totalProblems} problems solved`}
          >
            <span className="score-chip is-gold">
              <Star
                size={14}
                aria-hidden="true"
                focusable="false"
                className="star-icon is-earned"
              />
              <span>{globalStats.earnedStars}</span>
            </span>
            <span className="score-chip is-solved">
              <CheckCircle2 size={14} aria-hidden="true" focusable="false" />
              <span>
                {globalStats.solvedProblems}/{globalStats.totalProblems}
              </span>
            </span>
          </div>

          <a
            href={buildDoneHref()}
            aria-current={route.view === 'done' ? 'page' : undefined}
            className={`done-nav-link ${route.view === 'done' ? 'is-active' : ''}`.trim()}
          >
            <Award size={15} aria-hidden="true" focusable="false" />
            <span>Done / Progress</span>
          </a>
        </div>
      </div>
    </header>
  );
};
