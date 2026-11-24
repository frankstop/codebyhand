import React, { useEffect, useId, useImperativeHandle, useRef } from 'react';

export interface ConfirmDialogHandle {
  open: () => void;
  close: () => void;
}

export interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = React.forwardRef<ConfirmDialogHandle, ConfirmDialogProps>(
  (
    {
      title,
      description,
      confirmLabel,
      cancelLabel = 'Cancel',
      destructive = true,
      onConfirm,
    },
    ref
  ) => {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const titleId = useId();
    const onConfirmRef = useRef(onConfirm);
    onConfirmRef.current = onConfirm;

    useImperativeHandle(ref, () => ({
      open: () => {
        const dialog = dialogRef.current;
        if (dialog && !dialog.open) {
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
        const choice = dialog.returnValue;
        dialog.returnValue = '';
        if (choice === 'confirm') {
          onConfirmRef.current();
        }
      };

      dialog.addEventListener('close', handleClose);
      return () => dialog.removeEventListener('close', handleClose);
    }, []);

    return (
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="app-dialog"
      >
        <div className="dialog-body">
          <h1 id={titleId} className="dialog-title">
            {title}
          </h1>
          <p className="dialog-description">{description}</p>
          <form method="dialog" className="dialog-actions">
            <button
              type="submit"
              value="cancel"
              autoFocus={destructive}
              className="btn btn-secondary"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              value="confirm"
              autoFocus={!destructive}
              className={destructive ? 'btn btn-danger' : 'btn btn-primary'}
            >
              {confirmLabel}
            </button>
          </form>
        </div>
      </dialog>
    );
  }
);

ConfirmDialog.displayName = 'ConfirmDialog';
