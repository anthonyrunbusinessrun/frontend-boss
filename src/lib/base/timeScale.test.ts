import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PX_PER_DAY, computeRange, dateToX, durationDays, monthBands, packTracks, shiftBar, ticks, toBar } from "./timeScale";

describe("timeline date axis", () => {
  it("turns a start (and optional end) into an inclusive bar", () => {
    assert.deepEqual(toBar("a", "2026-07-06", null), { id: "a", start: "2026-07-06", end: "2026-07-06" });
    assert.deepEqual(toBar("a", "2026-07-06", "2026-07-09"), { id: "a", start: "2026-07-06", end: "2026-07-09" });
    assert.equal(durationDays(toBar("a", "2026-07-06", "2026-07-09")!), 4);
    assert.equal(toBar("a", "2026-07-06", "2026-07-01")!.end, "2026-07-06", "an end before the start becomes a one-day bar");
    assert.equal(toBar("a", null, "2026-07-01"), null);
    assert.equal(toBar("a", "not a date", null), null);
  });

  it("builds a range that always contains today and every bar", () => {
    const bars = [toBar("a", "2026-07-06", "2026-07-20")!];
    const r = computeRange(bars, "2026-10-28");
    assert.ok(r.from <= "2026-07-06" && r.to >= "2026-10-28");
    assert.ok(r.from.endsWith("-01"), "starts on a month boundary");
  });

  it("positions dates by pixels per day", () => {
    assert.equal(dateToX("2026-07-08", "2026-07-01", PX_PER_DAY.week), 7 * PX_PER_DAY.week);
  });

  it("packs overlapping bars onto separate tracks and reuses free ones", () => {
    const bars = [toBar("a", "2026-07-01", "2026-07-05")!, toBar("b", "2026-07-03", "2026-07-08")!, toBar("c", "2026-07-06", "2026-07-07")!];
    const { tracks, track } = packTracks(bars);
    assert.equal(tracks, 2);
    assert.notEqual(track.get("a"), track.get("b"));
    assert.equal(track.get("c"), track.get("a"), "c starts after a ends, so it reuses a's track");
    assert.equal(packTracks([]).tracks, 1);
  });

  it("moves a bar keeping its length, and resizes without inverting it", () => {
    const b = toBar("a", "2026-07-06", "2026-07-09")!;
    assert.deepEqual(shiftBar(b, "move", 3), { id: "a", start: "2026-07-09", end: "2026-07-12" });
    assert.deepEqual(shiftBar(b, "move", -6), { id: "a", start: "2026-06-30", end: "2026-07-03" });
    assert.equal(shiftBar(b, "resize", 2).end, "2026-07-11");
    assert.equal(shiftBar(b, "resize", -10).end, "2026-07-06", "end can never move before the start");
  });

  it("labels months and ticks for each zoom", () => {
    const bands = monthBands("2026-06-01", "2026-07-31", PX_PER_DAY.week);
    assert.deepEqual(bands.map((m) => m.key), ["2026-06", "2026-07"]);
    assert.equal(bands[0].width, 30 * PX_PER_DAY.week);
    assert.equal(ticks("2026-07-01", "2026-07-14", "day").length, 14);
    assert.deepEqual(ticks("2026-07-01", "2026-07-14", "week").map((t) => t.date), ["2026-07-06", "2026-07-13"], "Mondays");
    assert.equal(ticks("2026-06-15", "2026-08-15", "month").length, 2);
  });
});
