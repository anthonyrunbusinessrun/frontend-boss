"use client";

import { ArrowDownAZ, ArrowUpAZ, EyeOff, Funnel, Layers, Plus, Settings2, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { newId } from "@/lib/base/fields";
import { opKind, defaultRule, opsFor, OPS_WITHOUT_VALUE } from "@/lib/base/query";
import type { FieldDef, FieldType, FilterOp, FilterRule, GroupRule, SortRule, ViewConfig } from "@/lib/base/types";
import { cn } from "@/lib/cn";
import { linkCandidates } from "./inputs";
import { useTable } from "./TableProvider";
import s from "./base.module.css";
import { PanelButton } from "./ui";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

function Chip({ icon, label, active, open, setRef, onClick }: { icon: ReactNode; label: string; active?: boolean; open?: boolean; setRef: (el: HTMLElement | null) => void; onClick: () => void }) {
  return (
    <button ref={setRef} type="button" className={cn(s.toolChip, active && s.toolChipActive, open && s.toolChipOpen)} aria-haspopup="dialog" aria-expanded={open} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function FieldSelect({ fields, value, onChange, label, allowNone }: { fields: FieldDef[]; value: string | undefined; onChange: (v: string | undefined) => void; label: string; allowNone?: boolean }) {
  return (
    <select className={s.miniSelect} aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      {(allowNone || !value) && <option value="">{allowNone ? "None" : "Choose a field…"}</option>}
      {fields.map((f) => (
        <option key={f.key} value={f.key}>
          {f.name}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ filter */

function ValueInput({ rule, field, onChange }: { rule: FilterRule; field: FieldDef; onChange: (v: string | boolean | number | null) => void }) {
  const t = useTable();
  const kind = opKind(field);
  if (OPS_WITHOUT_VALUE.has(rule.op)) return <span className={s.valueSpacer} />;
  if (kind === "boolean")
    return (
      <select className={s.miniSelect} aria-label="Value" value={String(rule.value === true || rule.value === "true")} onChange={(e) => onChange(e.target.value === "true")}>
        <option value="true">checked</option>
        <option value="false">unchecked</option>
      </select>
    );
  if (kind === "select" || kind === "multi") {
    const names = field.type === "computed" && field.options.computed?.fn === "stockStatus" ? ["In stock", "Low stock", "Out of stock"] : (field.options.choices?.map((c) => c.name) ?? []);
    if (names.length > 0)
      return (
        <select className={s.miniSelect} aria-label="Value" value={String(rule.value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      );
  }
  if (kind === "link") {
    const opts = linkCandidates(field, t.linked, []);
    return (
      <select className={s.miniSelect} aria-label="Value" value={String(rule.value ?? "")} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose…</option>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return <input className={s.miniInput} aria-label="Value" type={kind === "number" ? "number" : kind === "date" ? "date" : "text"} value={String(rule.value ?? "")} placeholder="Enter a value" onChange={(e) => onChange(e.target.value)} />;
}

function FilterPanel() {
  const t = useTable();
  const rules = t.config.filters;
  const set = (next: FilterRule[]) => t.patchConfig({ filters: next });
  const byKey = t.fieldMap;
  const usable = t.fields;
  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Filter</h2>
      <p className={s.muted}>{rules.length === 0 ? "No filters. Add one to narrow this view." : "In this view, show records"}</p>
      <div className={s.rules}>
        {rules.map((r, i) => {
          const f = byKey.get(r.field);
          return (
            <div className={s.ruleRow} key={r.id}>
              {i === 0 ? (
                <span className={s.ruleLead}>Where</span>
              ) : (
                <select className={cn(s.miniSelect, s.ruleLead)} aria-label="Join" value={r.join} onChange={(e) => set(rules.map((x) => (x.id === r.id ? { ...x, join: e.target.value as "and" | "or" } : x)))}>
                  <option value="and">and</option>
                  <option value="or">or</option>
                </select>
              )}
              <select
                className={s.miniSelect}
                aria-label="Field"
                value={r.field}
                onChange={(e) => {
                  const nf = byKey.get(e.target.value);
                  if (nf) set(rules.map((x) => (x.id === r.id ? { ...defaultRule(r.id, nf), join: r.join } : x)));
                }}
              >
                {usable.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
                  </option>
                ))}
              </select>
              {f && (
                <>
                  <select className={s.miniSelect} aria-label="Operator" value={r.op} onChange={(e) => set(rules.map((x) => (x.id === r.id ? { ...x, op: e.target.value as FilterOp } : x)))}>
                    {opsFor(f).map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ValueInput rule={r} field={f} onChange={(v) => set(rules.map((x) => (x.id === r.id ? { ...x, value: v } : x)))} />
                </>
              )}
              <button type="button" className={s.iconBtn} aria-label="Remove condition" onClick={() => set(rules.filter((x) => x.id !== r.id))}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <div className={s.cardFoot}>
        <button type="button" className={s.linkBtn} onClick={() => t.fields[0] && set([...rules, defaultRule(newId("flt"), t.fields[0])])}>
          <Plus size={14} /> Add condition
        </button>
        {rules.length > 0 && (
          <button type="button" className={s.linkBtnMuted} onClick={() => set([])}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sort / group */

function RuleList({ title, rules, onChange, fields, empty, max }: { title: string; rules: Array<SortRule | GroupRule>; onChange: (r: SortRule[]) => void; fields: FieldDef[]; empty: string; max: number }) {
  const free = fields.filter((f) => !rules.some((r) => r.field === f.key));
  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>{title}</h2>
      {rules.length === 0 && <p className={s.muted}>{empty}</p>}
      <ul className={s.rules}>
        {rules.map((r, i) => {
          const f = fields.find((x) => x.key === r.field);
          return (
            <li key={r.field} className={s.ruleRow}>
              <span className={s.ruleLead}>{i + 1}.</span>
              <select className={s.miniSelect} aria-label="Field" value={r.field} onChange={(e) => onChange(rules.map((x) => (x.field === r.field ? { ...x, field: e.target.value } : x)))}>
                {[f, ...free].filter((x): x is FieldDef => !!x).map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.name}
                  </option>
                ))}
              </select>
              <button type="button" className={s.dirBtn} aria-label={`Direction: ${r.dir === "asc" ? "ascending" : "descending"}. Change`} onClick={() => onChange(rules.map((x) => (x.field === r.field ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}>
                {r.dir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                {r.dir === "asc" ? "A → Z" : "Z → A"}
              </button>
              <button type="button" className={s.iconBtn} aria-label={`Remove ${f?.name ?? "rule"}`} onClick={() => onChange(rules.filter((x) => x.field !== r.field))}>
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {rules.length < max && free.length > 0 && (
        <div className={s.cardFoot}>
          <button type="button" className={s.linkBtn} onClick={() => onChange([...rules, { field: free[0].key, dir: "asc" }])}>
            <Plus size={14} /> Pick a field to {title.toLowerCase().startsWith("sort") ? "sort by" : "group by"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- hide fields */

function FieldsPanel() {
  const t = useTable();
  const hidden = new Set(t.config.hidden);
  const toggle = (key: string) => t.patchConfig({ hidden: hidden.has(key) ? t.config.hidden.filter((k) => k !== key) : [...t.config.hidden, key] });
  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>Fields in this view</h2>
      <ul className={s.fieldToggles}>
        {t.fields.map((f) => (
          <li key={f.key}>
            <label className={s.toggleRow}>
              <input type="checkbox" checked={!hidden.has(f.key)} onChange={() => toggle(f.key)} />
              <span>{f.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className={s.cardFoot}>
        <button type="button" className={s.linkBtn} onClick={() => t.patchConfig({ hidden: t.fields.filter((f) => !f.primary).map((f) => f.key) })}>
          Hide all
        </button>
        <button type="button" className={s.linkBtn} onClick={() => t.patchConfig({ hidden: [] })}>
          Show all
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- view settings */

const ofType = (fields: FieldDef[], ...types: FieldType[]) => fields.filter((f) => types.includes(f.type));

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={s.setting}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function viewHasSettings(type: string) {
  return ["calendar", "gallery", "kanban", "timeline", "gantt", "list"].includes(type);
}

function SettingsPanel({ onAddField }: { onAddField: (type: FieldType) => void }) {
  const t = useTable();
  const c = t.config;
  const set = (p: Partial<ViewConfig>) => t.patchConfig(p);
  const dates = ofType(t.fields, "date");
  const primaryChoices = t.fields.filter((f) => ["text", "longText", "autonumber", "number", "email"].includes(f.type));
  const title = <Setting label="Card title"><FieldSelect fields={primaryChoices} value={c.titleField} onChange={(v) => set({ titleField: v })} label="Title field" allowNone /></Setting>;
  switch (t.view.type) {
    case "calendar":
      return (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Calendar settings</h2>
          <Setting label="Date field"><FieldSelect fields={dates} value={c.dateField} onChange={(v) => set({ dateField: v })} label="Date field" /></Setting>
          <Setting label="End date (optional)"><FieldSelect fields={dates.filter((d) => d.key !== c.dateField)} value={c.endDateField} onChange={(v) => set({ endDateField: v })} label="End date field" allowNone /></Setting>
          {title}
          <button type="button" className={s.linkBtn} onClick={() => onAddField("date")}><Plus size={14} /> Add a date field</button>
        </div>
      );
    case "gallery":
      return (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Gallery settings</h2>
          <Setting label="Cover image"><FieldSelect fields={ofType(t.fields, "attachment")} value={c.coverField} onChange={(v) => set({ coverField: v })} label="Cover field" allowNone /></Setting>
          {title}
          <Setting label="Card size">
            <select className={s.miniSelect} aria-label="Card size" value={c.cardSize ?? "medium"} onChange={(e) => set({ cardSize: e.target.value as ViewConfig["cardSize"] })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </Setting>
          <p className={s.muted}>Fields shown on cards follow “Hide fields”.</p>
        </div>
      );
    case "kanban":
      return (
        <div className={s.card}>
          <h2 className={s.cardTitle}>Kanban settings</h2>
          <Setting label="Group cards by"><FieldSelect fields={ofType(t.fields, "singleSelect")} value={c.stackField} onChange={(v) => set({ stackField: v })} label="Stack field" /></Setting>
          {title}
          <label className={s.toggleRow}><input type="checkbox" checked={c.hideEmptyStacks === true} onChange={(e) => set({ hideEmptyStacks: e.target.checked })} /><span>Hide empty columns</span></label>
          <button type="button" className={s.linkBtn} onClick={() => onAddField("singleSelect")}><Plus size={14} /> Add a single select field</button>
        </div>
      );
    case "timeline":
    case "gantt":
      return (
        <div className={s.card}>
          <h2 className={s.cardTitle}>{t.view.type === "gantt" ? "Gantt" : "Timeline"} settings</h2>
          <Setting label="Start date"><FieldSelect fields={dates} value={c.startField} onChange={(v) => set({ startField: v })} label="Start field" /></Setting>
          <Setting label="End date"><FieldSelect fields={dates.filter((d) => d.key !== c.startField)} value={c.endField} onChange={(v) => set({ endField: v })} label="End field" allowNone /></Setting>
          {title}
          <Setting label="Color by"><FieldSelect fields={ofType(t.fields, "singleSelect")} value={c.colorField} onChange={(v) => set({ colorField: v })} label="Color field" allowNone /></Setting>
          {t.view.type === "gantt" && <Setting label="Depends on"><FieldSelect fields={t.fields.filter((f) => f.type === "link" && f.options.linkTable === t.slug)} value={c.dependencyField} onChange={(v) => set({ dependencyField: v })} label="Dependency field" allowNone /></Setting>}
          <button type="button" className={s.linkBtn} onClick={() => onAddField("date")}><Plus size={14} /> Add a date field</button>
          {t.view.type === "gantt" && <button type="button" className={s.linkBtn} onClick={() => onAddField("link")}><Plus size={14} /> Add a dependency field</button>}
        </div>
      );
    case "list":
      return (
        <div className={s.card}>
          <h2 className={s.cardTitle}>List settings</h2>
          {title}
          <p className={s.muted}>Fields shown in the list follow “Hide fields”.</p>
        </div>
      );
    default:
      return null;
  }
}

/* --------------------------------------------------------------------- toolbar */

export function Toolbar({ onAddField, right }: { onAddField: (type: FieldType) => void; right?: ReactNode }) {
  const t = useTable();
  const c = t.config;
  const type = t.view.type;
  const showData = type !== "form";
  const hiddenCount = c.hidden.length;
  const names = (keys: string[]) => keys.map((k) => t.fieldMap.get(k)?.name).filter(Boolean);
  const filterFields = [...new Set(c.filters.map((f) => f.field))];
  const icon = { size: 15, strokeWidth: 1.75 } as const;

  return (
    <div className={s.toolbar} role="toolbar" aria-label="View options">
      <div className={s.cluster}>
        {showData && (
          <>
            <PanelButton width={280} label="Hide fields" trigger={({ open, ref, toggle }) => <Chip setRef={ref} open={open} onClick={toggle} active={hiddenCount > 0} icon={<EyeOff {...icon} />} label={hiddenCount === 0 ? "Hide fields" : plural(hiddenCount, "hidden field")} />}>
              {() => <FieldsPanel />}
            </PanelButton>
            <PanelButton width={560} label="Filter" trigger={({ open, ref, toggle }) => <Chip setRef={ref} open={open} onClick={toggle} active={c.filters.length > 0} icon={<Funnel {...icon} />} label={c.filters.length === 0 ? "Filter" : `Filtered by ${names(filterFields).slice(0, 2).join(", ")}${filterFields.length > 2 ? ` +${filterFields.length - 2}` : ""}`} />}>
              {() => <FilterPanel />}
            </PanelButton>
            {(type === "grid" || type === "list" || type === "gallery" || type === "kanban") && (
              <PanelButton width={420} label="Group" trigger={({ open, ref, toggle }) => <Chip setRef={ref} open={open} onClick={toggle} active={c.groupBy.length > 0} icon={<Layers {...icon} />} label={c.groupBy.length === 0 ? "Group" : `Grouped by ${plural(c.groupBy.length, "field")}`} />}>
                {() => <RuleList title="Group by" rules={c.groupBy} onChange={(r) => t.patchConfig({ groupBy: r })} fields={t.fields} empty="Records are not grouped." max={3} />}
              </PanelButton>
            )}
            <PanelButton width={420} label="Sort" trigger={({ open, ref, toggle }) => <Chip setRef={ref} open={open} onClick={toggle} active={c.sort.length > 0} icon={<ArrowUpAZ {...icon} />} label={c.sort.length === 0 ? "Sort" : `Sorted by ${plural(c.sort.length, "field")}`} />}>
              {() => <RuleList title="Sort by" rules={c.sort} onChange={(r) => t.patchConfig({ sort: r })} fields={t.fields} empty="Records are shown in their stored order." max={5} />}
            </PanelButton>
          </>
        )}
        {viewHasSettings(type) && (
          <PanelButton width={320} label={`${type} settings`} trigger={({ open, ref, toggle }) => <Chip setRef={ref} open={open} onClick={toggle} icon={<Settings2 {...icon} />} label="Customize" />}>
            {() => <SettingsPanel onAddField={onAddField} />}
          </PanelButton>
        )}
      </div>
      <div className={s.cluster}>{right}</div>
    </div>
  );
}
