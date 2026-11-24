import { LanguageSupport, StreamLanguage } from '@codemirror/language';

const COBOL_DIVISIONS_AND_HEADERS = new Set([
  'IDENTIFICATION',
  'ID',
  'ENVIRONMENT',
  'DATA',
  'PROCEDURE',
  'DIVISION',
  'SECTION',
  'CONFIGURATION',
  'INPUT-OUTPUT',
  'FILE',
  'WORKING-STORAGE',
  'LOCAL-STORAGE',
  'LINKAGE',
  'PROGRAM-ID',
  'FUNCTION-ID',
  'AUTHOR',
  'ENVIRONMENT-NAME',
  'ENVIRONMENT-VALUE',
  'FD',
  'SD',
]);

const COBOL_VERBS = new Set([
  'ACCEPT',
  'ADD',
  'ALLOCATE',
  'ALTER',
  'CALL',
  'CANCEL',
  'CLOSE',
  'COMPUTE',
  'CONTINUE',
  'DELETE',
  'DISPLAY',
  'DIVIDE',
  'ELSE',
  'END-ADD',
  'END-CALL',
  'END-COMPUTE',
  'END-DELETE',
  'END-DISPLAY',
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
  'EVALUATE',
  'EXIT',
  'FREE',
  'GO',
  'GOBACK',
  'IF',
  'INITIALIZE',
  'INSPECT',
  'MERGE',
  'MOVE',
  'MULTIPLY',
  'NEXT',
  'OPEN',
  'PERFORM',
  'READ',
  'RELEASE',
  'RETURN',
  'REWRITE',
  'RUN',
  'SEARCH',
  'SET',
  'SORT',
  'START',
  'STOP',
  'STRING',
  'SUBTRACT',
  'THEN',
  'UNSTRING',
  'WHEN',
  'WRITE',
]);

const COBOL_CLAUSES_AND_TYPES = new Set([
  'ADVANCING',
  'AFTER',
  'ALL',
  'ALPHABETIC',
  'ALPHABETIC-LOWER',
  'ALPHABETIC-UPPER',
  'ALPHANUMERIC',
  'ALS',
  'AND',
  'ANY',
  'ARE',
  'ASCENDING',
  'ASSIGN',
  'AT',
  'BEFORE',
  'BINARY',
  'BLANK',
  'BY',
  'CHARACTERS',
  'COMP',
  'COMP-1',
  'COMP-2',
  'COMP-3',
  'COMP-4',
  'COMP-5',
  'COMPUTATIONAL',
  'CONVERTING',
  'CORR',
  'CORRESPONDING',
  'COUNT',
  'DELIMITED',
  'DELIMITER',
  'DEPENDING',
  'DESCENDING',
  'DOWN',
  'DUPLICATES',
  'END',
  'EOP',
  'EQUAL',
  'ERROR',
  'EXTERNAL',
  'FILLER',
  'FIRST',
  'FOR',
  'FROM',
  'FUNCTION',
  'GIVING',
  'GLOBAL',
  'GREATER',
  'INDEX',
  'INDEXED',
  'INITIAL',
  'INPUT',
  'INTO',
  'INVALID',
  'I-O',
  'IS',
  'JUST',
  'JUSTIFIED',
  'KEY',
  'LEADING',
  'LEFT',
  'LENGTH',
  'LESS',
  'LINE',
  'LINES',
  'MODE',
  'NEGATIVE',
  'NO',
  'NOT',
  'NUMERIC',
  'OCCURS',
  'OF',
  'OMITTED',
  'ON',
  'OPTIONAL',
  'OR',
  'ORDER',
  'ORGANIZATION',
  'OTHER',
  'OUTPUT',
  'OVERFLOW',
  'PACKED-DECIMAL',
  'PARAGRAPH',
  'PIC',
  'PICTURE',
  'POINTER',
  'POSITIVE',
  'REDEFINES',
  'REFERENCE',
  'REMAINDER',
  'RENAMES',
  'REPLACING',
  'RETURNING',
  'RIGHT',
  'ROUNDED',
  'SEQUENTIAL',
  'SEPARATE',
  'SIGN',
  'SIZE',
  'STANDARD',
  'STATUS',
  'TALLYING',
  'TEST',
  'THAN',
  'THROUGH',
  'THRU',
  'TIMES',
  'TO',
  'TRAILING',
  'UNTIL',
  'UP',
  'UPON',
  'USAGE',
  'USING',
  'VALUE',
  'VALUES',
  'VARYING',
  'WITH',
]);

const COBOL_CONSTANTS = new Set([
  'FALSE',
  'HIGH-VALUE',
  'HIGH-VALUES',
  'LOW-VALUE',
  'LOW-VALUES',
  'NULL',
  'NULLS',
  'QUOTE',
  'QUOTES',
  'SPACE',
  'SPACES',
  'TRUE',
  'ZERO',
  'ZEROES',
  'ZEROS',
]);

interface CobolLexerState {
  expectPicMask: boolean;
}

const cobolStreamLanguage = StreamLanguage.define<CobolLexerState>({
  name: 'cobol',
  startState(): CobolLexerState {
    return { expectPicMask: false };
  },
  token(stream, state): string | null {
    // Fixed-format sequence numbers (cols 1-6) + col 7 comment indicator
    if (stream.sol()) {
      state.expectPicMask = false;
      if (stream.match(/^[0-9 ]{6}[*\/]/)) {
        stream.skipToEnd();
        return 'comment';
      }
      if (stream.match(/^[0-9]{6}/)) {
        return 'meta';
      }
    }

    if (stream.eatSpace()) {
      return null;
    }

    // Compiler directives such as >>SOURCE FORMAT IS FREE
    if (stream.match(/^>>[^\n]*/)) {
      return 'meta';
    }

    // Free-format inline comment *>
    if (stream.match(/^\*>[^\n]*/)) {
      return 'comment';
    }

    // PIC mask right after PIC / PICTURE [IS]
    if (state.expectPicMask) {
      if (stream.match(/^IS\b/i)) {
        return 'keyword';
      }
      if (stream.match(/^[S9VXZAB0+\-$,.*\/CRDB()0-9]+/i)) {
        state.expectPicMask = false;
        return 'typeName';
      }
      state.expectPicMask = false;
    }

    // Quoted string literals (including hex/null-terminated prefixes X"...", Z"...")
    if (stream.match(/^[XZxz]?("(?:[^"]|"")*"|'(?:[^']|'')*')/)) {
      return 'string';
    }

    // Punctuation & relational operators
    if (stream.match(/^(>=|<=|<>|\*\*|[=<>+\-*\/(),.:])/)) {
      return 'operator';
    }

    // Numeric literals & level numbers
    if (stream.match(/^[+-]?\d+(?:\.\d+)?(?![A-Za-z0-9-])/)) {
      return 'number';
    }

    // COBOL words (identifiers, verbs, clauses)
    if (stream.match(/^[A-Za-z0-9][A-Za-z0-9-]*/)) {
      const upper = stream.current().toUpperCase();

      if (upper === 'PIC' || upper === 'PICTURE') {
        state.expectPicMask = true;
        return 'typeName';
      }
      if (COBOL_DIVISIONS_AND_HEADERS.has(upper)) {
        return 'heading';
      }
      if (COBOL_VERBS.has(upper)) {
        return 'keyword';
      }
      if (COBOL_CONSTANTS.has(upper)) {
        return 'atom';
      }
      if (COBOL_CLAUSES_AND_TYPES.has(upper)) {
        return 'typeName';
      }
      return 'variableName';
    }

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '*>' },
  },
});

export function cobol(): LanguageSupport {
  return new LanguageSupport(cobolStreamLanguage);
}
