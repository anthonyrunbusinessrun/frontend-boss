"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { fieldByKey } from "@/lib/base/fields";
import { applyNodes, buildTree, moveNode, treeToNodes, type DropTarget } from "@/lib/base/layout";
import { pruneConfig } from "@/lib/base/viewDefaults";
import type { AttachmentValue, FavoriteDef, FieldDef, FieldOptions, FilterRule, FormCategory, LinkedTable, RecordRow, SectionDef, SortRule, TableBundle, ViewAccess, ViewConfig, ViewDef, ViewType } from "@/lib/base/types";
import { api, ClientError, ensureSession } from "./client";

export interface TableApi {
  slug: string;
  tableName: string;
  userId: string | null;
  fields: FieldDef[];
  fieldMap: Map<string, FieldDef>;
  records: RecordRow[];
  views: ViewDef[];
  sections: SectionDef[];
  favorites: FavoriteDef[];
  linked: Record<string, LinkedTable>;
  loading: boolean;

  /** Large table: filtering, search and sorting happen on the server and `records` is the loaded page. */
  serverMode: boolean;
  /** Records in the table (all of them, even in server mode). */
  recordCount: number;
  /** Records matching the current server query. */
  serverTotal: number;
  serverLoading: boolean;
  queryServer: (q: { filters: FilterRule[]; sort: SortRule[]; search: string }, append?: boolean) => Promise<void>;

  view: ViewDef;
  /** View configuration including changes that could not be saved (locked or someone else's personal view). */
  config: ViewConfig;
  canEditView: (v: ViewDef) => boolean;
  /** True when the current view's settings changes are not being saved. */
  unsaved: boolean;
  selectView: (id: string) => void;
  patchConfig: (patch: Partial<ViewConfig> | ((c: ViewConfig) => Partial<ViewConfig>)) => void;

  createRecord: (values: Record<string, unknown>) => Promise<RecordRow>;
  updateRecord: (id: string, patch: Record<string, unknown>) => Promise<RecordRow>;
  deleteRecords: (ids: string[]) => Promise<{ deleted: number; unlinked: number }>;
  submitForm: (viewId: string, values: Record<string, unknown>) => Promise<RecordRow>;

  createField: (input: { name: string; type: FieldDef["type"]; options?: FieldOptions }) => Promise<FieldDef>;
  updateField: (key: string, input: { name?: string; options?: FieldOptions; required?: boolean }) => Promise<void>;
  deleteField: (key: string) => Promise<void>;

  createView: (input: { name: string; type: ViewType; access: ViewAccess; sectionId?: string | null; category?: FormCategory }) => Promise<ViewDef>;
  renameView: (id: string, name: string) => Promise<void>;
  setAccess: (id: string, access: ViewAccess) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  duplicateView: (id: string) => Promise<void>;

  createSection: (name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  move: (item: { kind: "view" | "section"; id: string }, target: DropTarget) => Promise<void>;

  isFavorite: (kind: "view" | "record", id: string) => boolean;
  toggleFavorite: (kind: "view" | "record", id: string) => Promise<void>;
  upload: (file: File | Blob, name?: string) => Promise<AttachmentValue>;
  refresh: () => Promise<void>;
  /** Replace a record with a fresh copy returned by the server (after a file upload or PDF generation). */
  applyRecord: (record: RecordRow) => void;
}

const Ctx = createContext<TableApi | null>(null);

export function useTable(): TableApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTable must be used inside <TableProvider>");
  return v;
}

const lastViewKey = (slug: string) => `boss:view:${slug}`;
const SAVE_DELAY = 250;

const canEdit = (v: ViewDef, userId: string | null) => v.access === "collaborative" || (v.access === "personal" && v.ownerId === userId);

export function messageOf(e: unknown): string {
  return e instanceof ClientError || e instanceof Error ? e.message : "Something went wrong.";
}

export function TableProvider({ initial, initialViewId, children }: { initial: TableBundle; initialViewId?: string; children: ReactNode }) {
  const toast = useToast();
  const slug = initial.table.slug;

  const [bundle, setBundle] = useState(initial);
  const [loading, setLoading] = useState(initial.userId === null);
  const [serverTotal, setServerTotal] = useState(initial.recordCount);
  const [serverLoading, setServerLoading] = useState(false);
  const lastQuery = useRef<{ filters: FilterRule[]; sort: SortRule[]; search: string } | null>(null);
  const queryToken = useRef(0);
  const [activeId, setActiveId] = useState<string | undefined>(() => (initialViewId && initial.views.some((v) => v.id === initialViewId) ? initialViewId : initial.views[0]?.id));
  // Settings changed in a view the person cannot edit: applied for this visit only.
  const [overrides, setOverrides] = useState<Record<string, ViewConfig>>({});

  const ref = useRef(bundle);
  useEffect(() => {
    ref.current = bundle;
  }, [bundle]);

  const patchBundle = useCallback((fn: (b: TableBundle) => Partial<TableBundle>) => {
    setBundle((b) => {
      const next = { ...b, ...fn(b) };
      ref.current = next;
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await api.bundle(slug);
    setBundle(fresh);
    ref.current = fresh;
    setActiveId((id) => (fresh.views.some((v) => v.id === id) ? id : fresh.views[0]?.id));
  }, [slug]);

  // First visit: the server rendered without a user. Create the session, then load the personal parts.
  useEffect(() => {
    if (initial.userId !== null) return;
    let alive = true;
    ensureSession()
      .then(() => api.bundle(slug))
      .then((fresh) => {
        if (!alive) return;
        setBundle(fresh);
        ref.current = fresh;
        setActiveId((id) => (fresh.views.some((v) => v.id === id) ? id : fresh.views[0]?.id));
      })
      .catch((e) => toast.error(messageOf(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the last opened view when the URL does not name one.
  useEffect(() => {
    if (initialViewId) return;
    try {
      const saved = window.localStorage.getItem(lastViewKey(slug));
      if (saved && ref.current.views.some((v) => v.id === saved)) setActiveId(saved);
    } catch {
      /* storage unavailable */
    }
  }, [slug, initialViewId]);

  const view = bundle.views.find((v) => v.id === activeId) ?? bundle.views[0];

  const selectView = useCallback(
    (id: string) => {
      setActiveId(id);
      try {
        window.localStorage.setItem(lastViewKey(slug), id);
        const url = new URL(window.location.href);
        url.searchParams.set("view", id);
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        /* ignore */
      }
    },
    [slug],
  );

  /* ---------------------------------------------------------------- view settings */

  const saves = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; config: ViewConfig }>());

  const flush = useCallback(
    async (id: string) => {
      const pending = saves.current.get(id);
      if (!pending) return;
      clearTimeout(pending.timer);
      saves.current.delete(id);
      try {
        await api.updateView(slug, id, { config: pending.config });
      } catch (e) {
        toast.error(`Couldn’t save the view settings. ${messageOf(e)}`);
      }
    },
    [slug, toast],
  );

  useEffect(() => {
    const pendingSaves = saves.current;
    const onHide = () => {
      for (const [id, p] of pendingSaves) {
        // keepalive lets the request outlive the page
        void fetch(`/api/base/tables/${slug}/views/${id}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json" }, body: JSON.stringify({ config: p.config }) });
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      for (const id of [...pendingSaves.keys()]) void flush(id);
    };
  }, [slug, flush]);

  const config: ViewConfig = overrides[view?.id] ?? view?.config;
  const editable = view ? canEdit(view, bundle.userId) : false;

  const patchConfig = useCallback(
    (patch: Partial<ViewConfig> | ((c: ViewConfig) => Partial<ViewConfig>)) => {
      const current = ref.current.views.find((v) => v.id === activeId);
      if (!current) return;
      const base = overrides[current.id] ?? current.config;
      const next: ViewConfig = { ...base, ...(typeof patch === "function" ? patch(base) : patch) };
      if (!canEdit(current, ref.current.userId)) {
        setOverrides((o) => ({ ...o, [current.id]: next }));
        return;
      }
      patchBundle((b) => ({ views: b.views.map((v) => (v.id === current.id ? { ...v, config: next } : v)) }));
      const prev = saves.current.get(current.id);
      if (prev) clearTimeout(prev.timer);
      saves.current.set(current.id, { config: next, timer: setTimeout(() => void flush(current.id), SAVE_DELAY) });
    },
    [activeId, overrides, patchBundle, flush],
  );

  /* ---------------------------------------------------------------------- records */

  const createRecord = useCallback(
    async (values: Record<string, unknown>) => {
      const rec = await api.createRecord(slug, values);
      patchBundle((b) => ({ records: [...b.records, rec], recordCount: b.recordCount + 1 }));
      setServerTotal((n) => n + 1);
      return rec;
    },
    [slug, patchBundle],
  );

  const updateRecord = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const before = ref.current.records.find((r) => r.id === id);
      if (before) patchBundle((b) => ({ records: b.records.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      try {
        const saved = await api.updateRecord(slug, id, patch);
        patchBundle((b) => ({ records: b.records.map((r) => (r.id === id ? saved : r)) }));
        return saved;
      } catch (e) {
        if (before) patchBundle((b) => ({ records: b.records.map((r) => (r.id === id ? before : r)) }));
        throw e;
      }
    },
    [slug, patchBundle],
  );

  const deleteRecords = useCallback(
    async (ids: string[]) => {
      const out = await api.deleteRecords(slug, ids);
      const gone = new Set(ids);
      patchBundle((b) => ({ records: b.records.filter((r) => !gone.has(r.id)), recordCount: Math.max(0, b.recordCount - out.deleted), favorites: b.favorites.filter((f) => !(f.kind === "record" && gone.has(f.refId))) }));
      setServerTotal((n) => Math.max(0, n - out.deleted));
      return out;
    },
    [slug, patchBundle],
  );

  const submitForm = useCallback(
    async (viewId: string, values: Record<string, unknown>) => {
      const rec = await api.submitForm(slug, viewId, values);
      patchBundle((b) => ({ records: [...b.records, rec], recordCount: b.recordCount + 1 }));
      return rec;
    },
    [slug, patchBundle],
  );

  /* ----------------------------------------------------------------------- fields */

  const createField = useCallback(
    async (input: { name: string; type: FieldDef["type"]; options?: FieldOptions }) => {
      const f = await api.createField(slug, input);
      await refresh(); // link fields bring in the linked table's records
      return f;
    },
    [slug, refresh],
  );

  const updateField = useCallback(
    async (key: string, input: { name?: string; options?: FieldOptions; required?: boolean }) => {
      await api.updateField(slug, key, input);
      await refresh(); // renaming an option rewrites stored values
    },
    [slug, refresh],
  );

  const deleteField = useCallback(
    async (key: string) => {
      await api.deleteField(slug, key);
      patchBundle((b) => {
        const fields = b.fields.filter((f) => f.key !== key);
        return { fields, views: b.views.map((v) => ({ ...v, config: pruneConfig(v.config, fields) })) };
      });
    },
    [slug, patchBundle],
  );

  /* ------------------------------------------------------------------------ views */

  const createView = useCallback(
    async (input: { name: string; type: ViewType; access: ViewAccess; sectionId?: string | null; category?: FormCategory }) => {
      const v = await api.createView(slug, input);
      patchBundle((b) => ({ views: [...b.views, v] }));
      selectView(v.id);
      return v;
    },
    [slug, patchBundle, selectView],
  );

  const replaceView = useCallback((v: ViewDef) => patchBundle((b) => ({ views: b.views.map((x) => (x.id === v.id ? v : x)) })), [patchBundle]);

  const renameView = useCallback(async (id: string, name: string) => replaceView(await api.updateView(slug, id, { name })), [slug, replaceView]);
  const setAccess = useCallback(async (id: string, access: ViewAccess) => replaceView(await api.updateView(slug, id, { access })), [slug, replaceView]);

  const deleteView = useCallback(
    async (id: string) => {
      await flush(id);
      await api.deleteView(slug, id);
      patchBundle((b) => ({ views: b.views.filter((v) => v.id !== id), favorites: b.favorites.filter((f) => !(f.kind === "view" && f.refId === id)) }));
      setActiveId((cur) => (cur === id ? ref.current.views.find((v) => v.id !== id)?.id : cur));
    },
    [slug, patchBundle, flush],
  );

  const duplicateView = useCallback(
    async (id: string) => {
      await flush(id);
      const v = await api.duplicateView(slug, id);
      // the server shifts neighbours to make room: reload positions
      await refresh();
      selectView(v.id);
    },
    [slug, flush, refresh, selectView],
  );

  /* ----------------------------------------------------------- sections and layout */

  const createSection = useCallback(
    async (name: string) => {
      const s = await api.createSection(slug, name);
      patchBundle((b) => ({ sections: [...b.sections, s] }));
    },
    [slug, patchBundle],
  );
  const renameSection = useCallback(
    async (id: string, name: string) => {
      const s = await api.renameSection(slug, id, name);
      patchBundle((b) => ({ sections: b.sections.map((x) => (x.id === id ? s : x)) }));
    },
    [slug, patchBundle],
  );
  const deleteSection = useCallback(
    async (id: string) => {
      await api.deleteSection(slug, id);
      await refresh(); // views moved back to the root with new positions
    },
    [slug, refresh],
  );

  const move = useCallback(
    async (item: { kind: "view" | "section"; id: string }, target: DropTarget) => {
      const cur = ref.current;
      const tree = buildTree(cur.views, cur.sections);
      const next = moveNode(tree, item, target);
      if (!next) return;
      const nodes = treeToNodes(next);
      const before = { views: cur.views, sections: cur.sections };
      const applied = applyNodes(cur.views, cur.sections, nodes);
      patchBundle(() => applied);
      try {
        await api.layout(slug, nodes);
      } catch (e) {
        patchBundle(() => before);
        throw e;
      }
    },
    [slug, patchBundle],
  );

  /* -------------------------------------------------------------------- favorites */

  const isFavorite = useCallback((kind: "view" | "record", id: string) => bundle.favorites.some((f) => f.kind === kind && f.refId === id), [bundle.favorites]);

  const toggleFavorite = useCallback(
    async (kind: "view" | "record", id: string) => {
      const was = ref.current.favorites.some((f) => f.kind === kind && f.refId === id);
      const before = ref.current.favorites;
      patchBundle((b) => ({ favorites: was ? b.favorites.filter((f) => !(f.kind === kind && f.refId === id)) : [...b.favorites, { kind, refId: id, position: b.favorites.length }] }));
      try {
        await api.setFavorite(slug, kind, id, !was);
      } catch (e) {
        patchBundle(() => ({ favorites: before }));
        throw e;
      }
    },
    [slug, patchBundle],
  );

  const upload = useCallback((file: File | Blob, name?: string) => api.upload(file, name), []);
  const applyRecord = useCallback((rec: RecordRow) => patchBundle((b) => ({ records: b.records.some((r) => r.id === rec.id) ? b.records.map((r) => (r.id === rec.id ? rec : r)) : [...b.records, rec] })), [patchBundle]);

  const queryServer = useCallback(
    async (q: { filters: FilterRule[]; sort: SortRule[]; search: string }, append = false) => {
      const token = (queryToken.current += 1);
      setServerLoading(true);
      try {
        const offset = append ? ref.current.records.length : 0;
        const res = await api.query(slug, { ...q, limit: ref.current.serverPage, offset });
        if (token !== queryToken.current) return; // a newer query superseded this one
        lastQuery.current = q;
        patchBundle((b) => ({ records: append ? [...b.records, ...res.records] : res.records }));
        setServerTotal(res.total);
      } catch (e) {
        if (token === queryToken.current) toast.error(messageOf(e));
      } finally {
        if (token === queryToken.current) setServerLoading(false);
      }
    },
    [slug, patchBundle, toast],
  );

  const value = useMemo<TableApi>(
    () => ({
      slug,
      tableName: bundle.table.name,
      userId: bundle.userId,
      fields: bundle.fields,
      fieldMap: fieldByKey(bundle.fields),
      records: bundle.records,
      views: bundle.views,
      sections: bundle.sections,
      favorites: bundle.favorites,
      linked: bundle.linked,
      loading,
      serverMode: bundle.serverMode,
      recordCount: bundle.recordCount,
      serverTotal,
      serverLoading,
      queryServer,
      view,
      config,
      canEditView: (v) => canEdit(v, bundle.userId),
      unsaved: !editable,
      selectView,
      patchConfig,
      createRecord,
      updateRecord,
      deleteRecords,
      submitForm,
      createField,
      updateField,
      deleteField,
      createView,
      renameView,
      setAccess,
      deleteView,
      duplicateView,
      createSection,
      renameSection,
      deleteSection,
      move,
      isFavorite,
      toggleFavorite,
      upload,
      refresh,
      applyRecord,
    }),
    [slug, bundle, loading, serverTotal, serverLoading, queryServer, view, config, editable, selectView, patchConfig, createRecord, updateRecord, deleteRecords, submitForm, createField, updateField, deleteField, createView, renameView, setAccess, deleteView, duplicateView, createSection, renameSection, deleteSection, move, isFavorite, toggleFavorite, upload, refresh, applyRecord],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
