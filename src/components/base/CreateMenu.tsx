"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ViewType } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { useTable } from "./TableProvider";
import s from "./base.module.css";
import { FloatingPanel } from "./ui";
import { ViewIcon, VIEW_COLOR } from "./viewIcons";

export type CreateKind = ViewType | "section";

interface Tile {
  kind: CreateKind;
  label: string;
  hint: string;
}

/** Short, plain descriptions: what you get, not how it works. */
const VIEW_TILES: Tile[] = [
  { kind: "grid", label: "Grid", hint: "Rows and columns" },
  { kind: "calendar", label: "Calendar", hint: "Records by date" },
  { kind: "gallery", label: "Gallery", hint: "Cards with images" },
  { kind: "kanban", label: "Kanban", hint: "Columns by status" },
  { kind: "timeline", label: "Timeline", hint: "Bars on a date axis" },
  { kind: "list", label: "List", hint: "Compact rows" },
  { kind: "gantt", label: "Gantt", hint: "Tasks and links" },
];
const COLLECT_TILE: Tile = { kind: "form", label: "Form", hint: "Collect new records" };
const SECTION_TILE: Tile = { kind: "section", label: "Section", hint: "Group views in the sidebar" };

function useNarrow(query = "(max-width: 640px)") {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

function TileButton({ tile, onPick, refCb }: { tile: Tile; onPick: (k: CreateKind) => void; refCb: (el: HTMLButtonElement | null) => void }) {
  const color = tile.kind === "section" ? "#94a3b8" : VIEW_COLOR[tile.kind];
  return (
    <button ref={refCb} type="button" role="menuitem" aria-label={tile.label} className={s.tile} style={{ "--tile": color } as React.CSSProperties} onClick={() => onPick(tile.kind)}>
      <span className={s.tileIcon} aria-hidden>
        <ViewIcon type={tile.kind} size={18} />
      </span>
      <span className={s.tileText}>
        <span className={s.tileName}>{tile.label}</span>
        <span className={s.tileHint}>{tile.hint}</span>
      </span>
    </button>
  );
}

function Launcher({ onPick, tableName }: { onPick: (k: CreateKind) => void; tableName: string }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const all = [...VIEW_TILES, COLLECT_TILE, SECTION_TILE];
  // Focus the first option once the panel is on screen (it is positioned a moment after it mounts).
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => refs.current[0]?.focus()));
    return () => cancelAnimationFrame(id);
  }, []);
  const focusAt = (i: number) => refs.current[(i + all.length) % all.length]?.focus();
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = refs.current.findIndex((el) => el === document.activeElement);
    const inGrid = i >= 0 && i < VIEW_TILES.length;
    if (e.key === "ArrowRight") { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusAt(inGrid && i + 2 < VIEW_TILES.length ? i + 2 : inGrid ? VIEW_TILES.length : i + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusAt(inGrid ? (i - 2 >= 0 ? i - 2 : all.length - 1) : i === VIEW_TILES.length ? VIEW_TILES.length - 1 : i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusAt(0); }
    else if (e.key === "End") { e.preventDefault(); focusAt(all.length - 1); }
  };
  return (
    <div className={s.launcher} role="menu" aria-label={`Create in ${tableName}`} onKeyDown={onKeyDown}>
      <p className={s.launcherHead}>
        Create in <strong>{tableName}</strong>
      </p>
      <p className={s.launcherGroup}>Views</p>
      <div className={s.tiles}>
        {VIEW_TILES.map((t, i) => (
          <TileButton key={t.kind} tile={t} onPick={onPick} refCb={(el) => { refs.current[i] = el; }} />
        ))}
      </div>
      <p className={s.launcherGroup}>Collect</p>
      <TileButton tile={COLLECT_TILE} onPick={onPick} refCb={(el) => { refs.current[VIEW_TILES.length] = el; }} />
      <p className={s.launcherGroup}>Organize</p>
      <TileButton tile={SECTION_TILE} onPick={onPick} refCb={(el) => { refs.current[VIEW_TILES.length + 1] = el; }} />
    </div>
  );
}

/** The sidebar's “Create” control: views, a form, or a section. Opens as a popover, or as a bottom sheet on small screens. */
export function CreateMenu({ onPick }: { onPick: (k: CreateKind) => void }) {
  const t = useTable();
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const pick = (k: CreateKind) => {
    setOpen(false);
    onPick(k);
  };

  useEffect(() => {
    if (!open || !narrow) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open, narrow, close]);

  return (
    <>
      <button ref={setAnchor} type="button" className={s.createTrigger} aria-label="Create new…" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={s.createPlus} aria-hidden>
          <Plus size={16} strokeWidth={2.75} />
        </span>
        <span className={s.createText}>
          <span className={s.createTitle}>Create</span>
          <span className={s.createSub}>view · form · section</span>
        </span>
        <ChevronDown size={14} className={cn(s.chev, open && s.chevFlip)} aria-hidden />
      </button>
      {narrow
        ? open &&
          createPortal(
            <div className={s.sheetBackdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
              <div className={s.sheet}>
                <div className={s.sheetGrip} aria-hidden />
                <Launcher onPick={pick} tableName={t.tableName} />
              </div>
            </div>,
            document.body,
          )
        : (
          <FloatingPanel anchor={anchor} open={open} onClose={close} width={372} maxHeight={640} className={s.launcherPanel}>
            <Launcher onPick={pick} tableName={t.tableName} />
          </FloatingPanel>
        )}
    </>
  );
}
