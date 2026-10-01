import type { CSSProperties } from "react";
import { Copy, Pencil, Trash2 } from "lucide-react";
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
 * Edit / duplicate / delete icons shown in the designs.
 * NEEDS CLARIFICATION: no edit form, duplicate result or delete confirmation is designed,
 * so these are presentational and intentionally have no behaviour yet.
 */
export function RowActions({ icons = ["edit", "copy", "delete"], variant = "plain", iconSize = 14, color, label }: RowActionsProps) {
  return (
    <span className={cn(styles.actions, variant === "boxed" && styles.actionsBoxed)} style={{ gap: 26 - iconSize, ...(color ? ({ "--ra-color": color } as CSSProperties) : {}) }}>
      {icons.includes("edit") && (
        <button type="button" className={cn(styles.actionBtn, variant === "boxed" && styles.actionEdit)} aria-label={`Edit ${label}`}>
          <Pencil size={iconSize} strokeWidth={1.75} />
        </button>
      )}
      {icons.includes("copy") && (
        <button type="button" className={styles.actionBtn} aria-label={`Duplicate ${label}`}>
          <Copy size={iconSize} strokeWidth={1.75} />
        </button>
      )}
      {icons.includes("delete") && (
        <button type="button" className={cn(styles.actionBtn, styles.actionDelete)} aria-label={`Delete ${label}`}>
          <Trash2 size={iconSize} strokeWidth={1.75} />
        </button>
      )}
    </span>
  );
}
