import { useCallback, useEffect, useState } from 'react';
import type { LanguageId } from '../types/schema';

export type AppRoute =
  | { view: 'hub'; language: LanguageId }
  | { view: 'section'; language: LanguageId; sectionId: string }
  | { view: 'problem'; language: LanguageId; sectionId: string; problemSlug: string }
  | { view: 'done' };

const VALID_LANGUAGES = new Set<string>(['js', 'rust', 'cobol']);

export function isLanguageId(value: string | undefined): value is LanguageId {
  return Boolean(value && VALID_LANGUAGES.has(value));
}

export function buildLanguageHref(language: LanguageId): string {
  return `#/${language}`;
}

export function buildSectionHref(language: LanguageId, sectionId: string): string {
  return `#/${language}/${encodeURIComponent(sectionId)}`;
}

export function buildProblemHref(
  language: LanguageId,
  sectionId: string,
  problemSlug: string
): string {
  return `#/${language}/${encodeURIComponent(sectionId)}/${encodeURIComponent(problemSlug)}`;
}

export function buildDoneHref(): string {
  return '#/done';
}

export function parseRouteFromLocation(
  hash: string,
  pathname = '/',
  fallbackLanguage: LanguageId = 'js'
): AppRoute {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const sourcePath = rawHash.trim() !== '' ? rawHash : pathname;
  const cleaned = sourcePath.replace(/^\/+|\/+$/g, '');

  if (!cleaned) {
    return { view: 'hub', language: fallbackLanguage };
  }

  const segments = cleaned
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });

  if (segments.length === 0) {
    return { view: 'hub', language: fallbackLanguage };
  }

  const [first, second, third] = segments;

  if (first.toLowerCase() === 'done' || first.toLowerCase() === 'progress') {
    return { view: 'done' };
  }

  const normalizedFirst =
    first.toLowerCase() === 'javascript' ? 'js' : first.toLowerCase();

  if (isLanguageId(normalizedFirst)) {
    if (second && third) {
      return {
        view: 'problem',
        language: normalizedFirst,
        sectionId: second,
        problemSlug: third,
      };
    }
    if (second) {
      return {
        view: 'section',
        language: normalizedFirst,
        sectionId: second,
      };
    }
    return {
      view: 'hub',
      language: normalizedFirst,
    };
  }

  return { view: 'hub', language: fallbackLanguage };
}

export function routeToCanonicalHash(route: AppRoute): string {
  switch (route.view) {
    case 'done':
      return buildDoneHref();
    case 'hub':
      return buildLanguageHref(route.language);
    case 'section':
      return buildSectionHref(route.language, route.sectionId);
    case 'problem':
      return buildProblemHref(route.language, route.sectionId, route.problemSlug);
  }
}

export function navigateTo(href: string): void {
  if (typeof window === 'undefined') return;
  const targetHash = href.startsWith('#') ? href : `#${href.startsWith('/') ? href : `/${href}`}`;
  if (window.location.hash === targetHash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = targetHash;
}

export function useAppRoute(defaultLanguage: LanguageId = 'js'): {
  route: AppRoute;
  navigate: (href: string) => void;
} {
  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') {
      return { view: 'hub', language: defaultLanguage };
    }
    return parseRouteFromLocation(
      window.location.hash,
      window.location.pathname,
      defaultLanguage
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Normalize bare `/` or path-only visits to canonical hash URL without pushing extra history entry
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      const initialRoute = parseRouteFromLocation(
        window.location.hash,
        window.location.pathname,
        defaultLanguage
      );
      const canonical = routeToCanonicalHash(initialRoute);
      window.history.replaceState(null, '', canonical);
      setRoute(initialRoute);
    }

    const syncFromWindow = () => {
      const next = parseRouteFromLocation(
        window.location.hash,
        window.location.pathname,
        defaultLanguage
      );
      setRoute(next);
    };

    window.addEventListener('hashchange', syncFromWindow);
    window.addEventListener('popstate', syncFromWindow);
    return () => {
      window.removeEventListener('hashchange', syncFromWindow);
      window.removeEventListener('popstate', syncFromWindow);
    };
  }, [defaultLanguage]);

  const navigate = useCallback((href: string) => {
    navigateTo(href);
  }, []);

  return { route, navigate };
}
