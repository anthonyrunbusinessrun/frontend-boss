"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { applyGroups } from "@/lib/base/query";
import { PX_PER_DAY, dateToX, packTracks, type Zoom } from "@/lib/base/timeScale";
import { addDays } from "@/lib/dates";
import { missingSetup } from "@/lib/base/viewDefaults";
import { useTable } from "../TableProvider";
import s from "../base.module.css";
import { SetupNeeded } from "./SetupNeeded";
import { useTitle } from "./shared";
import { DraggableBar, TimeAxis, TimeGrid, useBarColor, useTimeData, ZoomControl } from "./timeShared";
import type { ViewProps } from "./types";

const LEFT = 170;
const TRACK_H = 30;

export function TimelineView({ rows, onOpen, onCreate, onAddField }: ViewProps) {
  const t = useTable();
  const title = useTitle();
  const color = useBarColor();
  const [zoom, setZoom] = useState<Zoom>("week");
  const data = useTimeData(rows);
  const setup = missingSetup("timeline", t.config, t.fields);

  const lanes = useMemo(() => {
    const groups = applyGroups(rows, t.config.groupBy.slice(0, 1), t.fields, t.linked);
    return groups.map((g) => ({ key: g.key, label: g.label, bars: data.bars.filter((b) => g.rows.some((r) => r.id === b.id)) }));
  }, [rows, t.config.groupBy, t.fields, t.linked, data.bars]);

  if (setup) return <SetupNeeded setup={setup} onAddField={onAddField} />;
  const { from, to } = data.range;
  const ppd = PX_PER_DAY[zoom];
  const width = dateToX(to, from, ppd) + ppd;
  const rowOf = new Map(rows.map((r) => [r.id, r]));

  return (
    <div className={s.timeWrap}>
      <div className={s.timeBar}>
        <ZoomControl zoom={zoom} onChange={setZoom} />
        <span className={s.muted}>Drag a bar to move it. Drag its right edge to change the end date.</span>
        <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={() => onCreate()}>Add record</Button>
      </div>
      <div className={s.timeScroll}>
        <div style={{ width: LEFT + width, position: "relative" }}>
          <div className={s.timeHeadRow}>
            <div className={s.timeLeft} style={{ width: LEFT }} />
            <TimeAxis from={from} to={to} zoom={zoom} />
          </div>
          {lanes.map((lane) => {
            // A bar too short to hold its label reserves room for it, so neighbours stack instead of overlapping.
            const reserved = lane.bars.map((b) => {
              const labelPx = Math.min(260, title(rowOf.get(b.id)!).length * 7 + 22);
              const days = Math.ceil(labelPx / ppd);
              const end = addDays(b.start, days - 1);
              return { ...b, end: end > b.end ? end : b.end };
            });
            const { tracks, track } = packTracks(reserved);
            const height = tracks * TRACK_H + 12;
            return (
              <div key={lane.key} className={s.lane} style={{ height }}>
                <div className={s.timeLeft} style={{ width: LEFT }} title={lane.label}>{lane.label || "All records"}</div>
                <div className={s.laneArea} style={{ width, height }}>
                  <TimeGrid from={from} to={to} zoom={zoom} height={height} />
                  {lane.bars.map((b) => {
                    const r = rowOf.get(b.id)!;
                    return <DraggableBar key={b.id} bar={b} from={from} zoom={zoom} label={title(r)} color={color(r)} top={(track.get(b.id) ?? 0) * TRACK_H + 6} canResize={!!t.config.endField} onOpen={() => onOpen(b.id)} />;
                  })}
                </div>
              </div>
            );
          })}
          {data.bars.length === 0 && <p className={s.timeEmpty}>No records have a start date yet. Open a record to add one, or drag in a new one with “Add record”.</p>}
        </div>
      </div>
      {data.undated.length > 0 && (
        <div className={s.undated}>
          <strong>{data.undated.length} without a start date:</strong>
          {data.undated.slice(0, 12).map((r) => (
            <button key={r.id} type="button" className={s.undatedChip} onClick={() => onOpen(r.id)}>{title(r)}</button>
          ))}
          {data.undated.length > 12 && <span className={s.muted}>+{data.undated.length - 12} more</span>}
        </div>
      )}
    </div>
  );
}
