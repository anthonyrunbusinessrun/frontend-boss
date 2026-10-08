import type { RecordSet } from "@/types";

/**
 * Local persistence for record edits made in the BOSS views.
 *
 * Server-provided records (PostgreSQL or the checked-in seed) are never
 * mutated: edits are stored as a small "overlay" in localStorage and applied on
 * top when a view loads. Replacing this file with calls to the records API
 * (POST/PATCH/DELETE /api/records/:section) is the only change needed to
 * persist on the server; the Workspace talks to it through useRecordOverlay.
 */
export interface RecordOverlay<T> {
  created: Array<{ groupId: string; row: T }>;
  patched: Record<string, Partial<T>>;
  deleted: string[];
}

const KEY_PREFIX = "boss:records:v1:";

export function emptyOverlay<T>(): RecordOverlay<T> {
  return { created: [], patched: {}, deleted: [] };
}

export function isEmptyOverlay<T>(o: RecordOverlay<T>): boolean {
  return o.created.length === 0 && o.deleted.length === 0 && Object.keys(o.patched).length === 0;
}

export function loadOverlay<T>(section: string): RecordOverlay<T> {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + section);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<RecordOverlay<T>>;
    return { created: parsed.created ?? [], patched: parsed.patched ?? {}, deleted: parsed.deleted ?? [] };
  } catch {
    return emptyOverlay();
  }
}

export function saveOverlay<T>(section: string, overlay: RecordOverlay<T>): void {
  try {
    if (isEmptyOverlay(overlay)) window.localStorage.removeItem(KEY_PREFIX + section);
    else window.localStorage.setItem(KEY_PREFIX + section, JSON.stringify(overlay));
  } catch {
    /* storage unavailable (private mode / quota): edits last for this session only */
  }
}

/** Remove every locally stored BOSS edit (used by "Reset demo data"). */
export function clearAllOverlays(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function applyOverlay<T extends { id: string }>(data: RecordSet<T>, overlay: RecordOverlay<T>): RecordSet<T> {
  if (isEmptyOverlay(overlay)) return data;
  const deleted = new Set(overlay.deleted);
  const groupIds = new Set(data.groups.map((g) => g.id));
  const fallbackGroup = data.groups[0]?.id;

  const groups = data.groups.map((g) => {
    const kept = g.rows.filter((r) => !deleted.has(r.id)).map((r) => (overlay.patched[r.id] ? { ...r, ...overlay.patched[r.id] } : r));
    const added = overlay.created.filter((c) => (groupIds.has(c.groupId) ? c.groupId === g.id : g.id === fallbackGroup)).map((c) => c.row);
    const delta = added.length - (g.rows.length - kept.length);
    return { ...g, rows: [...kept, ...added], ...(g.count === undefined ? {} : { count: Math.max(0, g.count + delta) }) };
  });
  return { ...data, groups };
}
