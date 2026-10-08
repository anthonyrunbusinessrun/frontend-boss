"use client";

import { ChevronUp, Info, SearchX, Table2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { FieldDef } from "@/components/popovers/fields";
import { RecordDrawer, type DrawerMode } from "@/components/records/RecordDrawer";
import { useRecordOverlay } from "@/components/records/useRecordOverlay";
import { Sidebar, type SidebarConfig } from "@/components/shell/Sidebar";
import { useGlobalSearch } from "@/components/shell/SearchContext";
import shell from "@/components/shell/shell.module.css";
import { DataTable, TableFooter, type DataTableProps } from "@/components/table/DataTable";
import { RecordActionsContext, type RecordActions } from "@/components/table/RecordContext";
import { computeView, isEvaluable, type FilterCondition, type SortRule } from "@/components/table/tableState";
import { themeToStyle } from "@/components/table/theme";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import type { RecordSet } from "@/types";
import styles from "./view.module.css";
import { ViewToolbar, type ToolbarConfig } from "./ViewToolbar";

/** Local create / edit / delete for a BOSS view (see services/localRecords.ts). */
export interface RecordsConfig<T> {
  /** Storage key; one per screen. */
  section: string;
  /** "profile", "voucher"… used in titles, buttons and messages. */
  singular: string;
  plural: string;
  /** Short human label of a row for confirmations and toasts. */
  label: (row: T) => string;
  /** Values of a brand-new row (everything except `id`; form fields overwrite them). */
  blank: (rows: T[]) => Omit<T, "id">;
}

export interface WorkspaceProps<T> {
  /** Sidebar of the screen. `null` when the surrounding layout renders its own (AIS). */
  sidebar: SidebarConfig | null;
  /** Called by the sidebar's "Create new …" button. Defaults to opening the new-record form. */
  onCta?: () => void;
  title: string;
  /** Title uses the softer #e2e8f0 colour (some screens). */
  titleLight?: boolean;
  /** Title font size (20 by default; the uppercase titles on Transactions / Items are 22). */
  titleSize?: number;
  /** Horizontal content padding (20 by default; the Items screen uses 25). */
  padX?: number;
  subtitle?: string;
  /** Dimmer subtitle colour (Items screen). */
  subtitleDim?: boolean;
  /** Right-aligned "Total: n Items Listed" badge slot. */
  titleAside?: ReactNode;
  toolbar: ToolbarConfig;
  fields: FieldDef[];
  /** Absolute y of the toolbar top, relative to the content area (measured per screen). */
  toolbarTop: number;
  /** Extra right inset of the toolbar's right cluster (the Profiles screen is drawn 33px narrower). */
  toolbarInsetRight?: number;
  /** Gap between toolbar and table (measured per screen). */
  tableGap: number;
  data: RecordSet<T>;
  table: Omit<DataTableProps<T>, "groups" | "collapsed" | "onToggleGroup" | "footer">;
  footer?: { placement: "inside" | "outside"; variant?: "plain" | "boxed"; text?: boolean };
  /** Rendered under the table (Vouchers legend panel). */
  after?: ReactNode;
  /** Enables the generic record drawer + local persistence (BOSS screens). */
  records?: RecordsConfig<T>;
  /** Row actions supplied by the page itself (AIS screens use their own drawers). */
  actions?: RecordActions;
  /** Rows per page. */
  pageSize?: number;
  loading?: boolean;
  /** Replaces the default empty state when the view has no records at all. */
  emptyState?: { title: string; description?: string; action?: ReactNode };
  /** Simplified toolbar for list pages: no Group / Color / Share cards. */
  simpleToolbar?: boolean;
  toolbarExtra?: ReactNode;
  /** Extra content between the toolbar and the table (quick filters, summary cards). */
  beforeTable?: ReactNode;
  /** Selected-row bulk delete (BOSS views). */
  bulkDelete?: boolean;
}

const DEFAULT_PAGE_SIZE = 25;

/**
 * One screen of the app below the tab bar: sidebar + title + toolbar + table (+ footer).
 * Owns the interactive state of the table: header search, sort, filter, hidden fields,
 * pagination, selection and the record drawer.
 */
export function Workspace<T>({
  sidebar,
  onCta,
  title,
  titleLight,
  titleSize,
  padX,
  subtitle,
  subtitleDim,
  titleAside,
  toolbar,
  fields,
  toolbarTop,
  toolbarInsetRight,
  tableGap,
  data: baseData,
  table,
  footer,
  after,
  records,
  actions: externalActions,
  pageSize = DEFAULT_PAGE_SIZE,
  loading,
  emptyState,
  simpleToolbar,
  toolbarExtra,
  beforeTable,
  bulkDelete,
}: WorkspaceProps<T>) {
  const toast = useToast();
  const { query: search, setQuery: setSearch } = useGlobalSearch();

  // ---- records (BOSS views): server data + local edits --------------------------------
  const store = useRecordOverlay<T & { id: string }>(records?.section, baseData as RecordSet<T & { id: string }>);
  const data = (records ? store.data : baseData) as RecordSet<T>;
  const idOf = useCallback((row: T) => table.rowKey(row), [table]);

  // ---- table view state -----------------------------------------------------------------
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortRule[]>([]);
  const [conditions, setConditions] = useState<FilterCondition[]>(() => toolbar.filter.initial ?? []);
  const [hiddenFields, setHiddenFields] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<Set<string>>(() => new Set(table.selection?.initial ?? []));
  const [selectionTouched, setSelectionTouched] = useState(false);

  useEffect(() => setPage(1), [search, sort, conditions]);

  const toggleGroup = useCallback(
    (id: string) =>
      setCollapsed((c) => {
        const next = new Set(c);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const collapseAll = useCallback(() => setCollapsed(new Set(data.groups.filter((g) => g.label !== undefined).map((g) => g.id))), [data.groups]);
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  const view = useMemo(() => computeView(data.groups, { fields, search, sort, conditions, page, pageSize }), [data.groups, fields, search, sort, conditions, page, pageSize]);

  const hiddenColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const f of fields) if (hiddenFields.has(f.name) && (f.column ?? f.key)) keys.add((f.column ?? f.key)!);
    return keys;
  }, [fields, hiddenFields]);

  // header click sorting: only columns that map to an evaluable field
  const columnField = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const f of fields) if (isEvaluable(f) && (f.column ?? f.key)) map.set((f.column ?? f.key)!, f);
    return map;
  }, [fields]);
  const sortableColumns = useMemo(() => new Set(columnField.keys()), [columnField]);
  const sortState = useMemo(() => {
    const first = sort[0];
    if (!first) return null;
    for (const [col, f] of columnField) if (f.name === first.field) return { column: col, dir: first.dir };
    return null;
  }, [sort, columnField]);
  const onSortColumn = useCallback(
    (column: string) => {
      const f = columnField.get(column);
      if (!f) return;
      setSort((rules) => {
        const current = rules[0];
        if (!current || current.field !== f.name) return [{ field: f.name, dir: "asc" }];
        if (current.dir === "asc") return [{ field: f.name, dir: "desc" }];
        return [];
      });
    },
    [columnField],
  );

  // ---- record drawer / delete -------------------------------------------------------------
  const [drawer, setDrawer] = useState<{ mode: DrawerMode; row: (T & { id: string }) | null; groupId?: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T[] | null>(null);

  const allRows = useMemo(() => data.groups.flatMap((g) => g.rows), [data.groups]);
  const rowById = useCallback((id: string) => allRows.find((r) => idOf(r) === id), [allRows, idOf]);

  const openCreate = useCallback((groupId?: string) => setDrawer({ mode: "create", row: null, groupId }), []);

  const recordActions = useMemo<RecordActions>(() => {
    if (externalActions) return externalActions;
    if (!records) return {};
    return {
      open: (row) => setDrawer({ mode: "view", row: row as T & { id: string } }),
      edit: (row) => setDrawer({ mode: "edit", row: row as T & { id: string } }),
      duplicate: (row) => setDrawer({ mode: "create", row: { ...(row as T & { id: string }), id: "" }, groupId: store.groupOf((row as T & { id: string }).id) }),
      remove: (row) => setPendingDelete([row as T]),
      add: (groupId) => openCreate(groupId),
    };
  }, [externalActions, records, store, openCreate]);

  const saveRecord = (values: Record<string, unknown>, groupId: string | undefined) => {
    if (!records || !drawer) return;
    if (drawer.mode === "edit" && drawer.row) {
      store.patch(drawer.row.id, values as Partial<T & { id: string }>);
      toast.success(`${capitalize(records.singular)} “${records.label({ ...drawer.row, ...values } as T)}” updated.`);
    } else {
      const base = drawer.row ? (({ id: _unused, ...rest }) => rest)(drawer.row) : records.blank(allRows);
      const row = { ...base, ...values, id: newId(records.section) } as T & { id: string };
      store.create(groupId ?? data.groups[0]?.id ?? "main", row);
      toast.success(`${capitalize(records.singular)} “${records.label(row)}” created.`);
    }
    setDrawer(null);
  };

  const confirmDelete = () => {
    if (!records || !pendingDelete) return;
    const ids = pendingDelete.map(idOf);
    const undo = store.remove(ids);
    setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
    toast.success(
      ids.length === 1 ? `${capitalize(records.singular)} “${records.label(pendingDelete[0])}” deleted.` : `${ids.length} ${records.plural} deleted.`,
      { label: "Undo", onClick: undo },
    );
    setPendingDelete(null);
    setDrawer(null);
  };

  // ---- footer / empty state -----------------------------------------------------------------
  const showFooter = !!footer || view.pages > 1 || view.filtered;
  const placement = footer?.placement ?? "outside";
  const footerNode = showFooter ? (
    <TableFooter inside={placement === "inside"}>
      <span>
        {`Showing ${view.from}-${view.to} of ${view.matched} records`}
        {view.filtered && <span className={styles.footMuted}>{` · filtered from ${view.total}`}</span>}
      </span>
      <Pagination page={view.page} pages={view.pages} onChange={setPage} variant={footer?.variant ?? "boxed"} />
    </TableFooter>
  ) : null;

  const noRecords = view.total === 0;
  const empty = loading ? undefined : noRecords ? (
    <EmptyState icon={<Table2 size={22} />} title={emptyState?.title ?? `No ${records?.plural ?? "records"} yet`} description={emptyState?.description ?? (records ? `Create your first ${records.singular} to get started.` : undefined)}>
      {emptyState?.action ?? (records && (
        <Button size="md" onClick={() => openCreate()}>
          Create {records.singular}
        </Button>
      ))}
    </EmptyState>
  ) : (
    <EmptyState icon={<SearchX size={22} />} title={`No ${records?.plural ?? "records"} match your ${search.trim() ? "search" : "filters"}`} description="Try a different search term, or remove a filter to see more records.">
      {search.trim() !== "" && (
        <Button variant="secondary" size="md" onClick={() => setSearch("")}>
          Clear search
        </Button>
      )}
      {conditions.length > 0 && (
        <Button variant="secondary" size="md" onClick={() => setConditions([])}>
          Clear filters
        </Button>
      )}
    </EmptyState>
  );

  // ---- selection bar -----------------------------------------------------------------------
  const onSelectedChange = useCallback((next: Set<string>) => {
    setSelectionTouched(true);
    setSelected(next);
  }, []);
  const selectedRows = useMemo(() => [...selected].map(rowById).filter((r): r is T => r !== undefined), [selected, rowById]);
  const showSelectionBar = selectionTouched && selectedRows.length > 0 && !!table.selection;

  const mainStyle = { "--toolbar-top": `${toolbarTop}px`, "--table-gap": `${tableGap}px`, "--pad-x": `${padX ?? 20}px`, "--toolbar-inset": `${toolbarInsetRight ?? 0}px` } as CSSProperties;

  const drawerRow = drawer?.row as Record<string, unknown> | null | undefined;

  return (
    <RecordActionsContext.Provider value={recordActions}>
      <div className={shell.workspace}>
        {sidebar && <Sidebar config={sidebar} onCta={onCta ?? (records ? () => openCreate() : undefined)} />}
        <main className={styles.main} style={mainStyle}>
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <h1 className={cn(styles.title, titleLight && styles.titleLight)} style={titleSize ? { fontSize: titleSize } : undefined}>
                {title}
              </h1>
              {subtitle && <p className={cn(styles.subtitle, subtitleDim && styles.subtitleDim)}>{subtitle}</p>}
            </div>
            <ViewToolbar
              config={toolbar}
              fields={fields}
              onCollapseAll={collapseAll}
              onExpandAll={expandAll}
              controls={{ sort, onSort: setSort, conditions, onConditions: setConditions, hidden: hiddenFields, onHidden: setHiddenFields, simple: simpleToolbar, extra: toolbarExtra }}
            />
          </div>
          {titleAside && <div className={styles.totalSlot}>{titleAside}</div>}
          <div className={styles.body} style={themeToStyle(table.theme)}>
            {beforeTable}
            {search.trim() !== "" && (
              <p className={styles.searchNote} role="status">
                {view.matched === 0 ? "No results" : `${view.matched} result${view.matched === 1 ? "" : "s"}`} for “{search.trim()}”
                <button type="button" className={styles.searchNoteClear} onClick={() => setSearch("")}>
                  Clear
                </button>
              </p>
            )}
            <DataTable<T>
              {...table}
              groups={view.groups}
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              hiddenColumns={hiddenColumns}
              selected={selected}
              onSelectedChange={onSelectedChange}
              sortableColumns={sortableColumns}
              sortState={sortState}
              onSortColumn={onSortColumn}
              onRowClick={recordActions.open ? (row) => recordActions.open?.(row) : undefined}
              empty={empty}
              loading={loading}
              indexOffset={(view.page - 1) * pageSize}
              footer={placement === "inside" ? footerNode : undefined}
            />
            {placement === "outside" && footerNode}
            {after && <div className={styles.after}>{after}</div>}
            {showSelectionBar && (
              <div className={styles.selectionBar} role="region" aria-label="Selected records">
                <span className={styles.selectionCount}>{selectedRows.length} selected</span>
                {records && (bulkDelete ?? true) && (
                  <Button variant="secondary" size="sm" icon={<Trash2 size={13} />} onClick={() => setPendingDelete(selectedRows)}>
                    Delete
                  </Button>
                )}
                <button type="button" className={styles.selectionClear} aria-label="Clear selection" onClick={() => setSelected(new Set())}>
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {records && drawer && (
        <RecordDrawer
          open
          mode={drawer.mode}
          singular={records.singular}
          rowLabel={drawerRow && drawer.mode !== "create" ? records.label(drawerRow as T) : drawer.mode === "create" && drawerRow ? `Copy of ${records.label(drawerRow as T)}` : undefined}
          row={drawerRow ?? null}
          fields={fields}
          groups={data.groups.filter((g) => g.label !== undefined).map((g) => ({ id: g.id, label: g.label ?? "" }))}
          groupId={drawer.groupId}
          onClose={() => setDrawer(null)}
          onEdit={() => setDrawer((d) => (d ? { ...d, mode: "edit" } : d))}
          onSave={saveRecord}
          onDelete={drawer.mode === "view" && drawer.row ? () => setPendingDelete([drawer.row as T]) : undefined}
          onDuplicate={drawer.mode === "view" && drawer.row ? () => recordActions.duplicate?.(drawer.row) : undefined}
        />
      )}
      {records && (
        <ConfirmDialog
          open={pendingDelete !== null}
          title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length} ${records.plural}?` : `Delete this ${records.singular}?`}
          message={
            pendingDelete && pendingDelete.length === 1 ? (
              <>
                <strong>{records.label(pendingDelete[0])}</strong> will be removed from this view. You can undo right after.
              </>
            ) : (
              <>The selected {records.plural} will be removed from this view. You can undo right after.</>
            )
          }
          confirmLabel="Delete"
          destructive
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </RecordActionsContext.Provider>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function newId(section: string) {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${section}-local-${rand}`;
}

/** Collapsible informational panel (Vouchers "Legend & System Notes"). */
export function LegendPanel({ title, entries }: { title: string; entries: { term: string; text: string }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className={styles.legend} aria-label={title}>
      <button type="button" className={styles.legendHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={styles.legendTitle}>
          <Info size={18} strokeWidth={1.75} aria-hidden />
          {title}
        </span>
        <ChevronUp size={18} className={cn(styles.chevFlip, !open && styles.chevDown)} aria-hidden />
      </button>
      {open && (
        <div className={styles.legendBody}>
          {entries.map((e) => (
            <div key={e.term} style={{ display: "contents" }}>
              <span className={styles.legendTerm}>{e.term}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
