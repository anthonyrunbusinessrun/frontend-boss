"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { applyOverlay, emptyOverlay, loadOverlay, saveOverlay, type RecordOverlay } from "@/services/localRecords";
import type { RecordSet } from "@/types";

/**
 * Client-side record store for one BOSS section: the server data plus local
 * create / update / delete. Without a `section` it returns the data untouched.
 */
export function useRecordOverlay<T extends { id: string }>(section: string | undefined, base: RecordSet<T>) {
  const [overlay, setOverlay] = useState<RecordOverlay<T>>(() => emptyOverlay<T>());
  const [ready, setReady] = useState(!section);

  useEffect(() => {
    if (!section) return;
    setOverlay(loadOverlay<T>(section));
    setReady(true);
  }, [section]);

  useEffect(() => {
    if (section && ready) saveOverlay(section, overlay);
  }, [section, ready, overlay]);

  const data = useMemo(() => (section ? applyOverlay(base, overlay) : base), [section, base, overlay]);

  const create = useCallback((groupId: string, row: T) => {
    setOverlay((o) => ({ ...o, created: [...o.created, { groupId, row }] }));
  }, []);

  const patch = useCallback((id: string, changes: Partial<T>) => {
    setOverlay((o) => {
      if (o.created.some((c) => c.row.id === id)) {
        return { ...o, created: o.created.map((c) => (c.row.id === id ? { ...c, row: { ...c.row, ...changes } } : c)) };
      }
      return { ...o, patched: { ...o.patched, [id]: { ...o.patched[id], ...changes } } };
    });
  }, []);

  /** Delete rows; returns a function that restores exactly those rows. */
  const remove = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      const removedCreated = overlay.created.filter((c) => idSet.has(c.row.id));
      const removedBase = ids.filter((id) => !removedCreated.some((c) => c.row.id === id));
      setOverlay((o) => ({ ...o, created: o.created.filter((c) => !idSet.has(c.row.id)), deleted: [...new Set([...o.deleted, ...removedBase])] }));
      return () =>
        setOverlay((o) => ({
          ...o,
          created: [...o.created, ...removedCreated],
          deleted: o.deleted.filter((id) => !removedBase.includes(id)),
        }));
    },
    [overlay.created],
  );

  /** Which group a row currently lives in (base rows and rows created locally). */
  const groupOf = useCallback(
    (id: string) => {
      const local = overlay.created.find((c) => c.row.id === id);
      if (local) return local.groupId;
      return base.groups.find((g) => g.rows.some((r) => r.id === id))?.id;
    },
    [base.groups, overlay.created],
  );

  return { data, ready, create, patch, remove, groupOf };
}
