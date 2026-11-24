import type { LanguageId, ProblemSpec, SectionSpec } from '../types/schema';
import { jsSections } from './js';
import { rustSections } from './rust';
import { cobolSections } from './cobol';

export { jsSections, rustSections, cobolSections };

export const CURRICULUM_BY_LANGUAGE: Record<LanguageId, SectionSpec[]> = {
  js: jsSections,
  rust: rustSections,
  cobol: cobolSections,
};

export const LANGUAGE_METADATA: Record<
  LanguageId,
  { id: LanguageId; label: string; badge: string; tagline: string }
> = {
  js: {
    id: 'js',
    label: 'JavaScript',
    badge: 'ES2023',
    tagline: 'Functions, closures, arrays, Maps, functional pipelines & recursion.',
  },
  rust: {
    id: 'rust',
    label: 'Rust',
    badge: 'Edition 2021',
    tagline: 'Ownership, slices, Option/Result, HashMaps, iterators & pattern matching.',
  },
  cobol: {
    id: 'cobol',
    label: 'COBOL',
    badge: 'GnuCOBOL 3.2',
    tagline: 'Fixed-point PIC decimals, edited currency masks, INSPECT, OCCURS tables & business rules.',
  },
};

export function getSectionsForLanguage(language: LanguageId): SectionSpec[] {
  return CURRICULUM_BY_LANGUAGE[language] ?? [];
}

export function getSection(language: LanguageId, sectionId: string): SectionSpec | undefined {
  return getSectionsForLanguage(language).find((s) => s.id === sectionId);
}

export function getProblem(
  language: LanguageId,
  sectionId: string,
  problemSlug: string
): ProblemSpec | undefined {
  const section = getSection(language, sectionId);
  return section?.problems.find((p) => p.slug === problemSlug || p.id === problemSlug);
}

export function getAllProblems(language?: LanguageId): ProblemSpec[] {
  if (language) {
    return getSectionsForLanguage(language).flatMap((s) => s.problems);
  }
  return (['js', 'rust', 'cobol'] as LanguageId[]).flatMap((lang) =>
    getSectionsForLanguage(lang).flatMap((s) => s.problems)
  );
}
