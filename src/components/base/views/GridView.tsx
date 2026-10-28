"use client";

import { ArrowDownAZ, ArrowUpAZ, ChevronDown, EyeOff, Layers, Maximize2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { applyGroups, visibleFields, type RowGroup } from "@/lib/base/query";
import { isUserEditable } from "@/lib/base/fields";
import { hasErrors, validateRecordInput } from "@/lib/base/validate";
import type { FieldDef, RecordRow } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { CellValue } from "../cells";
import { FieldTypeIcon } from "../fieldIcons";
import { FieldInput } from "../inputs";
import { messageOf, useTable } from "../TableProvider";
import { FloatingPanel } from "../ui";
import s from "../base.module.css";
import type { ViewProps } from "./types";

const DEFAULT_WIDTH: Record<string, number> = { checkbox: 90, number: 120, autonumber: 100, date: 140, longText: 320, attachment: 180, singleSelect: 160, multiSelect: 220, link: 190, computed: 150, email: 220, url: 220, phone: 150, text: 200 };
const PAGE = 200;
const INLINE_TYPES = new Set(["text", "number", "date", "email", "url", "phone"]);

type Item = { kind: "group"; group: RowGroup; collapsed: boolean } | { kind: "row"; row: RecordRow; index: number };

function flatten(groups: RowGroup[], collapsed: Set<string>, out: Item[] = [], counter = { n: 0 }): Item[] {
  for (const g of groups) {
    if (g.label === "" && g.key === "all") {
      for (const row of g.rows) out.push({ kind: "row", row, index: counter.n++ });
      continue;
    }
    const isCollapsed = collapsed.has(g.key);
    out.push({ kind: "group", group: g, collapsed: isCollapsed });
    if (isCollapsed) continue;
    if (g.children) flatten(g.children, collapsed, out, counter);
    else for (const row of g.rows) out.push({ kind: "row", row, index: counter.n++ });
  }
  return out;
}

/** Cell editor: simple types edit in place, richer types (links, tags, long text, files) in a panel. */
function CellEditor({ field, row, anchor, onDone }: { field: FieldDef; row: RecordRow; anchor: HTMLElement | null; onDone: () => void }) {
  const t = useTable();
  const toast = useToast();
  const [value, setValue] = useState<unknown>(row[field.key] ?? (field.type === "multiSelect" || field.type === "attachment" ? [] : null));
  const finished = useRef(false);

  const commit = useCallback(
    async (v: unknown) => {
      if (finished.current) return;
      finished.current = true;
      const before = row[field.key] ?? null;
      if (JSON.stringify(v ?? null) === JSON.stringify(before)) return onDone();
      const check = validateRecordInput(t.fields, { [field.key]: v }, { mode: "update", allowedKeys: new Set([field.key]) });
      if (hasErrors(check.errors)) {
        toast.error(check.errors[field.key]);
        return onDone();
      }
      onDone();
      try {
        await t.updateRecord(row.id, check.values);
      } catch (e) {
        toast.error(messageOf(e));
      }
    },
    [field, row, t, toast, onDone],
  );

  if (INLINE_TYPES.has(field.type) || field.type === "singleSelect") {
    return (
      <div
        className={s.cellEditor}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            finished.current = true;
            onDone();
          } else if (e.key === "Enter") {
            e.preventDefault();
            void commit(value);
          }
        }}
        onBlur={(e) => {
          if (field.type !== "singleSelect" && !e.currentTarget.contains(e.relatedTarget as Node)) void commit(value);
        }}
      >
        <FieldInput field={field} value={value} autoFocus linked={t.linked} upload={t.upload} onChange={(v) => setValue(v)} onCommit={field.type === "singleSelect" ? undefined : undefined} />
        {field.type === "singleSelect" && (
          <span className={s.cellEditorActions}>
            <button type="button" className={s.linkBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => void commit(value)}>
              Save
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <FloatingPanel anchor={anchor} open onClose={() => { finished.current = true; onDone(); }} width={field.type === "longText" ? 380 : 320} align="left">
      <div className={s.cellPanel}>
        <FieldInput field={field} value={value} autoFocus linked={t.linked} upload={t.upload} onChange={setValue} />
        <div className={s.cardFoot}>
          <Button variant="secondary" size="sm" onClick={() => { finished.current = true; onDone(); }}>Cancel</Button>
          <Button size="sm" onClick={() => void commit(value)}>Save</Button>
        </div>
      </div>
    </FloatingPanel>
  );
}

function HeaderMenu({ field, anchor, onClose, onEditField }: { field: FieldDef; anchor: HTMLElement | null; onClose: () => void; onEditField: (k: string) => void }) {
  const t = useTable();
  const hide = () => t.patchConfig({ hidden: [...t.config.hidden, field.key] });
  const sort = (dir: "asc" | "desc") => t.patchConfig({ sort: [{ field: field.key, dir }] });
  const items = [
    { icon: <ArrowUpAZ size={14} />, label: "Sort A → Z", run: () => sort("asc") },
    { icon: <ArrowDownAZ size={14} />, label: "Sort Z → A", run: () => sort("desc") },
    { icon: <Layers size={14} />, label: "Group by this field", run: () => t.patchConfig({ groupBy: [{ field: field.key, dir: "asc" }] }) },
    { icon: <Pencil size={14} />, label: "Edit field…", run: () => onEditField(field.key) },
    ...(field.primary ? [] : [{ icon: <EyeOff size={14} />, label: "Hide field", run: hide }]),
  ];
  return (
    <FloatingPanel anchor={anchor} open onClose={onClose} width={210}>
      <ul className={s.menu} role="menu">
        {items.map((it) => (
          <li key={it.label}>
            <button type="button" role="menuitem" className={s.menuItem} onClick={() => { it.run(); onClose(); }}>
              {it.icon}
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </FloatingPanel>
  );
}

export function GridView({ rows, onOpen, onCreate, onEditField, onAddField }: ViewProps) {
  const t = useTable();
  const toast = useToast();
  const cols = useMemo(() => visibleFields(t.fields, t.config), [t.fields, t.config]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<{ id: string; key: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<{ key: string; el: HTMLElement } | null>(null);
  const [resize, setResize] = useState<{ key: string; width: number } | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const width = (f: FieldDef) => (resize?.key === f.key ? resize.width : (t.config.widths?.[f.key] ?? DEFAULT_WIDTH[f.type] ?? 180));
  const groups = useMemo(() => applyGroups(rows, t.config.groupBy, t.fields, t.linked), [rows, t.config.groupBy, t.fields, t.linked]);
  const items = useMemo(() => flatten(groups, collapsed), [groups, collapsed]);
  const grouped = t.config.groupBy.length > 0;

  // paging by rows (group headers are free)
  const shown = useMemo(() => {
    let n = 0;
    const out: Item[] = [];
    for (const it of items) {
      if (it.kind === "row") {
        if (n >= limit) break;
        n += 1;
      }
      out.push(it);
    }
    return out;
  }, [items, limit]);
  const rowCount = items.filter((i) => i.kind === "row").length;
  const visibleRows = shown.filter((i): i is Extract<Item, { kind: "row" }> => i.kind === "row").map((i) => i.row);

  const startResize = (e: React.PointerEvent, f: FieldDef) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width(f);
    let latest = startW;
    const move = (ev: PointerEvent) => {
      latest = Math.min(800, Math.max(60, startW + ev.clientX - startX));
      setResize({ key: f.key, width: latest });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setResize(null);
      if (latest !== startW) t.patchConfig((c) => ({ widths: { ...c.widths, [f.key]: Math.round(latest) } }));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const toggleCheckbox = async (row: RecordRow, f: FieldDef) => {
    try {
      await t.updateRecord(row.id, { [f.key]: !row[f.key] });
    } catch (e) {
      toast.error(messageOf(e));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || !active) return;
    const rIdx = visibleRows.findIndex((r) => r.id === active.id);
    const cIdx = cols.findIndex((c) => c.key === active.key);
    if (rIdx < 0 || cIdx < 0) return;
    const go = (r: number, c: number) => {
      const nr = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, r))];
      const nc = cols[Math.max(0, Math.min(cols.length - 1, c))];
      setActive({ id: nr.id, key: nc.key });
      e.preventDefault();
    };
    if (e.key === "ArrowDown") go(rIdx + 1, cIdx);
    else if (e.key === "ArrowUp") go(rIdx - 1, cIdx);
    else if (e.key === "ArrowLeft") go(rIdx, cIdx - 1);
    else if (e.key === "ArrowRight") go(rIdx, cIdx + 1);
    else if (e.key === "Enter" || e.key === "F2") {
      const f = cols[cIdx];
      if (isUserEditable(f, "update")) {
        if (f.type === "checkbox") void toggleCheckbox(visibleRows[rIdx], f);
        else setEditing({ ...active });
        e.preventDefault();
      }
    } else if (e.key === " " && e.shiftKey) {
      onOpen(active.id);
      e.preventDefault();
    }
  };

  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleRows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkDelete = async () => {
    setBusy(true);
    try {
      const out = await t.deleteRecords([...selected]);
      toast.success(`${out.deleted} record${out.deleted === 1 ? "" : "s"} deleted${out.unlinked ? `. Cleared ${out.unlinked} link${out.unlinked === 1 ? "" : "s"} in other records` : ""}.`);
      setSelected(new Set());
      setConfirm(false);
    } catch (e) {
      toast.error(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const gridTemplate = `44px 40px ${cols.map((f) => `${width(f)}px`).join(" ")} 120px`;
  const totalWidth = 84 + cols.reduce((n, f) => n + width(f), 0) + 120;
  const presetFor = (g: RowGroup) => (g.field && (g.field.type === "singleSelect" || g.field.type === "checkbox" || g.field.type === "link") && isUserEditable(g.field, "create") ? { [g.field.key]: g.field.type === "checkbox" ? g.value === true : (g.value ?? null) } : undefined);

  return (
    <div className={s.gridWrap}>
      <div className={s.gridScroll} role="grid" aria-label={`${t.tableName} records`} aria-rowcount={rowCount} tabIndex={0} onKeyDown={onKeyDown}>
        <div className={s.gridInner} style={{ minWidth: totalWidth }}>
          <div className={s.gridHead} role="row" style={{ gridTemplateColumns: gridTemplate }}>
            <div className={s.headCell} role="columnheader">
              <input type="checkbox" aria-label="Select all records" checked={allSelected} onChange={toggleAll} />
            </div>
            <div className={s.headCell} role="columnheader" aria-label="Row" />
            {cols.map((f) => (
              <div key={f.key} className={s.headCell} role="columnheader" aria-label={f.name} aria-sort={t.config.sort[0]?.field === f.key ? (t.config.sort[0].dir === "asc" ? "ascending" : "descending") : undefined}>
                <button type="button" className={s.headBtn} aria-haspopup="menu" onClick={(e) => setMenu({ key: f.key, el: e.currentTarget })}>
                  <FieldTypeIcon type={f.type} />
                  <span className={s.headName}>{f.name}</span>
                  {t.config.sort[0]?.field === f.key && (t.config.sort[0].dir === "asc" ? <ArrowUpAZ size={12} /> : <ArrowDownAZ size={12} />)}
                  <ChevronDown size={12} className={s.headChev} aria-hidden />
                </button>
                <span className={s.resizer} role="separator" aria-orientation="vertical" aria-label={`Resize ${f.name}`} onPointerDown={(e) => startResize(e, f)} onDoubleClick={() => t.patchConfig((c) => ({ widths: { ...c.widths, [f.key]: DEFAULT_WIDTH[f.type] ?? 180 } }))} />
              </div>
            ))}
            <div className={s.headCell} role="columnheader">
              <button type="button" className={s.headBtn} onClick={() => onAddField()} aria-label="Add field">
                <Plus size={14} /> <span className={s.headName}>Add field</span>
              </button>
            </div>
          </div>

          {shown.map((it) => {
            if (it.kind === "group") {
              const g = it.group;
              return (
                <div key={g.key} className={s.groupRow} role="row" style={{ paddingLeft: 12 + g.depth * 18 }}>
                  <button type="button" className={s.groupToggle} aria-expanded={!it.collapsed} onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}>
                    <ChevronDown size={14} className={cn(s.chev, it.collapsed && s.chevClosed)} aria-hidden />
                    <span className={s.groupField}>{g.field?.name}</span>
                    <strong>{g.label}</strong>
                    <span className={s.groupCount}>{countRows(g)}</span>
                  </button>
                  {presetFor(g) && (
                    <button type="button" className={s.iconBtn} aria-label={`Add record to ${g.label}`} onClick={() => onCreate(presetFor(g))}>
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              );
            }
            const { row, index } = it;
            return (
              <div key={row.id} className={cn(s.gridRow, selected.has(row.id) && s.rowSelected)} role="row" aria-rowindex={index + 1} style={{ gridTemplateColumns: gridTemplate }}>
                <div className={cn(s.cell, s.cellCenter)} role="gridcell">
                  <input type="checkbox" aria-label={`Select record ${index + 1}`} checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                </div>
                <div className={cn(s.cell, s.rowNum)} role="gridcell">
                  <span className={s.rowNumText}>{index + 1}</span>
                  <button type="button" className={s.expandBtn} aria-label={`Open record ${index + 1}`} onClick={() => onOpen(row.id)}>
                    <Maximize2 size={13} />
                  </button>
                </div>
                {cols.map((f) => {
                  const isActive = active?.id === row.id && active.key === f.key;
                  const isEditing = editing?.id === row.id && editing.key === f.key;
                  const editable = isUserEditable(f, "update");
                  return (
                    <div
                      key={f.key}
                      className={cn(s.cell, isActive && s.cellActive, f.type === "number" || f.type === "autonumber" ? s.cellRight : undefined, f.type === "computed" && s.cellComputed)}
                      role="gridcell"
                      aria-selected={isActive}
                      ref={isEditing ? setEditAnchor : undefined}
                      onClick={() => {
                        setActive({ id: row.id, key: f.key });
                        if (f.type === "checkbox" && editable) void toggleCheckbox(row, f);
                      }}
                      onDoubleClick={() => {
                        if (editable && f.type !== "checkbox") setEditing({ id: row.id, key: f.key });
                        else if (!editable) onOpen(row.id);
                      }}
                    >
                      {isEditing ? <CellEditor field={f} row={row} anchor={editAnchor} onDone={() => setEditing(null)} /> : <div className={cn(s.cellContent, f.type === "longText" && s.clamp3)}><CellValue field={f} row={row} linked={t.linked} compact={f.type === "attachment"} /></div>}
                    </div>
                  );
                })}
                <div className={s.cell} aria-hidden />
              </div>
            );
          })}

          {rowCount === 0 && null}
          <div className={s.addRow} role="row">
            <button type="button" className={s.addRowBtn} onClick={() => onCreate()}>
              <Plus size={14} /> Add record
            </button>
          </div>
        </div>
      </div>

      <div className={s.gridFoot}>
        <span>{rowCount} record{rowCount === 1 ? "" : "s"}{grouped ? ` in ${groups.length} group${groups.length === 1 ? "" : "s"}` : ""}</span>
        {rowCount > limit && (
          <button type="button" className={s.linkBtn} onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, rowCount - limit)} more
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className={s.selectionBar} role="region" aria-label="Selected records">
          <span>{selected.size} selected</span>
          <Button variant="secondary" size="sm" icon={<Trash2 size={13} />} onClick={() => setConfirm(true)}>Delete</Button>
          <button type="button" className={s.iconBtn} aria-label="Clear selection" onClick={() => setSelected(new Set())}><X size={14} /></button>
        </div>
      )}

      {menu && t.fieldMap.get(menu.key) && <HeaderMenu field={t.fieldMap.get(menu.key)!} anchor={menu.el} onClose={() => setMenu(null)} onEditField={onEditField} />}
      <ConfirmDialog
        open={confirm}
        destructive
        busy={busy}
        title={`Delete ${selected.size} record${selected.size === 1 ? "" : "s"}?`}
        message="This permanently deletes the selected records from every view. Links to them from other tables are cleared."
        confirmLabel="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={bulkDelete}
      />
    </div>
  );
}

function countRows(g: RowGroup): number {
  return g.children ? g.children.reduce((n, c) => n + countRows(c), 0) : g.rows.length;
}

