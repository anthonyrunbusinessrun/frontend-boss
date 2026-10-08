import type { ReactNode } from "react";
import styles from "./feedback.module.css";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary / secondary actions, usually <Button>s. */
  children?: ReactNode;
}

export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className={styles.empty} role="status">
      {icon && <span className={styles.emptyIcon}>{icon}</span>}
      <p className={styles.emptyTitle}>{title}</p>
      {description && <p className={styles.emptyText}>{description}</p>}
      {children && <div className={styles.emptyAction}>{children}</div>}
    </div>
  );
}

export function SkeletonBar({ width = "100%" }: { width?: number | string }) {
  return <span className={styles.skeletonBar} style={{ width }} aria-hidden />;
}
