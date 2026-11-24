import { useCallback, useEffect, useState } from 'react';
import { getSectionsForLanguage } from '../curriculum';
import type {
  CobolFormatMode,
  LanguageId,
  ProblemProgressEntry,
  SectionSpec,
  UserProgressStore,
} from '../types/schema';

export const PROGRESS_STORAGE_KEY = 'codebyhand.progress.v1';

export function createDefaultProgressStore(
  selectedLanguage: LanguageId = 'js'
): UserProgressStore {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    selectedLanguage,
    problems: {},
  };
}

function isValidLanguage(val: unknown): val is LanguageId {
  return val === 'js' || val === 'rust' || val === 'cobol';
}

function isValidCobolFormat(val: unknown): val is CobolFormatMode {
  return val === 'free' || val === 'fixed';
}

function sanitizeProblemEntry(raw: unknown): ProblemProgressEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.solved !== 'boolean') {
    return null;
  }

  const entry: ProblemProgressEntry = {
    solved: obj.solved,
  };

  if (typeof obj.solvedAt === 'string' && obj.solvedAt.length > 0) {
    entry.solvedAt = obj.solvedAt;
  }
  if (typeof obj.savedCode === 'string') {
    entry.savedCode = obj.savedCode;
  }
  if (isValidCobolFormat(obj.cobolFormat)) {
    entry.cobolFormat = obj.cobolFormat;
  }
  if (typeof obj.hintsViewedCount === 'number' && Number.isFinite(obj.hintsViewedCount)) {
    entry.hintsViewedCount = Math.max(0, Math.floor(obj.hintsViewedCount));
  }
  if (typeof obj.solutionViewedPreSolve === 'boolean') {
    entry.solutionViewedPreSolve = obj.solutionViewedPreSolve;
  }
  if (typeof obj.solutionViewedPostSolve === 'boolean') {
    entry.solutionViewedPostSolve = obj.solutionViewedPostSolve;
  }
  if (typeof obj.attempts === 'number' && Number.isFinite(obj.attempts)) {
    entry.attempts = Math.max(0, Math.floor(obj.attempts));
  }

  return entry;
}

export function parseProgressStoreJson(
  rawText: string
):
  | { ok: true; store: UserProgressStore; problemCount: number }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax. Please check the pasted text or uploaded file.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Root JSON value must be an object matching UserProgressStore.' };
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) {
    return {
      ok: false,
      error: `Unsupported progress schema version "${String(obj.version ?? 'missing')}". Expected version: 1.`,
    };
  }

  if (!obj.problems || typeof obj.problems !== 'object' || Array.isArray(obj.problems)) {
    return { ok: false, error: 'Missing or invalid "problems" map in progress JSON.' };
  }

  const rawProblems = obj.problems as Record<string, unknown>;
  const sanitizedProblems: Record<string, ProblemProgressEntry> = {};
  let count = 0;

  for (const [problemId, rawEntry] of Object.entries(rawProblems)) {
    if (!problemId.trim()) continue;
    const sanitized = sanitizeProblemEntry(rawEntry);
    if (!sanitized) {
      return {
        ok: false,
        error: `Invalid progress entry for problem "${problemId}" (boolean "solved" field required).`,
      };
    }
    sanitizedProblems[problemId] = sanitized;
    count += 1;
  }

  const selectedLanguage: LanguageId = isValidLanguage(obj.selectedLanguage)
    ? obj.selectedLanguage
    : 'js';

  const updatedAt =
    typeof obj.updatedAt === 'string' && obj.updatedAt.length > 0
      ? obj.updatedAt
      : new Date().toISOString();

  return {
    ok: true,
    store: {
      version: 1,
      updatedAt,
      selectedLanguage,
      problems: sanitizedProblems,
    },
    problemCount: count,
  };
}

export function loadProgressStore(): UserProgressStore {
  if (typeof window === 'undefined') {
    return createDefaultProgressStore();
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) {
      return createDefaultProgressStore();
    }
    const parsed = parseProgressStoreJson(raw);
    return parsed.ok ? parsed.store : createDefaultProgressStore();
  } catch {
    return createDefaultProgressStore();
  }
}

export function persistProgressStore(store: UserProgressStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export interface SectionStarStats {
  solvedCount: number;
  totalProblems: number;
  earnedStars: number;
  totalStarSlots: number;
}

/**
 * Gold Star Slots rule:
 * 1 gold star earned per 3 solved problems in that section:
 * totalStarSlots = Math.max(1, Math.floor(section.problems.length / 3))
 * earnedStars = Math.min(totalStarSlots, Math.floor(solvedInSection / 3))
 */
export function computeSectionStarStats(
  section: SectionSpec,
  store: UserProgressStore
): SectionStarStats {
  const totalProblems = section.problems.length;
  const solvedCount = section.problems.reduce(
    (acc, problem) => acc + (store.problems[problem.id]?.solved ? 1 : 0),
    0
  );
  const totalStarSlots =
    totalProblems === 0 ? 0 : Math.max(1, Math.floor(totalProblems / 3));
  const earnedStars = Math.min(totalStarSlots, Math.floor(solvedCount / 3));

  return {
    solvedCount,
    totalProblems,
    earnedStars,
    totalStarSlots,
  };
}

export interface LanguageProgressStats {
  language: LanguageId;
  solvedProblems: number;
  totalProblems: number;
  earnedStars: number;
  totalStarSlots: number;
}

export function computeLanguageStats(
  language: LanguageId,
  store: UserProgressStore
): LanguageProgressStats {
  const sections = getSectionsForLanguage(language);
  let solvedProblems = 0;
  let totalProblems = 0;
  let earnedStars = 0;
  let totalStarSlots = 0;

  for (const section of sections) {
    const stats = computeSectionStarStats(section, store);
    solvedProblems += stats.solvedCount;
    totalProblems += stats.totalProblems;
    earnedStars += stats.earnedStars;
    totalStarSlots += stats.totalStarSlots;
  }

  return {
    language,
    solvedProblems,
    totalProblems,
    earnedStars,
    totalStarSlots,
  };
}

export function computeGlobalStats(store: UserProgressStore): {
  solvedProblems: number;
  totalProblems: number;
  earnedStars: number;
  totalStarSlots: number;
  byLanguage: Record<LanguageId, LanguageProgressStats>;
} {
  const js = computeLanguageStats('js', store);
  const rust = computeLanguageStats('rust', store);
  const cobol = computeLanguageStats('cobol', store);

  return {
    solvedProblems: js.solvedProblems + rust.solvedProblems + cobol.solvedProblems,
    totalProblems: js.totalProblems + rust.totalProblems + cobol.totalProblems,
    earnedStars: js.earnedStars + rust.earnedStars + cobol.earnedStars,
    totalStarSlots: js.totalStarSlots + rust.totalStarSlots + cobol.totalStarSlots,
    byLanguage: { js, rust, cobol },
  };
}

export function mergeProgressStores(
  current: UserProgressStore,
  incoming: UserProgressStore
): UserProgressStore {
  const mergedProblems: Record<string, ProblemProgressEntry> = {
    ...current.problems,
  };

  for (const [id, inc] of Object.entries(incoming.problems)) {
    const cur = mergedProblems[id];
    if (!cur) {
      mergedProblems[id] = { ...inc };
      continue;
    }
    const solved = cur.solved || inc.solved;
    const solvedAt =
      cur.solvedAt && inc.solvedAt
        ? cur.solvedAt < inc.solvedAt
          ? cur.solvedAt
          : inc.solvedAt
        : cur.solvedAt ?? inc.solvedAt;

    mergedProblems[id] = {
      solved,
      solvedAt,
      savedCode: inc.savedCode ?? cur.savedCode,
      cobolFormat: inc.cobolFormat ?? cur.cobolFormat,
      hintsViewedCount: Math.max(cur.hintsViewedCount ?? 0, inc.hintsViewedCount ?? 0) || undefined,
      solutionViewedPreSolve: Boolean(cur.solutionViewedPreSolve || inc.solutionViewedPreSolve) || undefined,
      solutionViewedPostSolve: Boolean(cur.solutionViewedPostSolve || inc.solutionViewedPostSolve) || undefined,
      attempts: Math.max(cur.attempts ?? 0, inc.attempts ?? 0) || undefined,
    };
  }

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    selectedLanguage: incoming.selectedLanguage ?? current.selectedLanguage,
    problems: mergedProblems,
  };
}

export function useProgressStore() {
  const [store, setStore] = useState<UserProgressStore>(() => loadProgressStore());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROGRESS_STORAGE_KEY) {
        setStore(loadProgressStore());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateStore = useCallback(
    (updater: (prev: UserProgressStore) => UserProgressStore) => {
      setStore((prev) => {
        const next = updater(prev);
        persistProgressStore(next);
        return next;
      });
    },
    []
  );

  const setSelectedLanguage = useCallback(
    (language: LanguageId) => {
      updateStore((prev) => {
        if (prev.selectedLanguage === language) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          selectedLanguage: language,
        };
      });
    },
    [updateStore]
  );

  const saveDraftCode = useCallback(
    (problemId: string, savedCode: string, cobolFormat?: CobolFormatMode) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId] ?? { solved: false };
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: {
              ...existing,
              savedCode,
              ...(cobolFormat ? { cobolFormat } : {}),
            },
          },
        };
      });
    },
    [updateStore]
  );

  const setProblemCobolFormat = useCallback(
    (problemId: string, cobolFormat: CobolFormatMode, convertedCode: string) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId] ?? { solved: false };
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: {
              ...existing,
              cobolFormat,
              savedCode: convertedCode,
            },
          },
        };
      });
    },
    [updateStore]
  );

  const recordAttemptResult = useCallback(
    (
      problemId: string,
      allPassed: boolean,
      userCode: string,
      cobolFormat?: CobolFormatMode
    ) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId] ?? { solved: false };
        const solved = existing.solved || allPassed;
        const solvedAt = solved
          ? existing.solvedAt ?? new Date().toISOString()
          : existing.solvedAt;

        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: {
              ...existing,
              solved,
              solvedAt,
              savedCode: userCode,
              ...(cobolFormat ? { cobolFormat } : {}),
              attempts: (existing.attempts ?? 0) + 1,
            },
          },
        };
      });
    },
    [updateStore]
  );

  const recordHintViewed = useCallback(
    (problemId: string, viewedCount: number) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId] ?? { solved: false };
        const nextCount = Math.max(existing.hintsViewedCount ?? 0, viewedCount);
        if (nextCount === (existing.hintsViewedCount ?? 0)) {
          return prev;
        }
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: {
              ...existing,
              hintsViewedCount: nextCount,
            },
          },
        };
      });
    },
    [updateStore]
  );

  const recordSolutionViewed = useCallback(
    (problemId: string, isSolved: boolean) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId] ?? { solved: false };
        const nextEntry: ProblemProgressEntry = {
          ...existing,
          ...(isSolved
            ? { solutionViewedPostSolve: true }
            : { solutionViewedPreSolve: true }),
        };
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: nextEntry,
          },
        };
      });
    },
    [updateStore]
  );

  const resetProblemDraft = useCallback(
    (problemId: string, starterCode: string, cobolFormat?: CobolFormatMode) => {
      updateStore((prev) => {
        const existing = prev.problems[problemId];
        if (!existing) return prev;
        return {
          ...prev,
          updatedAt: new Date().toISOString(),
          problems: {
            ...prev.problems,
            [problemId]: {
              ...existing,
              savedCode: starterCode,
              ...(cobolFormat ? { cobolFormat } : {}),
            },
          },
        };
      });
    },
    [updateStore]
  );

  const importProgress = useCallback(
    (incoming: UserProgressStore, mode: 'merge' | 'replace' = 'merge') => {
      updateStore((prev) =>
        mode === 'replace'
          ? { ...incoming, updatedAt: new Date().toISOString() }
          : mergeProgressStores(prev, incoming)
      );
    },
    [updateStore]
  );

  const resetAllProgress = useCallback(() => {
    updateStore((prev) => createDefaultProgressStore(prev.selectedLanguage));
  }, [updateStore]);

  return {
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
  };
}
