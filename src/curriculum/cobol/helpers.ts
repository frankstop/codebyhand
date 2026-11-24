import type { HintItem, ProblemSpec, TestCase } from '../../types/schema';

/**
 * Converts a clean Free-Format COBOL program (lines <= 64 chars, Area A items
 * at col 0 and Area B items indented by 4 spaces) into authentic Fixed-Format
 * COBOL (columns 7-72) so learners toggling Fixed-Format get clean Col 7/8/12 code.
 */
export function toFixedFormat(freeCode: string): string {
  return freeCode
    .split('\n')
    .map((line) => {
      if (line.trim().length === 0) {
        return '';
      }
      const trimmed = line.trimStart();
      if (trimmed.startsWith('*>')) {
        const commentText = trimmed.slice(2);
        return `      *${commentText}`;
      }
      return `       ${line}`;
    })
    .join('\n');
}

export function cobolTest(
  progName: string,
  inputs: string[],
  expectedStdout: string,
  hidden = false
): TestCase {
  const callArgs = inputs.map((val) => JSON.stringify(val)).join(', ');
  return {
    call: `${progName}(${callArgs})`,
    expectedDisplay: JSON.stringify(expectedStdout),
    stdin: `${inputs.join('\n')}\n`,
    expectedStdout,
    ...(hidden ? { hidden: true } : {}),
  };
}

export interface CobolProblemInput {
  sectionId: string;
  slug: string;
  functionName: string;
  difficulty: number;
  doc: string;
  note?: string;
  starterCode: string;
  hints: HintItem[];
  showsolution: boolean;
  showpost: boolean;
  solution: string;
  tests: TestCase[];
}

export function makeCobolProblem(input: CobolProblemInput): ProblemSpec {
  return {
    id: `cobol-${input.sectionId}-${input.slug}`,
    slug: input.slug,
    language: 'cobol',
    sectionId: input.sectionId,
    title: input.functionName,
    difficulty: input.difficulty,
    doc: input.doc,
    ...(input.note ? { note: input.note } : {}),
    functionName: input.functionName,
    starterCode: input.starterCode,
    starterCodeFixed: toFixedFormat(input.starterCode),
    hints: input.hints,
    showsolution: input.showsolution,
    showpost: input.showpost,
    solution: input.solution,
    tests: input.tests,
  };
}
