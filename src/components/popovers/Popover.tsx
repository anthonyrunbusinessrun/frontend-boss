"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import styles from "./popovers.module.css";

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** Panel width in CSS px (from the supplied card designs). */
  width: number;
  align?: "left" | "right";
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  panelStyle?: CSSProperties;
}

/**
 * Anchored popover: closes on outside press and Escape. The trigger is rendered
 * inside the same anchor so "outside" means outside both trigger and panel.
 */
export function Popover({ open, onClose, width, align = "left", label, trigger, children, panelStyle }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className={styles.anchor}>
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(styles.panel, align === "left" ? styles.alignLeft : styles.alignRight)}
          style={{ width, ...panelStyle }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Non-anchored panel with the same chrome, used by the dev card gallery. */
export function StaticPanel({ width, height, id, children }: { width: number; height?: number; id: string; children: ReactNode }) {
  return (
    <div data-card={id} className={cn(styles.panel, styles.static)} style={{ width, height }}>
      {children}
    </div>
  );
}
