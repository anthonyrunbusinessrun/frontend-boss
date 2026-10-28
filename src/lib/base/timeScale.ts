import { addDays, diffDays, endOfMonth, monthLong, monthKey, startOfMonth } from "@/lib/dates";

/** Pure date-axis maths shared by the Timeline and Gantt views. */
export type Zoom = "day" | "week" | "month";
export const PX_PER_DAY: Record<Zoom, number> = { day: 36, week: 14, month: 5 };

export interface Bar {
  id: string;
  /** inclusive */
  start: string;
  /** inclusive; equals `start` for single-day items */
  end: string;
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);

/** A record becomes a bar when it has a start date. A missing or earlier end date means a one-day bar. */
export function toBar(id: string, startValue: unknown, endValue: unknown): Bar | null {
  if (!isDate(startValue)) return null;
  const start = startValue.slice(0, 10);
  const end = isDate(endValue) && endValue.slice(0, 10) >= start ? endValue.slice(0, 10) : start;
  return { id, start, end };
}

export const durationDays = (b: Bar) => diffDays(b.end, b.start) + 1;

export function computeRange(bars: Bar[], today: string, padDays = 7): { from: string; to: string } {
  const starts = bars.map((b) => b.start);
  const ends = bars.map((b) => b.end);
  const min = [today, ...starts].reduce((a, b) => (a < b ? a : b));
  const max = [today, ...ends].reduce((a, b) => (a > b ? a : b));
  const from = startOfMonth(addDays(min, -padDays));
  const to = endOfMonth(addDays(max, padDays + 14));
  return { from, to };
}

export const dateToX = (date: string, from: string, ppd: number) => diffDays(date, from) * ppd;

/** Greedy interval packing: bars that do not overlap share a track. */
export function packTracks(bars: Bar[]): { tracks: number; track: Map<string, number> } {
  const sorted = [...bars].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const ends: string[] = [];
  const track = new Map<string, number>();
  for (const b of sorted) {
    let t = ends.findIndex((e) => e < b.start);
    if (t < 0) {
      t = ends.length;
      ends.push(b.end);
    } else ends[t] = b.end;
    track.set(b.id, t);
  }
  return { tracks: Math.max(1, ends.length), track };
}

export interface MonthBand {
  key: string;
  label: string;
  x: number;
  width: number;
}

export function monthBands(from: string, to: string, ppd: number): MonthBand[] {
  const out: MonthBand[] = [];
  let cur = startOfMonth(from);
  while (cur <= to) {
    const end = endOfMonth(cur);
    out.push({ key: monthKey(cur), label: monthLong(monthKey(cur)), x: dateToX(cur, from, ppd), width: (diffDays(end, cur) + 1) * ppd });
    cur = addDays(end, 1);
  }
  return out;
}

export interface Tick {
  date: string;
  x: number;
  label: string;
}

/** One tick per day, per week (Mondays) or per month, depending on the zoom. */
export function ticks(from: string, to: string, zoom: Zoom): Tick[] {
  const ppd = PX_PER_DAY[zoom];
  const out: Tick[] = [];
  const total = diffDays(to, from);
  for (let i = 0; i <= total; i += 1) {
    const d = addDays(from, i);
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (zoom === "day") out.push({ date: d, x: i * ppd, label: String(Number(d.slice(8))) });
    else if (zoom === "week" && dow === 1) out.push({ date: d, x: i * ppd, label: String(Number(d.slice(8))) });
    else if (zoom === "month" && d.endsWith("-01")) out.push({ date: d, x: i * ppd, label: "" });
  }
  return out;
}

/** Move/resize a bar by whole days. Resizing never makes the end earlier than the start. */
export function shiftBar(b: Bar, mode: "move" | "resize", days: number): Bar {
  if (mode === "move") return { ...b, start: addDays(b.start, days), end: addDays(b.end, days) };
  const end = addDays(b.end, days);
  return { ...b, end: end < b.start ? b.start : end };
}
