import React, { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { UserProgressStore } from '../types/schema';
import { parseProgressStoreJson } from '../utils/progressStore';

export interface ImportProgressDialogHandle {
  open: () => void;
  close: () => void;
}

export interface ImportProgressDialogProps {
  onImport: (store: UserProgressStore, mode: 'merge' | 'replace') => void;
}

export const ImportProgressDialog = React.forwardRef<
  ImportProgressDialogHandle,
  ImportProgressDialogProps
>(({ onImport }, ref) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  const fileInputId = useId();
  const jsonInputId = useId();
  const [jsonText, setJsonText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open) {
        setErrorMessage(null);
        setLoadedFileName(null);
        setJsonText('');
        setMode('merge');
        dialog.returnValue = '';
        dialog.showModal();
      }
    },
    close: () => {
      dialogRef.current?.close();
    },
  }));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setLoadedFileName(file.name);
      setJsonText(content);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Could not read the selected file.');
    }
  };

  const handleApplyImport = () => {
    if (!jsonText.trim()) {
      setErrorMessage('Upload a .json file or paste exported progress JSON first.');
      return;
    }

    const parsed = parseProgressStoreJson(jsonText);
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return;
    }

    onImport(parsed.store, mode);
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="app-dialog app-dialog-wide"
    >
      <div className="dialog-body">
        <h1 id={titleId} className="dialog-title">
          Import Progress (JSON)
        </h1>
        <p className="dialog-description">
          Restore a previously exported <code>UserProgressStore</code> JSON file or paste its contents below.
        </p>

        <div className="import-field-group">
          <label htmlFor={fileInputId} className="file-upload-label">
            <Upload size={15} aria-hidden="true" focusable="false" />
            <span>{loadedFileName ? `Loaded: ${loadedFileName}` : 'Choose .json file'}</span>
          </label>
          <input
            id={fileInputId}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="sr-only"
          />
        </div>

        <div className="import-field-group">
          <label htmlFor={jsonInputId} className="field-label">
            Or paste progress JSON:
          </label>
          <textarea
            id={jsonInputId}
            rows={7}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.currentTarget.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder='{"version": 1, "selectedLanguage": "js", "problems": { ... }}'
            className="import-textarea"
            autoFocus
          />
        </div>

        <fieldset className="import-mode-fieldset">
          <legend className="field-label">Import mode</legend>
          <label className="radio-option">
            <input
              type="radio"
              name="import-mode"
              value="merge"
              checked={mode === 'merge'}
              onChange={() => setMode('merge')}
            />
            <span>Merge with current browser progress (recommended)</span>
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="import-mode"
              value="replace"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            <span>Replace current progress completely</span>
          </label>
        </fieldset>

        {errorMessage && (
          <p className="dialog-error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="dialog-actions">
          <form method="dialog">
            <button type="submit" value="cancel" className="btn btn-secondary">
              Cancel
            </button>
          </form>
          <button
            type="button"
            onClick={handleApplyImport}
            className="btn btn-primary"
          >
            Import Progress
          </button>
        </div>
      </div>
    </dialog>
  );
});

ImportProgressDialog.displayName = 'ImportProgressDialog';
