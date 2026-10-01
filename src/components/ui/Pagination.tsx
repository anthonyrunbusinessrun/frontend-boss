"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import styles from "./ui.module.css";

interface PaginationProps {
  page: number;
  pages: number;
  onChange?: (page: number) => void;
  variant?: "plain" | "boxed";
}

export function Pagination({ page, pages, onChange, variant = "boxed" }: PaginationProps) {
  const go = (p: number) => {
    if (p >= 1 && p <= pages && p !== page) onChange?.(p);
  };
  return (
    <nav aria-label="Pagination" className={cn(styles.pager, variant === "boxed" && styles.pagerBoxed)}>
      <button type="button" className={styles.pagerBtn} aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)}>
        <ChevronLeft size={14} strokeWidth={2.5} />
      </button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          className={cn(styles.pagerBtn, p === page && styles.pagerActive)}
          aria-current={p === page ? "page" : undefined}
          onClick={() => go(p)}
        >
          {p}
        </button>
      ))}
      <button type="button" className={styles.pagerBtn} aria-label="Next page" disabled={page >= pages} onClick={() => go(page + 1)}>
        <ChevronRight size={14} strokeWidth={2.5} />
      </button>
    </nav>
  );
}
