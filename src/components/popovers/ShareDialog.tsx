"use client";

import { ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import styles from "./popovers.module.css";

export const SHARE_DIALOG_WIDTH = 420;

const PEOPLE = [
  { initials: "Ra", color: "#a31f1f" },
  { initials: "A", color: "#26a69a" },
  { initials: "H", color: "#6366f1" },
];

/**
 * Share "BOSS" — Cards:Modals/share-dialog-card.png.
 * NEEDS CLARIFICATION: no control in the supplied screens opens this dialog, and "Share to web" is not designed.
 */
export function ShareDialog() {
  const [tab, setTab] = useState<"invite" | "web">("invite");
  return (
    <>
      <div className={styles.dialogBody}>
        <h2 className={cn(styles.title, styles.titleLg)} style={{ fontSize: 17 }}>
          Share &quot;BOSS&quot;
          <span className={styles.help}>
            <Info size={20} strokeWidth={1.75} aria-hidden />
          </span>
        </h2>
        <div className={styles.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "invite"} className={cn(styles.tab, tab === "invite" && styles.tabActive)} onClick={() => setTab("invite")}>
            Invite collaborators
          </button>
          <button type="button" role="tab" aria-selected={tab === "web"} className={cn(styles.tab, tab === "web" && styles.tabActive)} onClick={() => setTab("web")}>
            Share to web
          </button>
        </div>
        {tab === "invite" ? (
          <>
            <input className={styles.emailInput} type="email" placeholder="Request access via email" aria-label="Request access via email" />
            <p className={styles.sectionLabel}>People with access</p>
            <button type="button" className={styles.people}>
              <span className={styles.stack}>
                {PEOPLE.map((p) => (
                  <span key={p.initials} className={styles.avatar} style={{ background: p.color }}>
                    {p.initials}
                  </span>
                ))}
              </span>
              have access
              <ChevronRight size={16} style={{ marginLeft: "auto", color: "var(--text-secondary)" }} aria-hidden />
            </button>
          </>
        ) : (
          <p className={styles.muted}>NEEDS CLARIFICATION: “Share to web” content is not designed.</p>
        )}
      </div>
    </>
  );
}
