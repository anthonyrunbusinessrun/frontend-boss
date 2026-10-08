"use client";

import type { CSSProperties, MouseEvent } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { useCurrentRow, useRecordActions } from "@/components/table/RecordContext";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

interface RowActionsProps {
  /** Which icons to draw (the design varies per view). */
  icons?: Array<"edit" | "copy" | "delete">;
  variant?: "plain" | "boxed";
  iconSize?: number;
  /** Icon colour override for screens that draw the icons dimmer. */
  color?: string;
  label: string;
}

/**
 * Edit / duplicate / delete icons shown in the designs. They call the actions
 * of the surrounding Workspace for the row being rendered; delete always goes
 * through a confirmation dialog there.
 */
export function RowActions({ icons = ["edit", "copy", "delete"], variant = "plain", iconSize = 14, color, label }: RowActionsProps) {
  const row = useCurrentRow();
  const actions = useRecordActions();
  const run = (fn?: (row: unknown) => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn?.(row);
  };
  return (
    <span className={cn(styles.actions, variant === "boxed" && styles.actionsBoxed)} style={{ gap: 26 - iconSize, ...(color ? ({ "--ra-color": color } as CSSProperties) : {}) }}>
      {icons.includes("edit") && (
        <button type="button" className={cn(styles.actionBtn, variant === "boxed" && styles.actionEdit)} aria-label={`Edit ${label}`} title="Edit" onClick={run(actions?.edit)}>
          <Pencil size={iconSize} strokeWidth={1.75} />
        </button>
      )}
      {icons.includes("copy") && (
        <button type="button" className={styles.actionBtn} aria-label={`Duplicate ${label}`} title="Duplicate" onClick={run(actions?.duplicate)}>
          <Copy size={iconSize} strokeWidth={1.75} />
        </button>
      )}
      {icons.includes("delete") && (
        <button type="button" className={cn(styles.actionBtn, styles.actionDelete)} aria-label={`Delete ${label}`} title="Delete" onClick={run(actions?.remove)}>
          <Trash2 size={iconSize} strokeWidth={1.75} />
        </button>
      )}
    </span>
  );
}
