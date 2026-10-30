"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Snapshot, SharedCommand } from "@/lib/shared-contract";

export function useSharedOperations(base = "/api/operations", enabled = true) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(-1),
    pending = useRef(false),
    alive = useRef(true),
    loading = useRef<Promise<void> | null>(null),
    queued = useRef(false);
  const refresh = useCallback(async () => {
    if (loading.current) {
      queued.current = true;
      return loading.current;
    }
    const work = (async () => {
      try {
        do {
          queued.current = false;
          const r = await fetch(base, { cache: "no-store" });
          const v = await r.json();
          if (!r.ok) throw new Error(v.error ?? "Load failed");
          if (alive.current && v.revision >= version.current) {
            version.current = v.revision;
            setSnapshot(v);
            setError("");
          }
        } while (queued.current && alive.current);
      } catch (e) {
        if (alive.current) {
          setError(e instanceof Error ? e.message : "Connection failed");
          setConnected(false);
        }
      } finally {
        loading.current = null;
      }
    })();
    loading.current = work;
    return work;
  }, [base]);
  useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    void refresh();
    const events = new EventSource(base + "/events");
    events.onmessage = (event) => {
      const v = JSON.parse(event.data);
      setConnected(true);
      if (v.revision > version.current) void refresh();
    };
    events.onerror = () => setConnected(false);
    events.addEventListener("unavailable", () => setConnected(false));
    const fallback = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      events.close();
      clearInterval(fallback);
      window.removeEventListener("focus", focus);
    };
  }, [base, enabled, refresh]);
  const dispatch = useCallback(
    async (command: SharedCommand) => {
      if (pending.current) throw new Error("Please wait for the current save");
      if (version.current < 0) throw new Error("Wait for shared data to load");
      pending.current = true;
      setBusy(true);
      setError("");
      const envelope = {
        commandId: crypto.randomUUID(),
        expectedRevision: version.current,
        command,
      };
      try {
        // Network/503 retry uses the SAME id; a committed request cannot apply twice.
        let response: Response | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await fetch(base, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(envelope),
            });
            if (response.status !== 503) break;
          } catch (e) {
            if (attempt === 1) throw e;
          }
        }
        if (!response) throw new Error("Connection failed");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Save failed");
        await refresh();
        return result as { message: string; value?: unknown; revision: number };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Save failed";
        setError(message);
        await refresh();
        throw new Error(message);
      } finally {
        pending.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [base, refresh],
  );
  return { snapshot, error, connected, busy, refresh, dispatch };
}
