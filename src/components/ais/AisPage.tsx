import type { ReactNode } from "react";
import { SkeletonBar } from "@/components/ui/EmptyState";
import shell from "@/components/shell/shell.module.css";
import styles from "./ais.module.css";

interface AisPageProps {
  title: string;
  subtitle?: string;
  /** Right-hand toolbar controls. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Frame for AIS screens that are not tables (dashboard, reports, settings): same header metrics as a BOSS view. */
export function AisPage({ title, subtitle, actions, children }: AisPageProps) {
  return (
    <div className={shell.workspace}>
      <main className={styles.page}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.headActions}>{actions}</div>}
        </div>
        <div className={styles.body}>{children}</div>
      </main>
    </div>
  );
}

export function AisPageLoading({ title }: { title: string }) {
  return (
    <div className={shell.workspace}>
      <main className={styles.page} aria-busy="true">
        <div className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
        </div>
        <div className={styles.loading} role="status">
          <SkeletonBar width="40%" />
          <SkeletonBar width="90%" />
          <SkeletonBar width="75%" />
          <SkeletonBar width="85%" />
          <span className={shell.srOnly}>Loading…</span>
        </div>
      </main>
    </div>
  );
}
