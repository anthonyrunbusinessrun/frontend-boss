"use client";

import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/Dialog";

/** Asks before closing a form that has unsaved changes. */
export function useDiscardGuard(dirty: boolean, onClose: () => void): { requestClose: () => void; dialog: ReactNode } {
  const [asking, setAsking] = useState(false);
  return {
    requestClose: () => (dirty ? setAsking(true) : onClose()),
    dialog: (
      <ConfirmDialog
        open={asking}
        title="Discard unsaved changes?"
        message="You have changes that have not been saved. If you close this form they will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          onClose();
        }}
      />
    ),
  };
}

/** Focus the first invalid control after a failed submit. */
export function focusFirstInvalid() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
