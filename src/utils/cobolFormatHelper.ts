import type { CobolFormatMode, ProblemSpec } from '../types/schema';

const AREA_A_PREFIX_RE =
  /^(IDENTIFICATION\s+DIVISION|ID\s+DIVISION|ENVIRONMENT\s+DIVISION|DATA\s+DIVISION|PROCEDURE\s+DIVISION|CONFIGURATION\s+SECTION|INPUT-OUTPUT\s+SECTION|FILE\s+SECTION|WORKING-STORAGE\s+SECTION|LOCAL-STORAGE\s+SECTION|LINKAGE\s+SECTION|PROGRAM-ID\b|AUTHOR\b|DATE-WRITTEN\b|FD\b|SD\b|0?1\b|77\b)/i;

const COBOL_VERB_START_RE =
  /^(ACCEPT|ADD|ALTER|CALL|CANCEL|CLOSE|COMPUTE|CONTINUE|DELETE|DISPLAY|DIVIDE|ELSE|END-[A-Z0-9-]+|ENTRY|EVALUATE|EXIT|GO\b|GOBACK|IF\b|INITIALIZE|INITIATE|INSPECT|MERGE|MOVE|MULTIPLY|NEXT\b|NOT\b|ON\b|OPEN|PERFORM|READ|RELEASE|RETURN|REWRITE|SEARCH|SET\b|SORT|START|STOP\b|STRING|SUBTRACT|TERMINATE|THEN\b|UNSTRING|WHEN\b|WRITE)\b/i;

const SUB_LEVEL_RE = /^(0?[2-9]|[1-4][0-9]|66|88)\b/;

/**
 * Detects whether a COBOL source snippet is already written in Fixed-Format (Cols 7-72)
 * or Free-Format.
 */
export function detectCobolFormat(source: string): CobolFormatMode {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (/^\s*>>\s*SOURCE\s+FORMAT\s+(IS\s+)?FREE/i.test(line)) {
      return 'free';
    }
    if (/^\s*>>\s*SOURCE\s+FORMAT\s+(IS\s+)?FIXED/i.test(line)) {
      return 'fixed';
    }
  }

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return 'free';

  let fixedIndicators = 0;
  for (const line of nonEmpty) {
    if (
      line.length >= 7 &&
      /^[0-9 ]{6}[*\/\- ]/.test(line) &&
      (line[6] === '*' || line.startsWith('       '))
    ) {
      fixedIndicators += 1;
    }
  }

  return fixedIndicators >= Math.ceil(nonEmpty.length * 0.6) ? 'fixed' : 'free';
}

function splitInlineFreeComment(line: string): { code: string; comment: string | null } {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length - 1; i += 1) {
    const ch = line[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && ch === '*' && line[i + 1] === '>') {
      return {
        code: line.slice(0, i).trimEnd(),
        comment: line.slice(i + 2).trim(),
      };
    }
  }

  return { code: line, comment: null };
}

function isParagraphHeader(trimmed: string): boolean {
  if (!trimmed.endsWith('.')) return false;
  const withoutDot = trimmed.slice(0, -1).trim();
  if (!/^[A-Z0-9][A-Z0-9-]*$/i.test(withoutDot)) return false;
  return !COBOL_VERB_START_RE.test(withoutDot);
}

function wrapFixedCodeLine(prefix: string, content: string): string[] {
  const full = `${prefix}${content}`;
  if (full.length <= 72) {
    return [full];
  }

  const maxBodyWidth = Math.max(20, 72 - prefix.length);
  const continuationPrefix =
    prefix.length >= 11 ? prefix : '           ';
  const maxContWidth = 72 - continuationPrefix.length;

  // Tokenize respecting quoted strings so we don't split inside short literals unless forced
  const tokens: string[] = [];
  let current = '';
  let inQuote: "'" | '"' | null = null;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (inQuote) {
      current += ch;
      if (ch === inQuote) {
        inQuote = null;
      }
    } else if (ch === "'" || ch === '"') {
      inQuote = ch;
      current += ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  const wrapped: string[] = [];
  let lineBuf = '';
  let isFirst = true;

  for (const tok of tokens) {
    const limit = isFirst ? maxBodyWidth : maxContWidth;
    const candidate = lineBuf ? `${lineBuf} ${tok}` : tok;
    if (candidate.length <= limit) {
      lineBuf = candidate;
    } else {
      if (lineBuf) {
        wrapped.push(`${isFirst ? prefix : continuationPrefix}${lineBuf}`);
        isFirst = false;
        lineBuf = tok;
      } else {
        // Single very long token (e.g. long string literal)
        wrapped.push(`${isFirst ? prefix : continuationPrefix}${tok.slice(0, limit)}`);
        let rest = tok.slice(limit);
        isFirst = false;
        while (rest.length > maxContWidth) {
          wrapped.push(`      -    "${rest.slice(0, maxContWidth - 1)}`);
          rest = rest.slice(maxContWidth - 1);
        }
        lineBuf = rest;
      }
    }
  }

  if (lineBuf) {
    wrapped.push(`${isFirst ? prefix : continuationPrefix}${lineBuf}`);
  }

  return wrapped;
}

/**
 * Converts Free-Format COBOL source into standard Fixed-Format (Cols 7-72):
 * - Columns 1-6: blank sequence area (`      `)
 * - Column 7: `*` for comments or ` ` for source lines
 * - Columns 8-11 (Area A): divisions, sections, paragraphs, 01/77/FD items
 * - Columns 12-72 (Area B): statements and subordinate 02-49/66/88 data items
 */
export function freeToFixedCobol(source: string): string {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];

  for (const rawLine of rawLines) {
    // Strip free/fixed compiler directive lines as cobc receives -free / -fixed CLI flag
    if (/^\s*>>\s*SOURCE\s+FORMAT\b/i.test(rawLine)) {
      continue;
    }

    if (rawLine.trim().length === 0) {
      output.push('');
      continue;
    }

    // Already a fixed-format comment line
    if (rawLine.length >= 7 && /^[0-9 ]{6}[*\/]/.test(rawLine)) {
      output.push(rawLine.slice(0, 72));
      continue;
    }

    const trimmedStart = rawLine.trimStart();
    if (trimmedStart.startsWith('*>')) {
      const commentBody = trimmedStart.slice(2).trim();
      const commentLine = commentBody ? `      * ${commentBody}` : '      *';
      output.push(commentLine.slice(0, 72));
      continue;
    }

    const { code, comment } = splitInlineFreeComment(rawLine);
    if (comment) {
      output.push(`      * ${comment}`.slice(0, 72));
    }

    const trimmed = code.trim();
    if (!trimmed) {
      continue;
    }

    const leadingSpaces = code.length - code.trimStart().length;

    const isAreaA =
      AREA_A_PREFIX_RE.test(trimmed) ||
      (!SUB_LEVEL_RE.test(trimmed) && isParagraphHeader(trimmed));

    if (isAreaA) {
      output.push(...wrapFixedCodeLine('       ', trimmed));
    } else {
      // Preserve gentle nested indentation inside Area B (cols 12..72)
      const relativeExtra = Math.min(8, Math.max(0, leadingSpaces >= 4 ? leadingSpaces - 4 : 0));
      const areaBPrefix = '           ' + ' '.repeat(relativeExtra);
      output.push(...wrapFixedCodeLine(areaBPrefix, trimmed));
    }
  }

  return output.join('\n');
}

/**
 * Converts Fixed-Format COBOL (Cols 7-72) into clean, readable Free-Format COBOL.
 */
export function fixedToFreeCobol(source: string): string {
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];

  for (const rawLine of rawLines) {
    if (/^\s*>>\s*SOURCE\s+FORMAT\b/i.test(rawLine)) {
      continue;
    }

    if (rawLine.trim().length === 0) {
      output.push('');
      continue;
    }

    const trimmedStart = rawLine.trimStart();
    if (trimmedStart.startsWith('*>')) {
      output.push(rawLine.trimEnd());
      continue;
    }

    if (rawLine.length >= 7 && /^[0-9 ]{6}[*\/\- ]/.test(rawLine)) {
      const indicator = rawLine[6];
      const codeArea = rawLine.slice(7, 72).trimEnd();

      if (indicator === '*' || indicator === '/') {
        const commentText = codeArea.trim();
        output.push(commentText ? `*> ${commentText}` : '*>');
        continue;
      }

      if (indicator === '-') {
        const prev = output.pop() ?? '';
        output.push(`${prev}${codeArea.trimStart()}`);
        continue;
      }

      const trimmedCode = codeArea.trim();
      if (!trimmedCode) {
        output.push('');
        continue;
      }

      const areaOffset = codeArea.length - codeArea.trimStart().length;
      if (areaOffset === 0 || AREA_A_PREFIX_RE.test(trimmedCode) || isParagraphHeader(trimmedCode)) {
        output.push(trimmedCode);
      } else {
        // Area B begins at index 4 of codeArea (column 12)
        const nestedIndent = Math.max(0, areaOffset - 4);
        output.push(`${' '.repeat(4 + nestedIndent)}${trimmedCode}`);
      }
      continue;
    }

    output.push(rawLine.trimEnd());
  }

  return output.join('\n');
}

/**
 * Converts COBOL buffer between Free-Format and Fixed-Format, using curated
 * `problem.starterCode` / `problem.starterCodeFixed` templates when the buffer
 * matches the opposite starter template cleanly.
 */
export function convertCobolBuffer(
  currentCode: string,
  targetFormat: CobolFormatMode,
  problem?: Pick<ProblemSpec, 'starterCode' | 'starterCodeFixed'>
): string {
  const normalizedCurrent = currentCode.replace(/\r\n/g, '\n').trim();

  if (problem) {
    const freeStarter = problem.starterCode.replace(/\r\n/g, '\n').trim();
    const fixedStarter = problem.starterCodeFixed
      ? problem.starterCodeFixed.replace(/\r\n/g, '\n').trim()
      : null;

    if (targetFormat === 'fixed' && normalizedCurrent === freeStarter) {
      return problem.starterCodeFixed ?? freeToFixedCobol(problem.starterCode);
    }

    if (
      targetFormat === 'free' &&
      fixedStarter &&
      normalizedCurrent === fixedStarter
    ) {
      return problem.starterCode;
    }

    if (
      targetFormat === 'free' &&
      normalizedCurrent === freeToFixedCobol(problem.starterCode).trim()
    ) {
      return problem.starterCode;
    }
  }

  return targetFormat === 'fixed'
    ? freeToFixedCobol(currentCode)
    : fixedToFreeCobol(currentCode);
}

export function getCobolStarterForFormat(
  problem: Pick<ProblemSpec, 'starterCode' | 'starterCodeFixed'>,
  format: CobolFormatMode
): string {
  if (format === 'fixed') {
    return problem.starterCodeFixed ?? freeToFixedCobol(problem.starterCode);
  }
  return problem.starterCode;
}
