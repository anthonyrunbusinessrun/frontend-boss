"use client";

import { Plus, SearchX, Table2, PanelRightOpen } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGlobalSearch } from "@/components/shell/SearchContext";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { tableSeed } from "@/lib/base/definitions";
import { activeFilterCount, queryRecords } from "@/lib/base/query";
import type { FieldType, TableBundle } from "@/lib/base/types";
import { viewTypeLabel } from "@/lib/base/viewDefaults";
import { cn } from "@/lib/cn";
import { AdjustStockModal } from "./items/AdjustStockModal";
import { FieldEditor } from "./FieldEditor";
import { ActiveFilters } from "./FilterPanel";
import { RecordEditor, type EditorState } from "./RecordEditor";
import { Sidebar } from "./Sidebar";
import { TableProvider, useTable } from "./TableProvider";
import { Toolbar } from "./Toolbar";
import { TABLE_UI, type HeaderAction } from "./tableUi";
import s from "./base.module.css";
import { Spinner } from "./ui";
import { ViewIcon } from "./viewIcons";
import { CalendarView } from "./views/CalendarView";
import { FormView } from "./views/FormView";
import { GalleryView } from "./views/GalleryView";
import { GanttView } from "./views/GanttView";
import { GridView } from "./views/GridView";
import { KanbanView } from "./views/KanbanView";
import { ListView } from "./views/ListView";
import { TimelineView } from "./views/TimelineView";
import { VoucherPanel } from "./vouchers/VoucherPanel";

export function TableApp({ bundle, initialViewId, initialRecordId }: { bundle: TableBundle; initialViewId?: string; initialRecordId?: string }) {
  return (
    <TableProvider initial={bundle} initialViewId={initialViewId}>
      <Workspace initialRecordId={initialRecordId} />
    </TableProvider>
  );
}

function Workspace({ initialRecordId }: { initialRecordId?: string }) {
  const t = useTable();
  const { query, setQuery } = useGlobalSearch();
  const ui = TABLE_UI[t.slug] ?? { actions: [] };
  const singular = tableSeed(t.slug)?.singular ?? "record";

  // A deep link (?record=) opens its drawer after mount: dialogs render in a portal, which must not exist during hydration.
  const [editor, setEditor] = useState<EditorState | null>(null);
  useEffect(() => {
    if (initialRecordId) setEditor({ mode: "view", recordId: initialRecordId });
  }, [initialRecordId]);
  const [fieldEditor, setFieldEditor] = useState<{ key?: string; type?: FieldType } | null>(null);
  const [stock, setStock] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  // Keep ?record=<id> in the address so a record can be linked to (the voucher QR code uses this).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (editor?.recordId && editor.mode === "view") url.searchParams.set("record", editor.recordId);
      else url.searchParams.delete("record");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [editor?.recordId, editor?.mode]);

  // Large tables: the server filters, searches and sorts; this page only asks again when those settings change.
  const { serverMode, queryServer } = t;
  const serverKey = JSON.stringify([t.config.filters, t.config.sort, query]);
  useEffect(() => {
    if (!serverMode || t.view.type === "form") return;
    const timer = setTimeout(() => void queryServer({ filters: t.config.filters, sort: t.config.sort, search: query }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMode, serverKey, t.view.id]);

  const rows = useMemo(() => (serverMode ? t.records : queryRecords(t.records, t.config, t.fields, query, t.linked)), [serverMode, t.records, t.config, t.fields, query, t.linked]);
  const totalRecords = serverMode ? t.recordCount : t.records.length;
  const matching = serverMode ? t.serverTotal : rows.length;
  const filtered = matching !== totalRecords;
  const filtersActive = activeFilterCount(t.config.filters, t.fields) > 0;

  const open = useCallback((id: string) => setEditor({ mode: "view", recordId: id }), []);
  const create = useCallback((preset?: Record<string, unknown>) => setEditor({ mode: "create", preset }), []);
  const addField = useCallback((type?: FieldType) => setFieldEditor({ type }), []);

  const runAction = (a: HeaderAction) => {
    if (a.kind === "create") setEditor({ mode: "create", preset: a.preset, fieldKeys: a.fieldKeys, title: a.title });
    else if (a.kind === "adjustStock") setStock(true);
    else if (a.kind === "voucherTools") setPanelOpen((o) => !o);
  };

  const viewProps = { rows, onOpen: open, onCreate: create, onEditField: (key: string) => setFieldEditor({ key }), onAddField: addField };

  const body = (() => {
    if (t.loading) return <div className={s.loading}><Spinner /> Loading…</div>;
    const type = t.view.type;
    if (type === "form") return <FormView />;
    if (totalRecords === 0 && type !== "grid")
      return (
        <EmptyState icon={<Table2 size={22} />} title={`No ${t.tableName.toLowerCase()} yet`} description={`Create your first ${singular} to see it in this ${viewTypeLabel(type).toLowerCase()} view.`}>
          <Button size="md" icon={<Plus size={14} />} onClick={() => create()}>New {singular}</Button>
        </EmptyState>
      );
    if (rows.length === 0 && totalRecords > 0 && !t.serverLoading)
      return (
        <EmptyState icon={<SearchX size={22} />} title={`No ${t.tableName.toLowerCase()} match`} description={filtersActive && query.trim() ? "No records match your search and the filters on this view." : filtersActive ? "No records match the filters on this view. Your records are untouched." : "No records match your search."}>
          {query.trim() && <Button variant="secondary" size="md" onClick={() => setQuery("")}>Clear search</Button>}
          {filtersActive && <Button variant="secondary" size="md" onClick={() => t.patchConfig({ filters: [] })}>Clear all filters</Button>}
        </EmptyState>
      );
    switch (type) {
      case "calendar": return <CalendarView {...viewProps} />;
      case "gallery": return <GalleryView {...viewProps} />;
      case "kanban": return <KanbanView {...viewProps} />;
      case "timeline": return <TimelineView {...viewProps} />;
      case "list": return <ListView {...viewProps} />;
      case "gantt": return <GanttView {...viewProps} />;
      default: return <GridView {...viewProps} />;
    }
  })();

  const activeKey = t.view.config.key;

  return (
    <div className={s.app}>
      <Sidebar onOpenRecord={open} />
      <main className={s.main}>
        <header className={s.mainHead}>
          <div className={s.titleBlock}>
            <h1 className={s.title}>
              <ViewIcon type={t.view.type} size={20} /> {t.view.name}
            </h1>
            <p className={s.subtitle}>
              {t.loading ? "Loading…" : `${filtered ? `${matching} of ${totalRecords}` : totalRecords} ${totalRecords === 1 ? singular : t.tableName.toLowerCase()}`}
              {t.view.access === "locked" && " · Locked view"}
              {t.view.access === "personal" && " · Personal view"}
              {ui.subtitle && t.view.type === "grid" && !filtered ? ` · ${ui.subtitle}` : ""}
            </p>
          </div>
          <div className={s.headActions} role="group" aria-label="Actions">
            {ui.actions.map((a) => (
              <Button key={a.id} size="md" variant={a.primary ? "primary" : "secondary"} icon={a.kind === "create" ? <Plus size={14} strokeWidth={2.5} /> : a.kind === "voucherTools" ? <PanelRightOpen size={14} /> : undefined} onClick={() => runAction(a)} aria-pressed={a.kind === "voucherTools" ? panelOpen : undefined}>
                {a.label}
              </Button>
            ))}
          </div>
        </header>

        {ui.areas && (
          <nav className={s.areas} aria-label="Capability areas">
            {ui.areas.map((a) => {
              const target = t.views.find((v) => v.config.key === a.viewKey);
              const count = t.records.filter(a.count).length;
              const on = activeKey === a.viewKey;
              return (
                <button key={a.viewKey} type="button" className={cn(s.area, on && s.areaOn)} aria-current={on ? "page" : undefined} disabled={!target} title={target ? a.description : `The “${a.label}” view was deleted`} onClick={() => target && t.selectView(target.id)}>
                  <span className={s.areaName}>{a.label}</span>
                  <span className={s.areaCount}>{count}</span>
                </button>
              );
            })}
          </nav>
        )}

        {t.unsaved && (
          <p className={s.notice} role="status">
            {t.view.access === "locked" ? "This view is locked. Filters and sorting you change here apply for this visit only." : "This is someone else’s personal view. Changes apply for this visit only."}
          </p>
        )}
        {t.view.type !== "form" && <Toolbar onAddField={addField} />}
        {t.view.type !== "form" && <ActiveFilters />}
        {query.trim() !== "" && t.view.type !== "form" && (
          <p className={s.searchNote} role="status">
            {matching === 0 ? "No results" : `${matching} result${matching === 1 ? "" : "s"}`} for “{query.trim()}”
            <button type="button" className={s.linkBtn} onClick={() => setQuery("")}>Clear</button>
          </p>
        )}
        <div className={s.contentRow}>
          <div className={cn(s.content, t.view.type === "grid" && s.contentGrid)}>
            {body}
            {serverMode && t.view.type !== "form" && (
              <div className={s.loadMore} role="status">
                <span>Showing {t.records.length} of {t.serverTotal} matching {t.tableName.toLowerCase()}{t.serverLoading ? " · loading…" : ""}</span>
                {t.records.length < t.serverTotal && (
                  <Button variant="secondary" size="sm" disabled={t.serverLoading} onClick={() => void queryServer({ filters: t.config.filters, sort: t.config.sort, search: query }, true)}>Load more</Button>
                )}
              </div>
            )}
          </div>
          {ui.panel === "voucher" && panelOpen && <VoucherPanel onClose={() => setPanelOpen(false)} focusId={editor?.recordId} />}
        </div>
      </main>

      {editor && <RecordEditor key={`${editor.mode}:${editor.recordId ?? "new"}:${editor.title ?? ""}`} state={editor} onChange={setEditor} onClose={() => setEditor(null)} />}
      {fieldEditor && <FieldEditor fieldKey={fieldEditor.key} initialType={fieldEditor.type} onClose={() => setFieldEditor(null)} />}
      {stock && <AdjustStockModal onClose={() => setStock(false)} />}
    </div>
  );
}
