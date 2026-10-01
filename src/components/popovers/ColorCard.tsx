"use client";

import { CircleChevronDown, CircleX, SlidersVertical } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import styles from "./popovers.module.css";

export const COLOR_CARD_WIDTH = 380;

const OPTIONS = [
  { id: "select", title: "Select field", sub: "Color records the same as a single select field", icon: <CircleChevronDown size={20} /> },
  { id: "conditions", title: "Conditions", sub: "Color records based on conditions", icon: <SlidersVertical size={18} /> },
] as const;

/**
 * "Color records" — Cards:Modals/action-color-card.png.
 * NEEDS CLARIFICATION: only this first step is designed; what follows a choice is not.
 */
export function ColorCard({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string>("select");
  return (
    <>
      <div className={styles.header} style={{ minHeight: 50 }}>
        <span className={cn(styles.title, styles.titleLg)}>Color records</span>
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
          <CircleX size={22} strokeWidth={1.75} />
        </button>
      </div>
      <div className={styles.optionList}>
        {OPTIONS.map((o) => (
          <button key={o.id} type="button" className={cn(styles.option, selected === o.id && styles.optionActive)} onClick={() => setSelected(o.id)} aria-pressed={selected === o.id}>
            <span className={styles.optionIcon}>{o.icon}</span>
            <span>
              <span className={styles.optionTitle}>{o.title}</span>
              <span className={styles.optionSub}>{o.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

