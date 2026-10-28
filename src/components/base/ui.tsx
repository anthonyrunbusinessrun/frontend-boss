"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHOICE_TONES, fallbackColor } from "@/lib/base/fields";
import type { ChoiceColor } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import s from "./base.module.css";

/** Open panels, oldest first. Only the top one answers Escape; a click closes every panel that is not under the click. */
const panelStack: symbol[] = [];

/** A panel anchored to an element, rendered in a portal so scrolling containers never clip it. Panels can be nested. */
export function FloatingPanel({ anchor, open, onClose, width = 240, align = "left", children, className, maxHeight = 380 }: { anchor: HTMLElement | null; open: boolean; onClose: () => void; width?: number; align?: "left" | "right"; children: ReactNode; className?: string; maxHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" });
  const [level, setLevel] = useState(0);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const r = anchor.getBoundingClientRect();
    const h = Math.min(ref.current.offsetHeight, maxHeight);
    const w = Math.min(width, window.innerWidth - 16);
    let left = align === "right" ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ left, top, width: w, maxHeight });
  }, [open, anchor, width, align, maxHeight, children]);

  useEffect(() => {
    if (!open) return;
    const token = Symbol("panel");
    panelStack.push(token);
    const myLevel = panelStack.length - 1;
    setLevel(myLevel);
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (anchor?.contains(t)) return;
      // inside this panel, or inside one opened from it: stay open
      const hit = t.closest?.("[data-floating-level]") as HTMLElement | null;
      if (hit && Number(hit.dataset.floatingLevel) >= myLevel) return;
      closeRef.current();
    };
    // window capture runs before the dialog's own Escape handler, so Escape closes only the top panel
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || panelStack[panelStack.length - 1] !== token) return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key, true);
      const at = panelStack.indexOf(token);
      if (at >= 0) panelStack.splice(at, 1);
    };
  }, [open, anchor]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div ref={ref} className={cn(s.floating, className)} style={pos} role="dialog" data-floating-level={level}>
      {children}
    </div>,
    document.body,
  );
}

/** Button that toggles a FloatingPanel. */
export function PanelButton({ trigger, children, width, align, className, label, onOpenChange, maxHeight }: { trigger: (p: { open: boolean; ref: (el: HTMLElement | null) => void; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; width?: number; align?: "left" | "right"; className?: string; label?: string; onOpenChange?: (o: boolean) => void; maxHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [el, setEl] = useState<HTMLElement | null>(null);
  const set = (o: boolean) => {
    setOpen(o);
    onOpenChange?.(o);
  };
  return (
    <>
      {trigger({ open, ref: setEl, toggle: () => set(!open) })}
      <FloatingPanel anchor={el} open={open} onClose={() => set(false)} width={width} align={align} className={className} maxHeight={maxHeight}>
        <div aria-label={label}>{children(() => set(false))}</div>
      </FloatingPanel>
    </>
  );
}

export function Chip({ color, children, title }: { color?: ChoiceColor; children: ReactNode; title?: string }) {
  const tone = CHOICE_TONES[color ?? "gray"];
  return (
    <span className={s.choice} title={title} style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
      {children}
    </span>
  );
}

export const colorOf = (name: string, choices?: Array<{ name: string; color: ChoiceColor }>): ChoiceColor => choices?.find((c) => c.name === name)?.color ?? fallbackColor(name);

export function Avatar({ name, src, size = 24 }: { name: string; src?: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const style = { width: size, height: size, fontSize: Math.max(9, size * 0.4) } as CSSProperties;
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={s.avatar} style={style} /> : <span className={cn(s.avatar, s.avatarText)} style={style} aria-hidden>{initials || "?"}</span>;
}

export function Spinner() {
  return <span className={s.spinner} role="status" aria-label="Loading" />;
}
