"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { linkIds } from "@/lib/base/compute";
import { PX_PER_DAY, dateToX, durationDays, type Zoom } from "@/lib/base/timeScale";
import { missingSetup } from "@/lib/base/viewDefaults";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/dates";
import { useTable } from "../TableProvider";
import s from "../base.module.css";
import { SetupNeeded } from "./SetupNeeded";
import { useTitle } from "./shared";
import { DraggableBar, TimeAxis, TimeGrid, useBarColor, useTimeData, ZoomControl } from "./timeShared";
import type { ViewProps } from "./types";

const LEFT = 400;
const ROW = 38;

export function GanttView({ rows, onOpen, onCreate, onAddField }: ViewProps) {
  const t = useTable();
  const title = useTitle();
  const color = useBarColor();
  const [zoom, setZoom] = useState<Zoom>("week");
  const data = useTimeData(rows);
  const setup = missingSetup("gantt", t.config, t.fields);

  // Tasks with dates first, in start order unless the view has its own sort.
  const tasks = useMemo(() => {
    const byId = new Map(data.bars.map((b) => [b.id, b]));
    const list = rows.filter((r) => byId.has(r.id)).map((r) => ({ row: r, bar: byId.get(r.id)! }));
    if (t.config.sort.length === 0) list.sort((a, b) => a.bar.start.localeCompare(b.bar.start) || a.bar.end.localeCompare(b.bar.end));
    return list;
  }, [rows, data.bars, t.config.sort.length]);

  if (setup) return <SetupNeeded setup={setup} onAddField={onAddField} />;
  const { from, to } = data.range;
  const ppd = PX_PER_DAY[zoom];
  const width = dateToX(to, from, ppd) + ppd;
  const height = tasks.length * ROW;
  const depField = t.config.dependencyField && t.fieldMap.get(t.config.dependencyField);
  const index = new Map(tasks.map((x, i) => [x.row.id, i]));
  const barOf = new Map(tasks.map((x) => [x.row.id, x.bar]));

  // An arrow runs from the end of each predecessor to the start of the task that depends on it.
  const arrows = depField
    ? tasks.flatMap(({ row, bar }, i) =>
        linkIds(row[depField.key]).flatMap((pid) => {
          const pb = barOf.get(pid);
          const pi = index.get(pid);
          if (!pb || pi === undefined) return [];
          const x1 = dateToX(addDays(pb.end, 1), from, ppd);
          const y1 = pi * ROW + ROW / 2;
          const x2 = dateToX(bar.start, from, ppd);
          const y2 = i * ROW + ROW / 2;
          const mid = Math.max(x1 + 8, x2 - 8);
          const late = pb.end >= bar.start; // predecessor ends after this task starts
          return [{ id: `${pid}>${row.id}`, d: `M${x1},${y1} H${mid} V${y2} H${x2 - 2}`, late }];
        }),
      )
    : [];

  return (
    <div className={s.timeWrap}>
      <div className={s.timeBar}>
        <ZoomControl zoom={zoom} onChange={setZoom} />
        <span className={s.muted}>{depField ? `Arrows show “${depField.name}”. Red arrows start before the task they depend on ends.` : "Choose a dependency field under Customize to draw dependencies."}</span>
        <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => onCreate()}>Add task</Button>
      </div>
      <div className={s.timeScroll}>
        <div style={{ width: LEFT + width, position: "relative" }}>
          <div className={s.timeHeadRow}>
            <div className={s.ganttLeftHead} style={{ width: LEFT }}>
              <span style={{ flex: 1 }}>Task</span><span className={s.ganttCol}>Start</span><span className={s.ganttCol}>End</span><span className={s.ganttDays}>Days</span>
            </div>
            <TimeAxis from={from} to={to} zoom={zoom} />
          </div>
          <div className={s.ganttBody}>
            <div className={s.ganttLeft} style={{ width: LEFT }}>
              {tasks.map(({ row, bar }) => (
                <button key={row.id} type="button" className={s.ganttRow} style={{ height: ROW }} onClick={() => onOpen(row.id)}>
                  <span className={s.ganttTitle}>{title(row)}</span>
                  <span className={s.ganttCol}>{formatDate(bar.start)}</span>
                  <span className={s.ganttCol}>{formatDate(bar.end)}</span>
                  <span className={s.ganttDays}>{durationDays(bar)}</span>
                </button>
              ))}
            </div>
            <div className={s.ganttChart} style={{ width, height }}>
              <TimeGrid from={from} to={to} zoom={zoom} height={height} />
              {tasks.map(({ row, bar }, i) => <span key={row.id} className={s.ganttStripe} style={{ top: i * ROW, height: ROW }} aria-hidden />)}
              <svg className={s.arrows} width={width} height={height} aria-hidden>
                <defs>
                  <marker id="arrow-ok" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#7be9f5" /></marker>
                  <marker id="arrow-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ff8ea3" /></marker>
                </defs>
                {arrows.map((a) => <path key={a.id} d={a.d} fill="none" stroke={a.late ? "#ff8ea3" : "#7be9f5"} strokeWidth="1.5" markerEnd={`url(#arrow-${a.late ? "late" : "ok"})`} />)}
              </svg>
              {tasks.map(({ row, bar }, i) => <DraggableBar key={row.id} bar={bar} from={from} zoom={zoom} label={title(row)} color={color(row)} top={i * ROW + 7} canResize={!!t.config.endField} onOpen={() => onOpen(row.id)} title={`${title(row)} · ${durationDays(bar)} day${durationDays(bar) === 1 ? "" : "s"}`} />)}
            </div>
          </div>
          {tasks.length === 0 && <p className={s.timeEmpty}>No tasks have a start date yet.</p>}
        </div>
      </div>
      {data.undated.length > 0 && (
        <div className={s.undated}>
          <strong>{data.undated.length} without a start date:</strong>
          {data.undated.slice(0, 12).map((r) => <button key={r.id} type="button" className={s.undatedChip} onClick={() => onOpen(r.id)}>{title(r)}</button>)}
        </div>
      )}
    </div>
  );
}
