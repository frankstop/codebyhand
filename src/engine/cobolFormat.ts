import type { CobolFormatMode } from '../types/schema';

const SEQ_AREA = '      '; // Columns 1-6 (6 spaces)
const AREA_A_PREFIX = '       '; // Columns 1-7 (6 spaces + space indicator -> starts at col 8)
const AREA_B_PREFIX = '           '; // Columns 1-11 (starts at col 12)
const COMMENT_PREFIX = '      *'; // Columns 1-6 spaces + '*' in col 7
const CONTINUATION_PREFIX = '      -    '; // '-' in col 7 + spaces to col 12
const FIXED_MAX_COL = 72;

const NON_PARAGRAPH_SINGLE_WORDS = new Set([
  'CONTINUE',
  'ELSE',
  'END-ADD',
  'END-CALL',
  'END-COMPUTE',
  'END-DELETE',
  'END-DIVIDE',
  'END-EVALUATE',
  'END-IF',
  'END-MULTIPLY',
  'END-PERFORM',
  'END-READ',
  'END-RETURN',
  'END-REWRITE',
  'END-SEARCH',
  'END-START',
  'END-STRING',
  'END-SUBTRACT',
  'END-UNSTRING',
  'END-WRITE',
  'EXIT',
  'GOBACK',
  'OTHERWISE',
  'RETURN',
]);

/**
 * Automatically detects whether COBOL source code is written in Free-Format or Fixed-Format.
 */
export function detectCobolFormat(code: string): CobolFormatMode {
  const normalized = code.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  for (const rawLine of lines) {
    const directiveMatch = rawLine.match(
      />>\s*SOURCE\s+(?:FORMAT\s+)?(?:IS\s+)?(FREE|FIXED)\b/i
    );
    if (directiveMatch) {
      return directiveMatch[1].toUpperCase() === 'FIXED' ? 'fixed' : 'free';
    }
  }

  let fixedMatches = 0;
  let freeViolations = 0;

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    // Free-format inline/leading '*>' comment in cols 1-6
    const firstNonSpace = line.search(/\S/);
    if (firstNonSpace >= 0 && firstNonSpace < 6 && line.slice(firstNonSpace).startsWith('*>')) {
      return 'free';
    }

    if (line.length < 7) {
      // A non-empty line shorter than 7 chars cannot have anything in Area A/B unless it's just sequence digits
      if (!/^[0-9 ]+$/.test(line)) {
        freeViolations++;
      }
      continue;
    }

    const seq = line.slice(0, 6);
    const indicator = line[6];
    const validSeq = /^[0-9 ]{6}$/.test(seq);
    const validIndicator =
      indicator === ' ' ||
      indicator === '*' ||
      indicator === '/' ||
      indicator === '-' ||
      indicator === 'D' ||
      indicator === 'd';

    if (validSeq && validIndicator) {
      fixedMatches++;
    } else {
      freeViolations++;
    }
  }

  if (freeViolations === 0 && fixedMatches > 0) {
    return 'fixed';
  }
  return 'free';
}

/**
 * Converts Free-Format COBOL source into standard ANSI Fixed-Format COBOL
 * (Cols 1-6 sequence spaces, Col 7 indicator, Cols 8-11 Area A, Cols 12-72 Area B).
 */
export function freeToFixedCobol(code: string): string {
  const normalized = code.replace(/\r\n/g, '\n');
  if (
    detectCobolFormat(normalized) === 'fixed' &&
    !/>>\s*SOURCE\s+(?:FORMAT\s+)?(?:IS\s+)?FREE\b/i.test(normalized)
  ) {
    return normalized;
  }

  const lines = normalized.split('\n');
  const out: string[] = [];
  let currentDivision: 'OTHER' | 'DATA' | 'PROCEDURE' = 'OTHER';

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      out.push('');
      continue;
    }

    // Strip >>SOURCE FORMAT directives since compiler flag -fixed controls mode
    if (/^>>\s*SOURCE\s+(?:FORMAT\s+)?(?:IS\s+)?(FREE|FIXED)\b/i.test(trimmed)) {
      continue;
    }

    // Full-line comment (*> or *)
    if (trimmed.startsWith('*>') || trimmed.startsWith('*')) {
      const commentBody = trimmed.startsWith('*>')
        ? trimmed.slice(2).trimStart()
        : trimmed.slice(1).trimStart();
      pushWrappedComment(out, commentBody);
      continue;
    }

    // Split any trailing inline '*>' comment outside string literals
    const { codePart, inlineComment } = splitInlineCobolComment(rawLine);
    if (inlineComment !== null && inlineComment.length > 0) {
      pushWrappedComment(out, inlineComment);
    }

    const cleanTrimmed = codePart.trim();
    if (cleanTrimmed.length === 0) {
      continue;
    }

    const upper = cleanTrimmed.toUpperCase();
    if (/^(IDENTIFICATION|ID|ENVIRONMENT)\s+DIVISION\b/.test(upper)) {
      currentDivision = 'OTHER';
    } else if (/^DATA\s+DIVISION\b/.test(upper)) {
      currentDivision = 'DATA';
    } else if (/^PROCEDURE\s+DIVISION\b/.test(upper)) {
      currentDivision = 'PROCEDURE';
    }

    const inAreaA = isAreaALine(cleanTrimmed, upper, currentDivision);
    if (inAreaA) {
      pushWrappedCodeLine(out, AREA_A_PREFIX, cleanTrimmed);
    } else {
      // Preserve modest indentation inside Area B if it came indented beyond 4 spaces and fits <= 72 cols
      const leadingSpaces = codePart.match(/^ */)?.[0].length ?? 0;
      const extraIndentCount = Math.min(Math.max(0, leadingSpaces - 4), 8);
      const extraIndent = ' '.repeat(extraIndentCount);
      if (AREA_B_PREFIX.length + extraIndent.length + cleanTrimmed.length <= FIXED_MAX_COL) {
        out.push(`${AREA_B_PREFIX}${extraIndent}${cleanTrimmed}`);
      } else {
        pushWrappedCodeLine(out, AREA_B_PREFIX, cleanTrimmed);
      }
    }
  }

  return out.join('\n');
}

/**
 * Converts Fixed-Format COBOL source into clean, idiomatic Free-Format COBOL.
 */
export function fixedToFreeCobol(code: string): string {
  const normalized = code.replace(/\r\n/g, '\n');
  if (
    detectCobolFormat(normalized) === 'free' &&
    !/>>\s*SOURCE\s+(?:FORMAT\s+)?(?:IS\s+)?FIXED\b/i.test(normalized)
  ) {
    return normalized;
  }

  const lines = normalized.split('\n');
  const out: string[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim().length === 0) {
      out.push('');
      continue;
    }

    if (/^\s*>>\s*SOURCE\s+(?:FORMAT\s+)?(?:IS\s+)?(FREE|FIXED)\b/i.test(rawLine)) {
      continue;
    }

    if (rawLine.length < 7) {
      if (/^[0-9 ]+$/.test(rawLine)) {
        out.push('');
      } else {
        out.push(rawLine.trimEnd());
      }
      continue;
    }

    const indicator = rawLine[6];

    // Comment line in fixed format ('*' or '/' in col 7)
    if (indicator === '*' || indicator === '/') {
      const commentText = rawLine.slice(7).trimEnd().trimStart();
      out.push(commentText.length > 0 ? `*> ${commentText}` : '*>');
      continue;
    }

    // Extract columns 8..72 for fixed-format code/continuation lines
    const codeSlice =
      rawLine.length > FIXED_MAX_COL && isLikelyIdentArea(rawLine.slice(FIXED_MAX_COL))
        ? rawLine.slice(7, FIXED_MAX_COL).trimEnd()
        : rawLine.slice(7, FIXED_MAX_COL).trimEnd();

    // Continuation line ('-' in col 7)
    if (indicator === '-') {
      const contTrimmed = codeSlice.trimStart();
      if (out.length > 0) {
        const prev = out[out.length - 1];
        const openQuote = findUnclosedQuote(prev);
        if (
          openQuote &&
          (contTrimmed.startsWith('"') || contTrimmed.startsWith("'"))
        ) {
          out[out.length - 1] = prev + contTrimmed.slice(1);
        } else {
          out[out.length - 1] = `${prev} ${contTrimmed}`;
        }
      } else {
        out.push(`    ${contTrimmed}`);
      }
      continue;
    }

    // Normal or debug code line: col 8 -> col 1 (0 spaces), col 12 -> 4 spaces
    out.push(codeSlice);
  }

  return out.join('\n');
}

function isAreaALine(
  trimmed: string,
  upper: string,
  currentDivision: 'OTHER' | 'DATA' | 'PROCEDURE'
): boolean {
  // Divisions
  if (/^(IDENTIFICATION|ID|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION\b/.test(upper)) {
    return true;
  }

  // Standard Identification/Environment headers
  if (
    /^(PROGRAM-ID|AUTHOR|INSTALLATION|DATE-WRITTEN|DATE-COMPILED|SECURITY|SOURCE-COMPUTER|OBJECT-COMPUTER|SPECIAL-NAMES|FILE-CONTROL|I-O-CONTROL|REPOSITORY)\b/.test(
      upper
    )
  ) {
    return true;
  }

  // Sections (e.g. WORKING-STORAGE SECTION., MAIN-LOGIC SECTION.)
  if (/^[A-Z0-9][A-Z0-9-]*\s+SECTION\s*\.?$/.test(upper)) {
    return true;
  }

  // File / Report / Sort descriptions and top-level data items (01, 1, 77)
  if (/^(FD|SD|RD|CD)\b/.test(upper)) {
    return true;
  }
  if (/^(0?1|77)(\s+|\.$)/.test(upper)) {
    return true;
  }

  // Declaratives & End Program
  if (/^(DECLARATIVES|END\s+DECLARATIVES|END\s+PROGRAM)\b/.test(upper)) {
    return true;
  }

  // Paragraph names in PROCEDURE DIVISION: single COBOL identifier followed by period
  if (currentDivision === 'PROCEDURE') {
    const paraMatch = upper.match(/^([A-Z0-9][A-Z0-9-]*)\s*\.$/);
    if (paraMatch && !NON_PARAGRAPH_SINGLE_WORDS.has(paraMatch[1])) {
      return true;
    }
  }

  return false;
}

function splitInlineCobolComment(line: string): {
  codePart: string;
  inlineComment: string | null;
} {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && ch === '*' && line[i + 1] === '>') {
      return {
        codePart: line.slice(0, i).trimEnd(),
        inlineComment: line.slice(i + 2).trim(),
      };
    }
  }

  return { codePart: line, inlineComment: null };
}

function pushWrappedComment(out: string[], commentBody: string): void {
  if (commentBody.length === 0) {
    out.push(COMMENT_PREFIX);
    return;
  }
  const maxChunk = FIXED_MAX_COL - COMMENT_PREFIX.length - 1; // '      * ' + text <= 72
  let remaining = commentBody;
  while (remaining.length > maxChunk) {
    let splitIdx = remaining.lastIndexOf(' ', maxChunk);
    if (splitIdx <= 0) splitIdx = maxChunk;
    out.push(`${COMMENT_PREFIX} ${remaining.slice(0, splitIdx).trimEnd()}`);
    remaining = remaining.slice(splitIdx).trimStart();
  }
  out.push(`${COMMENT_PREFIX} ${remaining}`);
}

function pushWrappedCodeLine(
  out: string[],
  firstPrefix: string,
  text: string
): void {
  if (firstPrefix.length + text.length <= FIXED_MAX_COL) {
    out.push(`${firstPrefix}${text}`);
    return;
  }

  let currentPrefix = firstPrefix;
  let remaining = text;

  while (currentPrefix.length + remaining.length > FIXED_MAX_COL) {
    const maxLen = FIXED_MAX_COL - currentPrefix.length;
    const split = findSafeSplitIndex(remaining, maxLen);

    if (split.inQuote) {
      // String literal crosses column 72: fill right up to column 72 and emit fixed continuation line
      const chunk = remaining.slice(0, maxLen);
      out.push(`${currentPrefix}${chunk}`);
      remaining = `${split.quoteChar}${remaining.slice(maxLen)}`;
      currentPrefix = CONTINUATION_PREFIX;
    } else {
      const head = remaining.slice(0, split.index).trimEnd();
      out.push(`${currentPrefix}${head}`);
      remaining = remaining.slice(split.index).trimStart();
      currentPrefix = AREA_B_PREFIX;
    }
  }

  if (remaining.length > 0) {
    out.push(`${currentPrefix}${remaining}`);
  }
}

function findSafeSplitIndex(
  text: string,
  maxLen: number
): { index: number; inQuote: boolean; quoteChar: string } {
  let inSingle = false;
  let inDouble = false;
  let lastSpaceOutsideQuote = -1;

  const limit = Math.min(text.length, maxLen);
  for (let i = 0; i < limit; i++) {
    const ch = text[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && ch === ' ') {
      lastSpaceOutsideQuote = i;
    }
  }

  if (lastSpaceOutsideQuote > 0) {
    return { index: lastSpaceOutsideQuote, inQuote: false, quoteChar: '' };
  }

  if (inSingle || inDouble) {
    return {
      index: maxLen,
      inQuote: true,
      quoteChar: inDouble ? '"' : "'",
    };
  }

  // Fallback: find next space after maxLen if single token is somehow huge
  const nextSpace = text.indexOf(' ', maxLen);
  if (nextSpace > 0) {
    return { index: nextSpace, inQuote: false, quoteChar: '' };
  }
  return { index: maxLen, inQuote: false, quoteChar: '' };
}

function findUnclosedQuote(line: string): '"' | "'" | null {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
  }
  if (inDouble) return '"';
  if (inSingle) return "'";
  return null;
}

function isLikelyIdentArea(tail: string): boolean {
  return tail.trim().length === 0 || /^[0-9A-Z -]{1,8}\s*$/i.test(tail);
}

export { SEQ_AREA };
