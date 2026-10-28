"use client";

import { primaryField } from "@/lib/base/fields";
import { displayText } from "@/lib/base/compute";
import type { FieldDef, RecordRow } from "@/lib/base/types";
import { useTable } from "../TableProvider";

/** Text that names a record in cards, bars and lists. */
export function useTitle() {
  const t = useTable();
  const titleField = (t.config.titleField && t.fieldMap.get(t.config.titleField)) || primaryField(t.fields);
  return (row: RecordRow) => (titleField ? displayText(titleField, row, t.linked) : "") || "Untitled";
}

/** Fields shown on cards and lists: the view's visible fields except the title and cover. */
export function cardFields(fields: FieldDef[], hidden: string[], exclude: Array<string | undefined>, max = 4): FieldDef[] {
  const h = new Set(hidden);
  const ex = new Set(exclude);
  return fields.filter((f) => !h.has(f.key) && !ex.has(f.key)).slice(0, max);
}
