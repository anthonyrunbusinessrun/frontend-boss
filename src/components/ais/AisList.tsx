"use client";

import { ChevronDown, Download, Plus } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { FieldDef } from "@/components/popovers/fields";
import type { Column } from "@/components/table/DataTable";
import type { RecordActions } from "@/components/table/RecordContext";
import type { TableTheme } from "@/components/table/theme";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Workspace } from "@/components/view/Workspace";
import { downloadCsv, toCsv, type CsvCell } from "@/lib/csv";
import styles from "./ais.module.css";

/** Table look shared by every AIS list: the Profiles theme of the BOSS views. */
export const AIS_TABLE_THEME: TableTheme = { headH: 36, rowH: 48, rowA: "#0f172a", rowB: "#0b1220" };

export interface QuickOption {
  value: string;
  label: string;
  count?: number;
}

export function QuickFilters({ options, value, onChange, label }: { options: QuickOption[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className={styles.quick} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={`${styles.quickBtn} ${o.value === value ? styles.quickOn : ""}`} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className={styles.quickCount}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A native select drawn as a toolbar chip. */
export function ChipSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className={styles.chipSelect}>
      <span className={styles.chipLabel}>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden />
    </label>
  );
}

export function ChipDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={styles.chipSelect}>
      <span className={styles.chipLabel}>{label}</span>
      <input type="date" className={styles.chipDate} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export interface ExportSpec<T> {
  filename: string;
  headers: string[];
  row: (r: T) => CsvCell[];
}

export function ExportButton({ onClick, label = "Export CSV" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className={styles.chip} onClick={onClick}>
      <Download size={15} strokeWidth={1.75} aria-hidden />
      {label}
    </button>
  );
}

interface AisListProps<T extends { id: string }> {
  title: string;
  subtitle?: string;
  singular: string;
  plural: string;
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  fields: FieldDef[];
  rowLabel: (r: T) => string;
  actions?: RecordActions;
  create?: { label: string; onClick: () => void };
  exportSpec?: ExportSpec<T>;
  /** Content above the table (summary cards, quick filters). */
  above?: ReactNode;
  toolbarExtra?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  /** Row id to highlight / enable selection column. */
  selectable?: boolean;
}

/** Table screen of the accounting module, built on the same Workspace as the BOSS tabs. */
export function AisList<T extends { id: string }>({ title, subtitle, singular, plural, rows, loading, columns, fields, rowLabel, actions, create, exportSpec, above, toolbarExtra, emptyTitle, emptyDescription, pageSize, selectable }: AisListProps<T>) {
  const toast = useToast();
  const data = useMemo(() => ({ groups: [{ id: "all", rows }] }), [rows]);

  const exportRows = () => {
    if (!exportSpec) return;
    if (rows.length === 0) {
      toast.info(`There are no ${plural} to export.`);
      return;
    }
    downloadCsv(exportSpec.filename, toCsv(exportSpec.headers, rows.map(exportSpec.row)));
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? singular : plural} to ${exportSpec.filename}.csv.`);
  };

  const extra = (
    <>
      {toolbarExtra}
      {exportSpec && <ExportButton onClick={exportRows} />}
      {create && (
        <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={create.onClick}>
          {create.label}
        </Button>
      )}
    </>
  );

  return (
    <Workspace<T>
      sidebar={null}
      title={title}
      subtitle={subtitle}
      toolbar={{ hide: { label: "Hide fields" }, filter: { label: "Filter" }, group: { label: "Group" } }}
      fields={fields}
      toolbarTop={subtitle ? 78 : 62}
      tableGap={16}
      data={data}
      table={{ columns, rowKey: (r) => r.id, rowLabel, theme: AIS_TABLE_THEME, ...(selectable ? { selection: { width: 44, padLeft: 14 } } : {}) }}
      footer={{ placement: "outside", variant: "plain" }}
      actions={actions}
      loading={loading}
      simpleToolbar
      toolbarExtra={extra}
      beforeTable={above}
      pageSize={pageSize}
      emptyState={{
        title: emptyTitle ?? `No ${plural} yet`,
        description: emptyDescription,
        action: create ? <Button size="md" onClick={create.onClick}>{create.label}</Button> : undefined,
      }}
    />
  );
}
