"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import styles from "./feedback.module.css";

/**
 * Open dialogs register here so that Escape / Tab only act on the top-most one
 * (e.g. a confirmation shown on top of a drawer).
 */
const dialogStack: symbol[] = [];

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function useDialogBehavior<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const token = Symbol("dialog");
    dialogStack.push(token);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = ref.current;
    const focusables = () => (panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);
    const preferred = panel?.querySelector<HTMLElement>("[data-autofocus]");
    const body = panel?.querySelector<HTMLElement>("[data-dialog-body]");
    const first = preferred ?? body?.querySelector<HTMLElement>(FOCUSABLE) ?? focusables()[0] ?? panel;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== token) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      const at = dialogStack.indexOf(token);
      if (at >= 0) dialogStack.splice(at, 1);
      if (dialogStack.length === 0) document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  return ref;
}

interface DialogChrome {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Left-aligned footer slot (e.g. a destructive action). */
  footerStart?: ReactNode;
  width?: number;
}

function DialogContent({ title, subtitle, children, footer, footerStart, onClose, titleId }: Omit<DialogChrome, "open" | "width"> & { titleId: string }) {
  return (
    <>
      <div className={styles.dialogHead}>
        <div>
          <h2 id={titleId} className={styles.dialogTitle}>
            {title}
          </h2>
          {subtitle && <p className={styles.dialogSub}>{subtitle}</p>}
        </div>
        <button type="button" className={styles.dialogClose} aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className={styles.dialogBody} data-dialog-body>
        {children}
      </div>
      {(footer || footerStart) && (
        <div className={styles.dialogFoot}>
          {footerStart && <div className={styles.dialogFootStart}>{footerStart}</div>}
          {footer}
        </div>
      )}
    </>
  );
}

/** Centered modal (forms that fit in one screen). */
export function Modal({ open, onClose, width = 520, ...rest }: DialogChrome) {
  const titleId = useId();
  const ref = useDialogBehavior<HTMLDivElement>(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(styles.backdrop, styles.backdropModal)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.modal} style={{ maxWidth: width }}>
        <DialogContent {...rest} onClose={onClose} titleId={titleId} />
      </div>
    </div>,
    document.body,
  );
}

/** Right-hand drawer used to view / create / edit a record without leaving the table. */
export function Drawer({ open, onClose, width = 520, ...rest }: DialogChrome) {
  const titleId = useId();
  const ref = useDialogBehavior<HTMLDivElement>(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(styles.backdrop, styles.backdropDrawer)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.drawer} style={{ maxWidth: width }}>
        <DialogContent {...rest} onClose={onClose} titleId={titleId} />
      </aside>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirmations focus "Cancel" first so Enter cannot delete by accident. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId();
  const ref = useDialogBehavior<HTMLDivElement>(open, onCancel);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={cn(styles.backdrop, styles.backdropConfirm)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.modal} style={{ maxWidth: 440 }}>
        <div className={styles.dialogHead}>
          <h2 id={titleId} className={styles.dialogTitle}>
            {title}
          </h2>
        </div>
        <div className={styles.dialogBody}>
          <div className={styles.confirmText}>{message}</div>
        </div>
        <div className={styles.dialogFoot}>
          <Button variant="secondary" size="md" onClick={onCancel} data-autofocus={destructive ? "" : undefined}>
            {cancelLabel}
          </Button>
          <Button size="md" onClick={onConfirm} disabled={busy} data-autofocus={destructive ? undefined : ""}>
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
