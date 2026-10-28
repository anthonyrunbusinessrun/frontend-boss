"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { addDays, addMonths, diffDays, endOfMonth, monthLong, startOfMonth } from "@/lib/dates";
import { missingSetup } from "@/lib/base/viewDefaults";
import type { RecordRow } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";
import { SetupNeeded } from "./SetupNeeded";
import { useTitle } from "./shared";
import type { ViewProps } from "./types";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

const today = () => new Date().toISOString().slice(0, 10);
const dateOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

export function CalendarView({ rows, onOpen, onCreate, onAddField }: ViewProps) {
  const t = useTable();
  const toast = useToast();
  const title = useTitle();
  const [month, setMonth] = useState(() => startOfMonth(today()));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const setup = missingSetup("calendar", t.config, t.fields);
  const start = t.config.dateField;
  const end = t.config.endDateField;

  const days = useMemo(() => {
    const first = new Date(`${month}T00:00:00Z`).getUTCDay();
    const gridStart = addDays(month, -first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, RecordRow[]>();
    if (!start) return map;
    for (const r of rows) {
      const a = dateOf(r[start]);
      if (!a) continue;
      const b = end ? (dateOf(r[end]) ?? a) : a;
      const last = b < a ? a : b;
      const span = Math.min(diffDays(last, a), 60);
      for (let i = 0; i <= span; i += 1) {
        const d = addDays(a, i);
        map.set(d, [...(map.get(d) ?? []), r]);
      }
    }
    return map;
  }, [rows, start, end]);

  const undated = start ? rows.filter((r) => !dateOf(r[start])).length : 0;

  if (setup) return <SetupNeeded setup={setup} onAddField={onAddField} />;

  const move = async (id: string, to: string) => {
    const r = t.records.find((x) => x.id === id);
    if (!r || !start) return;
    const from = dateOf(r[start]);
    if (!from || from === to) return;
    const patch: Record<string, unknown> = { [start]: to };
    const e = end ? dateOf(r[end]) : null;
    if (end && e) patch[end] = addDays(e, diffDays(to, from)); // keep the duration
    try {
      await t.updateRecord(id, patch);
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  const now = today();
  return (
    <div className={s.calendar}>
      <div className={s.calHead}>
        <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(today()))}>Today</Button>
        <button type="button" className={s.iconBtn} aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft size={16} /></button>
        <button type="button" className={s.iconBtn} aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={16} /></button>
        <h2 className={s.calTitle} aria-live="polite">{monthLong(month)}</h2>
        {undated > 0 && <span className={s.muted}>{undated} record{undated === 1 ? " has" : "s have"} no date</span>}
      </div>
      <div className={s.calGrid} role="grid" aria-label={monthLong(month)}>
        {DOW.map((d) => <div key={d} className={s.calDow} role="columnheader">{d}</div>)}
        {days.map((d) => {
          const items = byDay.get(d) ?? [];
          const open = expanded === d;
          const shown = open ? items : items.slice(0, MAX_CHIPS);
          const outside = d < month || d > endOfMonth(month);
          return (
            <div
              key={d}
              role="gridcell"
              aria-label={d}
              className={cn(s.calDay, outside && s.calOutside, d === now && s.calToday, dragOver === d && s.calDrop)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(d); }}
              onDragLeave={() => setDragOver((c) => (c === d ? null : c))}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) void move(id, d); }}
            >
              <div className={s.calDayHead}>
                <span className={s.calNum}>{Number(d.slice(8))}</span>
                <button type="button" className={s.calAdd} aria-label={`Add record on ${d}`} onClick={() => start && onCreate({ [start]: d })}><Plus size={12} /></button>
              </div>
              {shown.map((r) => (
                <button key={r.id} type="button" draggable className={s.calChip} onDragStart={(e) => { e.dataTransfer.setData("text/plain", r.id); e.dataTransfer.effectAllowed = "move"; }} onClick={() => onOpen(r.id)} title={title(r)}>
                  {title(r)}
                </button>
              ))}
              {items.length > MAX_CHIPS && (
                <button type="button" className={s.calMore} onClick={() => setExpanded(open ? null : d)}>{open ? "Show less" : `+${items.length - MAX_CHIPS} more`}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
