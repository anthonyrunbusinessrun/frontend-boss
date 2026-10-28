"use client";

import { useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { addDays } from "@/lib/dates";
import { PX_PER_DAY, computeRange, dateToX, monthBands, shiftBar, ticks, toBar, type Bar, type Zoom } from "@/lib/base/timeScale";
import type { RecordRow } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { colorOf } from "../ui";
import { CHOICE_TONES } from "@/lib/base/fields";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Bars, undated records and the visible date range for the current view settings. */
export function useTimeData(rows: RecordRow[]) {
  const t = useTable();
  const { startField, endField } = t.config;
  return useMemo(() => {
    const bars: Bar[] = [];
    const undated: RecordRow[] = [];
    for (const r of rows) {
      const b = startField ? toBar(r.id, r[startField], endField ? r[endField] : null) : null;
      if (b) bars.push(b);
      else undated.push(r);
    }
    return { bars, undated, range: computeRange(bars, todayIso()) };
  }, [rows, startField, endField]);
}

export function TimeAxis({ from, to, zoom }: { from: string; to: string; zoom: Zoom }) {
  const ppd = PX_PER_DAY[zoom];
  const months = useMemo(() => monthBands(from, to, ppd), [from, to, ppd]);
  const tks = useMemo(() => ticks(from, to, zoom), [from, to, zoom]);
  return (
    <div className={s.axis} style={{ width: dateToX(to, from, ppd) + ppd }}>
      <div className={s.axisMonths}>
        {months.map((m) => (
          <span key={m.key} className={s.axisMonth} style={{ left: m.x, width: m.width }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className={s.axisTicks}>
        {tks.map((k) => (
          <span key={k.date} className={s.axisTick} style={{ left: k.x }}>
            {k.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Vertical gridlines + today marker behind the bars. */
export function TimeGrid({ from, to, zoom, height }: { from: string; to: string; zoom: Zoom; height: number | string }) {
  const ppd = PX_PER_DAY[zoom];
  const today = todayIso();
  const tks = useMemo(() => ticks(from, to, zoom), [from, to, zoom]);
  return (
    <div className={s.gridLines} style={{ width: dateToX(to, from, ppd) + ppd, height }} aria-hidden>
      {tks.map((k) => (
        <span key={k.date} className={s.gridLine} style={{ left: k.x }} />
      ))}
      {today >= from && today <= to && <span className={s.todayLine} style={{ left: dateToX(today, from, ppd) + ppd / 2 }} />}
    </div>
  );
}

/** A bar that can be dragged to move it, or by its right edge to change its end date. */
export function DraggableBar({ bar, from, zoom, label, color, top, onOpen, canResize, title }: { bar: Bar; from: string; zoom: Zoom; label: string; color?: string; top: number; onOpen: () => void; canResize: boolean; title?: string }) {
  const t = useTable();
  const toast = useToast();
  const ppd = PX_PER_DAY[zoom];
  const [drag, setDrag] = useState<{ mode: "move" | "resize"; days: number } | null>(null);
  const moved = useRef(false);
  const shown = drag ? shiftBar(bar, drag.mode, drag.days) : bar;
  const left = dateToX(shown.start, from, ppd);
  const width = Math.max(ppd, dateToX(addDays(shown.end, 1), from, ppd) - left);
  const editable = t.fields.some((f) => f.key === t.config.startField);

  const begin = (e: React.PointerEvent, mode: "move" | "resize") => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    moved.current = false;
    let days = 0;
    const move = (ev: PointerEvent) => {
      days = Math.round((ev.clientX - x0) / ppd);
      if (days !== 0) moved.current = true;
      setDrag({ mode, days });
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (days === 0) return;
      const next = shiftBar(bar, mode, days);
      const patch: Record<string, unknown> = {};
      const { startField, endField } = t.config;
      if (startField && next.start !== bar.start) patch[startField] = next.start;
      if (endField && (next.end !== bar.end || mode === "move")) patch[endField] = next.end;
      else if (!endField && mode === "resize") return;
      if (Object.keys(patch).length === 0) return;
      try {
        await t.updateRecord(bar.id, patch);
      } catch (err) {
        toast.error(`Couldn’t change the dates. ${messageOf(err)}`);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(s.bar, drag && s.barDragging, width < 90 && s.barShort)}
      style={{ left, width, top, background: color ?? undefined }}
      title={title ?? label}
      aria-label={`${label}, ${shown.start} to ${shown.end}. Press Enter to open.`}
      onPointerDown={(e) => begin(e, "move")}
      onClick={() => { if (!moved.current) onOpen(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen();
      }}
    >
      <span className={s.barLabel}>{label}</span>
      {canResize && editable && <span className={s.barHandle} aria-hidden onPointerDown={(e) => begin(e, "resize")} />}
    </div>
  );
}

export function useBarColor() {
  const t = useTable();
  const f = t.config.colorField ? t.fieldMap.get(t.config.colorField) : undefined;
  return (r: RecordRow): string | undefined => {
    if (!f) return undefined;
    const v = r[f.key];
    return typeof v === "string" && v ? CHOICE_TONES[colorOf(v, f.options.choices)].border : undefined;
  };
}

export function ZoomControl({ zoom, onChange }: { zoom: Zoom; onChange: (z: Zoom) => void }) {
  return (
    <div className={s.segmented} role="group" aria-label="Zoom">
      {(["day", "week", "month"] as const).map((z) => (
        <button key={z} type="button" aria-pressed={zoom === z} className={cn(s.segBtn, zoom === z && s.segBtnOn)} onClick={() => onChange(z)}>
          {z[0].toUpperCase() + z.slice(1)}
        </button>
      ))}
    </div>
  );
}
