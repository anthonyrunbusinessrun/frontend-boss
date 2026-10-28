"use client";

import { Check, ChevronDown, Copy, GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { linkIds } from "@/lib/base/compute";
import { newId } from "@/lib/base/fields";
import { activeFilterCount, defaultRule, describeRule, opKind, opsFor, OPS_WITH_LIST, OPS_WITHOUT_VALUE } from "@/lib/base/query";
import type { FieldDef, FilterOp, FilterRule } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { FieldTypeIcon } from "./fieldIcons";
import { useTable } from "./TableProvider";
import s from "./base.module.css";
import { Avatar, FloatingPanel } from "./ui";

/* ------------------------------------------------------------ searchable picker */

export interface PickItem {
  value: string;
  label: string;
  icon?: ReactNode;
  sub?: string;
}

/** A button that opens a searchable list ("Find a field", "Find an operator"…). Keyboard: type, arrows, Enter, Escape. */
export function SearchablePicker({ items, value, onChange, placeholder, width = 240, ariaLabel, className, emptyText = "No matches" }: { items: PickItem[]; value: string | undefined; onChange: (v: string) => void; placeholder: string; width?: number; ariaLabel: string; className?: string; emptyText?: string }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const current = items.find((i) => i.value === value);
  const shown = useMemo(() => items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())), [items, q]);
  const close = () => {
    setOpen(false);
    setQ("");
  };
  const pick = (v: string) => {
    onChange(v);
    close();
  };
  return (
    <>
      <button ref={setAnchor} type="button" className={cn(s.pickBtn, className)} aria-label={`${ariaLabel}: ${current?.label ?? "none"}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((o) => !o); setActive(Math.max(0, items.findIndex((i) => i.value === value))); }}>
        {current?.icon}
        <span className={s.pickLabel}>{current?.label ?? <span className={s.placeholder}>Choose…</span>}</span>
        <ChevronDown size={13} aria-hidden />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={close} width={Math.max(width, anchor?.offsetWidth ?? 0)}>
        <label className={s.panelSearch}>
          <Search size={14} aria-hidden />
          <input
            autoFocus
            value={q}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && shown[active]) { e.preventDefault(); pick(shown[active].value); }
            }}
          />
        </label>
        <ul className={s.optionList} role="listbox" aria-label={ariaLabel}>
          {shown.map((i, idx) => (
            <li key={i.value}>
              <button type="button" role="option" aria-selected={i.value === value} className={cn(s.option, idx === active && s.optionActive, i.value === value && s.optionOn)} onMouseEnter={() => setActive(idx)} onClick={() => pick(i.value)}>
                {i.icon}
                <span className={s.optionMain}>
                  <span>{i.label}</span>
                  {i.sub && <small>{i.sub}</small>}
                </span>
                {i.value === value && <Check size={14} aria-hidden />}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className={s.optionEmpty}>{emptyText}</li>}
        </ul>
      </FloatingPanel>
    </>
  );
}

/** Several values at once (for “is any of” / “is none of”). */
function MultiPicker({ items, values, onChange, ariaLabel }: { items: PickItem[]; values: string[]; onChange: (v: string[]) => void; ariaLabel: string }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState("");
  const shown = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const labels = values.map((v) => items.find((i) => i.value === v)?.label ?? v);
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <>
      <button ref={setAnchor} type="button" className={cn(s.pickBtn, s.pickWide)} aria-label={`${ariaLabel}: ${labels.join(", ") || "none selected"}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={s.pickLabel}>{labels.length === 0 ? <span className={s.placeholder}>Choose values…</span> : labels.join(", ")}</span>
        <ChevronDown size={13} aria-hidden />
      </button>
      <FloatingPanel anchor={anchor} open={open} onClose={() => { setOpen(false); setQ(""); }} width={Math.max(260, anchor?.offsetWidth ?? 0)}>
        <label className={s.panelSearch}>
          <Search size={14} aria-hidden />
          <input autoFocus value={q} placeholder="Find a value" aria-label="Find a value" onChange={(e) => setQ(e.target.value)} />
        </label>
        <ul className={s.optionList} role="listbox" aria-multiselectable aria-label={ariaLabel}>
          {shown.map((i) => (
            <li key={i.value}>
              <label className={cn(s.option, values.includes(i.value) && s.optionOn)}>
                <input type="checkbox" checked={values.includes(i.value)} onChange={() => toggle(i.value)} />
                {i.icon}
                <span className={s.optionMain}>
                  <span>{i.label}</span>
                  {i.sub && <small>{i.sub}</small>}
                </span>
              </label>
            </li>
          ))}
          {shown.length === 0 && <li className={s.optionEmpty}>No matches</li>}
        </ul>
        {values.length > 0 && (
          <div className={s.cardFoot} style={{ padding: "6px 12px 10px" }}>
            <button type="button" className={s.linkBtnMuted} onClick={() => onChange([])}>
              Clear selection
            </button>
          </div>
        )}
      </FloatingPanel>
    </>
  );
}

/* ------------------------------------------------------------------ value control */

/** The values a person can choose for a field: its options, the linked records, or the derived statuses. */
export function useChoices(field: FieldDef | undefined): PickItem[] {
  const t = useTable();
  return useMemo(() => {
    if (!field) return [];
    if (field.type === "link" && field.options.linkTable) {
      const table = t.linked[field.options.linkTable];
      return (table?.records ?? []).map((r) => ({ value: r.id, label: r.label, sub: r.sub, icon: table?.slug === "profiles" ? <Avatar name={r.label} src={r.photo} size={20} /> : undefined }));
    }
    if (field.type === "computed") {
      const fn = field.options.computed?.fn;
      if (fn === "stockStatus") return ["In stock", "Low stock", "Out of stock"].map((v) => ({ value: v, label: v }));
      if (fn === "fileStatus") return ["Original uploaded", "Generated only", "No PDF"].map((v) => ({ value: v, label: v }));
    }
    const fromOptions = (field.options.choices ?? []).map((c) => ({ value: c.name, label: c.name }));
    if (field.type === "multiSelect") {
      // free tags that exist in the data are offered too
      const extra = new Set<string>();
      for (const r of t.records) for (const v of Array.isArray(r[field.key]) ? (r[field.key] as unknown[]) : []) if (typeof v === "string") extra.add(v);
      for (const c of fromOptions) extra.delete(c.value);
      return [...fromOptions, ...[...extra].sort().map((v) => ({ value: v, label: v }))];
    }
    return fromOptions;
  }, [field, t.linked, t.records]);
}

function ValueControl({ rule, field, onChange }: { rule: FilterRule; field: FieldDef; onChange: (patch: Partial<FilterRule>) => void }) {
  const kind = opKind(field);
  const choices = useChoices(field);
  if (OPS_WITHOUT_VALUE.has(rule.op)) return <span className={s.valueSpacer} />;
  if (kind === "boolean")
    return (
      <select className={s.miniSelect} aria-label="Value" value={String(rule.value === true || rule.value === "true")} onChange={(e) => onChange({ value: e.target.value === "true" })}>
        <option value="true">checked</option>
        <option value="false">unchecked</option>
      </select>
    );
  if (OPS_WITH_LIST.has(rule.op)) return <MultiPicker items={choices} values={rule.values ?? []} onChange={(values) => onChange({ values })} ariaLabel={`Values for ${field.name}`} />;
  if (rule.op === "between") {
    const type = kind === "date" ? "date" : "number";
    return (
      <span className={s.rangeRow}>
        <input className={s.miniInput} type={type} aria-label={kind === "date" ? "From date" : "Minimum"} value={String(rule.value ?? "")} onChange={(e) => onChange({ value: e.target.value })} />
        <span className={s.rangeAnd}>and</span>
        <input className={s.miniInput} type={type} aria-label={kind === "date" ? "To date" : "Maximum"} value={String(rule.value2 ?? "")} onChange={(e) => onChange({ value2: e.target.value })} />
      </span>
    );
  }
  if ((kind === "select" || kind === "link") && choices.length > 0) return <SearchablePicker items={choices} value={rule.value === undefined || rule.value === null ? undefined : String(rule.value)} onChange={(v) => onChange({ value: v })} placeholder={kind === "link" ? "Find a record" : "Find a value"} ariaLabel={`Value for ${field.name}`} className={s.pickWide} width={260} />;
  if (kind === "multi" && choices.length > 0) return <SearchablePicker items={choices} value={rule.value === undefined || rule.value === null ? undefined : String(rule.value)} onChange={(v) => onChange({ value: v })} placeholder="Find a value" ariaLabel={`Value for ${field.name}`} className={s.pickWide} width={260} />;
  return <input className={s.miniInput} aria-label="Value" type={kind === "number" ? "number" : kind === "date" ? "date" : "text"} value={String(rule.value ?? "")} placeholder="Enter a value" onChange={(e) => onChange({ value: e.target.value })} />;
}

/* ------------------------------------------------------------------------ panel */

const sameShape = (a: FilterOp, b: FilterOp) => (OPS_WITH_LIST.has(a) && OPS_WITH_LIST.has(b)) || (a === "between" && b === "between") || (!OPS_WITH_LIST.has(a) && !OPS_WITH_LIST.has(b) && a !== "between" && b !== "between");

export function FilterPanel() {
  const t = useTable();
  const rules = t.config.filters;
  const set = (next: FilterRule[]) => t.patchConfig({ filters: next });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [copyAnchor, setCopyAnchor] = useState<HTMLElement | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const fieldItems = useMemo<PickItem[]>(() => t.fields.map((f) => ({ value: f.key, label: f.name, icon: <FieldTypeIcon type={f.type} /> })), [t.fields]);
  const update = (id: string, patch: Partial<FilterRule>) => set(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rules.length || from === to) return;
    const next = [...rules];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set(next);
  };
  const others = t.views.filter((v) => v.id !== t.view.id && v.type !== "form" && v.config.filters.length > 0);

  return (
    <div className={s.card} aria-label="Filter conditions">
      <h2 className={s.cardTitle}>Filter</h2>
      <p className={s.muted}>{rules.length === 0 ? "No conditions yet. Records are not filtered." : "In this view, show records"}</p>
      <div className={s.rules}>
        {rules.map((r, i) => {
          const f = t.fieldMap.get(r.field);
          return (
            <div key={r.id} className={cn(s.ruleRow2, overId === r.id && dragId !== r.id && s.ruleOver, dragId === r.id && s.dragging)} onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverId(r.id); } }} onDrop={(e) => { e.preventDefault(); const from = rules.findIndex((x) => x.id === dragId); move(from, i); setDragId(null); setOverId(null); }}>
              {i === 0 ? (
                <span className={s.ruleLead}>Where</span>
              ) : (
                <select className={cn(s.miniSelect, s.ruleLead)} aria-label="Join" value={r.join} onChange={(e) => update(r.id, { join: e.target.value as "and" | "or" })}>
                  <option value="and">and</option>
                  <option value="or">or</option>
                </select>
              )}
              <SearchablePicker
                items={fieldItems}
                value={r.field}
                ariaLabel="Field"
                placeholder="Find a field"
                width={260}
                className={s.pickField}
                onChange={(key) => {
                  const nf = t.fieldMap.get(key);
                  if (nf && key !== r.field) set(rules.map((x) => (x.id === r.id ? { ...defaultRule(r.id, nf), join: r.join } : x)));
                }}
              />
              {f && (
                <>
                  <SearchablePicker
                    items={opsFor(f).map((o) => ({ value: o.op, label: o.label }))}
                    value={r.op}
                    ariaLabel="Operator"
                    placeholder="Find an operator"
                    width={220}
                    className={s.pickOp}
                    onChange={(op) => update(r.id, sameShape(r.op, op as FilterOp) ? { op: op as FilterOp } : { op: op as FilterOp, value: opKind(f) === "boolean" ? true : "", value2: undefined, values: [] })}
                  />
                  <span className={s.valueCell}>
                    <ValueControl rule={r} field={f} onChange={(patch) => update(r.id, patch)} />
                  </span>
                </>
              )}
              <button type="button" className={s.iconBtn} aria-label={`Remove condition ${i + 1}`} onClick={() => set(rules.filter((x) => x.id !== r.id))}>
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                className={cn(s.iconBtn, s.dragHandle)}
                draggable
                aria-label={`Reorder condition ${i + 1}. Press the up or down arrow key to move it.`}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", r.id); setDragId(r.id); }}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") { e.preventDefault(); move(i, i - 1); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); move(i, i + 1); }
                }}
              >
                <GripVertical size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className={s.cardFoot}>
        <span className={s.footLinks}>
          <button type="button" className={s.linkBtn} onClick={() => t.fields[0] && set([...rules, defaultRule(newId("flt"), t.fields[0])])}>
            <Plus size={14} /> Add condition
          </button>
          {others.length > 0 && (
            <>
              <button ref={setCopyAnchor} type="button" className={s.linkBtnMuted} aria-haspopup="menu" aria-expanded={copyOpen} onClick={() => setCopyOpen((o) => !o)}>
                <Copy size={13} /> Copy from another view
              </button>
              <FloatingPanel anchor={copyAnchor} open={copyOpen} onClose={() => setCopyOpen(false)} width={260}>
                <ul className={s.menu} role="menu" aria-label="Copy filters from">
                  {others.map((v) => (
                    <li key={v.id}>
                      <button type="button" role="menuitem" className={s.menuItem} onClick={() => { set(v.config.filters.map((f) => ({ ...f, id: newId("flt") }))); setCopyOpen(false); }}>
                        {v.name}
                        <span className={s.sideCount} style={{ marginLeft: "auto" }}>{v.config.filters.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </FloatingPanel>
            </>
          )}
        </span>
        {rules.length > 0 && (
          <button type="button" className={s.linkBtnMuted} onClick={() => set([])}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- active filter pills */

/** One removable pill per active condition, under the toolbar, so it is always clear what is hiding records. */
export function ActiveFilters() {
  const t = useTable();
  const rules = t.config.filters.filter((r) => t.fieldMap.has(r.field) && activeFilterCount([r], t.fields) > 0);
  if (rules.length === 0) return null;
  const labelFor = (r: FilterRule) => (v: string) => {
    const f = t.fieldMap.get(r.field);
    if (f?.type === "link" && f.options.linkTable) return t.linked[f.options.linkTable]?.records.find((x) => x.id === v)?.label ?? v;
    return v;
  };
  return (
    <div className={s.pills} role="status" aria-label="Active filters">
      <span className={s.pillsLabel}>Filters</span>
      {rules.map((r) => (
        <span key={r.id} className={s.pill}>
          {describeRule(r, t.fieldMap.get(r.field), labelFor(r))}
          <button type="button" className={s.pillX} aria-label={`Remove filter: ${describeRule(r, t.fieldMap.get(r.field), labelFor(r))}`} onClick={() => t.patchConfig({ filters: t.config.filters.filter((x) => x.id !== r.id) })}>
            <X size={12} />
          </button>
        </span>
      ))}
      <button type="button" className={s.linkBtnMuted} onClick={() => t.patchConfig({ filters: [] })}>
        Clear all
      </button>
    </div>
  );
}

void linkIds;
