import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  rectangularSelection,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import {
  indentUnit,
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
  indentOnInput,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { rust } from '@codemirror/lang-rust';
import { tags } from '@lezer/highlight';
import type { CobolFormatMode, LanguageId } from '../types/schema';
import { cobol } from '../utils/cobolHighlight';

export interface CodeEditorProps {
  value: string;
  language: LanguageId;
  cobolFormat?: CobolFormatMode;
  onChange: (nextCode: string) => void;
  onRun: () => void;
  ariaLabel?: string;
}

const codeByHandHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#0f4c81', fontWeight: '600' },
  { tag: [tags.controlKeyword, tags.operatorKeyword], color: '#7c2d12', fontWeight: '600' },
  { tag: tags.heading, color: '#1e3a8a', fontWeight: '700' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: '#0f766e', fontWeight: '500' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#4338ca' },
  { tag: [tags.string, tags.special(tags.string)], color: '#15803d' },
  { tag: [tags.number, tags.integer, tags.float], color: '#b45309' },
  { tag: [tags.bool, tags.atom, tags.null], color: '#9333ea', fontWeight: '500' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: '#64748b', fontStyle: 'italic' },
  { tag: tags.meta, color: '#6d28d9' },
  { tag: tags.operator, color: '#334155' },
  { tag: tags.variableName, color: '#0f172a' },
  { tag: tags.propertyName, color: '#1e293b' },
]);

const codeByHandEditorTheme = EditorView.theme({
  '&': {
    fontSize: '13.5px',
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    lineHeight: '1.6',
    minHeight: '280px',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: '#0f172a',
  },
  '.cm-line': {
    padding: '0 14px',
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#64748b',
    borderRight: '1px solid #e2e8f0',
    minWidth: '42px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f1f5f9',
    color: '#0f172a',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(241, 245, 249, 0.72)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: '#dbeafe',
  },
  '.cm-selectionBackground': {
    backgroundColor: '#e2e8f0',
  },
  '.cm-matchingBracket': {
    backgroundColor: '#fef08a',
    outline: '1px solid #eab308',
    color: '#0f172a',
  },
});

function getLanguageExtension(language: LanguageId) {
  switch (language) {
    case 'js':
      return javascript();
    case 'rust':
      return rust();
    case 'cobol':
      return cobol();
  }
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language,
  cobolFormat = 'free',
  onChange,
  onRun,
  ariaLabel = 'Solution source code editor',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef(new Compartment());

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const runKeybinding = Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRunRef.current();
            return true;
          },
        },
      ])
    );

    const state = EditorState.create({
      doc: value,
      extensions: [
        runKeybinding,
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        EditorState.tabSize.of(2),
        indentUnit.of('  '),
        keymap.of([
          indentWithTab,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        languageCompartmentRef.current.of(getLanguageExtension(language)),
        syntaxHighlighting(codeByHandHighlightStyle),
        codeByHandEditorTheme,
        EditorView.contentAttributes.of({
          'aria-label': ariaLabel,
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'off',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: host,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally initialize once; prop updates synchronize via effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync language compartment when language switches
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageCompartmentRef.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language]);

  // Sync external value updates (e.g., switching problems, resetting starter, toggling COBOL format)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  const showFixedRuler = language === 'cobol' && cobolFormat === 'fixed';

  return (
    <div
      className={`editor-surface ${showFixedRuler ? 'has-cobol-fixed-guides' : ''}`.trim()}
    >
      {showFixedRuler && (
        <div className="cobol-column-legend" aria-hidden="true">
          <span>Cols 1–6 Seq</span>
          <span>7 Ind</span>
          <span>8–11 Area A</span>
          <span>12–72 Area B</span>
        </div>
      )}
      <div ref={hostRef} className="cm-host" />
    </div>
  );
};
