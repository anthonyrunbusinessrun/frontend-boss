"use client";

import { ArrowRight, ChevronDown, CircleHelp, Ellipsis, Plus, SquareCheck, Square, Trash2 } from "lucide-react";
import styles from "./popovers.module.css";

export const GROUP_CARD_WIDTH = 520;

/**
 * "Group by" — Cards:Modals/grouping-chip-filtering-card.png.
 * Collapse all / Expand all act on the table groups; the rest of the controls are
 * NEEDS CLARIFICATION (sub-grouping, ordering and removing the group are not designed).
 */
export function GroupByCard({ onCollapseAll, onExpandAll }: { onCollapseAll: () => void; onExpandAll: () => void }) {
  return (
    <>
      <div className={styles.header} style={{ minHeight: 50 }}>
        <span className={styles.title} style={{ fontWeight: 700 }}>
          Group by
          <span className={styles.help}>
            <CircleHelp size={18} strokeWidth={1.75} aria-hidden />
          </span>
        </span>
        <span style={{ display: "inline-flex", gap: 20 }}>
          <button type="button" className={styles.headerAction} onClick={onCollapseAll}>
            Collapse all
          </button>
          <button type="button" className={styles.headerAction} onClick={onExpandAll}>
            Expand all
          </button>
        </span>
      </div>
      <div className={styles.groupBody}>
        <div className={styles.groupRow}>
          <span className={`${styles.select} ${styles.selectGrow}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <SquareCheck size={18} color="var(--accent-cyan)" aria-hidden /> Team
            </span>
            <ChevronDown size={16} aria-hidden />
          </span>
          <span className={`${styles.select} ${styles.selectDir}`}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Square size={16} aria-hidden />
              <ArrowRight size={14} aria-hidden />
              <SquareCheck size={16} color="var(--accent-cyan)" aria-hidden />
            </span>
            <ChevronDown size={16} aria-hidden />
          </span>
          <button type="button" className={styles.iconBtn} aria-label="More options">
            <Ellipsis size={14} />
          </button>
          <button type="button" className={`${styles.iconBtn} ${styles.iconBtnDanger}`} aria-label="Remove grouping">
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </div>
        <button type="button" className={styles.cyanLink}>
          <Plus size={18} strokeWidth={2.5} aria-hidden /> Add subgroup
        </button>
      </div>
      <div className={styles.panelFoot}>
        Summarize your records further with a pivot table in an <a href="#interface-dashboard">interface dashboard layout</a>
      </div>
    </>
  );
}
