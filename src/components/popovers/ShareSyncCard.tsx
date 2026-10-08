"use client";

import { ChevronRight, CircleX, Code, FileText, Info, Link2, Lock, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import styles from "./popovers.module.css";

export const SHARE_SYNC_CARD_WIDTH = 380;

/**
 * "Share and sync" — Cards:Modals/action-share-card.png.
 * NEEDS CLARIFICATION: the four actions and "Go to interfaces" have no designed destinations.
 */
export function ShareSyncCard({ onClose }: { onClose: () => void }) {
  const [noticeOpen, setNoticeOpen] = useState(true);
  const items = [
    { label: "Create link to view", icon: <Link2 size={22} strokeWidth={1.75} />, sepAfter: true },
    { label: "Sync data to another base", icon: <Zap size={22} strokeWidth={1.75} />, chevron: true },
    { label: "Embed this view", icon: <Code size={22} strokeWidth={1.75} />, sepAfter: true },
    { label: "Create a form view", icon: <FileText size={22} strokeWidth={1.75} /> },
  ];
  return (
    <>
      <div className={styles.header} style={{ minHeight: 45 }}>
        <span className={cn(styles.title, styles.titleLg)}>Share and sync</span>
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
          <CircleX size={22} strokeWidth={1.75} />
        </button>
      </div>
      <div className={styles.menu} style={{ paddingTop: 4 }}>
        {items.map((it) => (
          <div key={it.label} className={it.sepAfter ? styles.menuSep : undefined} style={it.sepAfter ? { borderTop: 0, borderBottom: "1px solid #152d4d" } : undefined}>
            <button type="button" className={styles.menuItem}>
              <span className={styles.menuIcon}>{it.icon}</span>
              {it.label}
              {it.chevron && <ChevronRight size={18} className={styles.menuChevron} aria-hidden />}
            </button>
          </div>
        ))}
      </div>
      {noticeOpen && (
        <div className={styles.notice}>
          <div className={styles.noticeTop}>
            <Info size={18} className={styles.bannerIcon} aria-hidden />
            <p>
              <span className={styles.noticeStrong}>Interface pages can now be shared publicly.</span> Instead of a shared view, create and share customizable layouts with
              interface designer.
              <a className={styles.noticeLink} href="#learn-more">
                Learn more
              </a>
            </p>
          </div>
          <div className={styles.noticeActions}>
            <button type="button" className={styles.noticeDismiss} onClick={() => setNoticeOpen(false)}>
              Dismiss
            </button>
            <button type="button" className={styles.noticeGo}>
              Go to interfaces
            </button>
          </div>
        </div>
      )}
      <div className={styles.lockBar}>
        <Lock size={18} aria-hidden />
        The workspace owner has restricted sharing and syncing.
      </div>
    </>
  );
}
