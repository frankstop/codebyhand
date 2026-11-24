import React, { useEffect } from 'react';
import { getProblem, getSection, LANGUAGE_METADATA } from './curriculum';
import { DoneProgressView } from './components/DoneProgressView';
import { Header } from './components/Header';
import { LanguageHubView } from './components/LanguageHubView';
import { ProblemWorkspaceView } from './components/ProblemWorkspaceView';
import { SectionDetailView } from './components/SectionDetailView';
import { useProgressStore } from './utils/progressStore';
import { useAppRoute } from './utils/router';

export const App: React.FC = () => {
  const {
    store,
    setSelectedLanguage,
    saveDraftCode,
    setProblemCobolFormat,
    recordAttemptResult,
    recordHintViewed,
    recordSolutionViewed,
    resetProblemDraft,
    importProgress,
    resetAllProgress,
  } = useProgressStore();

  const { route } = useAppRoute(store.selectedLanguage);

  // Keep selectedLanguage synced when navigating directly via URL
  useEffect(() => {
    if (route.view !== 'done' && route.language !== store.selectedLanguage) {
      setSelectedLanguage(route.language);
    }
  }, [route, store.selectedLanguage, setSelectedLanguage]);

  // Keep document title crisp and descriptive
  useEffect(() => {
    if (route.view === 'done') {
      document.title = 'Done & Progress — CodeByHand';
      return;
    }
    const langLabel = LANGUAGE_METADATA[route.language].label;
    if (route.view === 'hub') {
      document.title = `${langLabel} Practice — CodeByHand`;
      return;
    }
    if (route.view === 'section') {
      const sec = getSection(route.language, route.sectionId);
      document.title = `${sec?.title ?? route.sectionId} (${langLabel}) — CodeByHand`;
      return;
    }
    if (route.view === 'problem') {
      const prob = getProblem(route.language, route.sectionId, route.problemSlug);
      document.title = `${prob?.title ?? route.problemSlug} · ${langLabel} — CodeByHand`;
    }
  }, [route]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Header
        route={route}
        store={store}
        onSelectLanguage={setSelectedLanguage}
      />

      <main id="main-content" className="app-main">
        {route.view === 'hub' && (
          <LanguageHubView language={route.language} store={store} />
        )}

        {route.view === 'section' && (
          <SectionDetailView
            language={route.language}
            sectionId={route.sectionId}
            store={store}
          />
        )}

        {route.view === 'problem' && (
          <ProblemWorkspaceView
            language={route.language}
            sectionId={route.sectionId}
            problemSlug={route.problemSlug}
            store={store}
            onSaveDraft={saveDraftCode}
            onCobolFormatChange={setProblemCobolFormat}
            onRecordAttempt={recordAttemptResult}
            onRecordHintViewed={recordHintViewed}
            onRecordSolutionViewed={recordSolutionViewed}
            onResetDraft={resetProblemDraft}
          />
        )}

        {route.view === 'done' && (
          <DoneProgressView
            store={store}
            onImportProgress={importProgress}
            onResetAllProgress={resetAllProgress}
          />
        )}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span>
            <strong>CodeByHand</strong> — Deliberate practice for JavaScript, Rust &amp; COBOL.
          </span>
          <span>
            Earn 1 <span className="gold-star-inline" aria-hidden="true">★</span> gold star per 3 solved problems · Progress stored locally in browser.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
