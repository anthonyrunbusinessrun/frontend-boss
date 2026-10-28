import { isEditableType, isUserEditable, primaryField } from "./fields";
import type { FieldDef, FormConfig, FormFieldConfig, ViewConfig, ViewType } from "./types";
import { emptyViewConfig } from "./types";

export interface ViewTypeInfo {
  type: ViewType;
  label: string;
  /** Short explanation shown in the create dialog. */
  description: string;
  /** What the view needs from the table, for empty states. */
  needs?: string;
}

export const VIEW_TYPE_INFO: ViewTypeInfo[] = [
  { type: "grid", label: "Grid", description: "Rows and columns, like a spreadsheet." },
  { type: "calendar", label: "Calendar", description: "Records placed on the days of a date field.", needs: "a date field" },
  { type: "gallery", label: "Gallery", description: "Records as cards with an image.", needs: "an attachment field for the cover (optional)" },
  { type: "kanban", label: "Kanban", description: "Cards in columns by a single select field.", needs: "a single select field" },
  { type: "timeline", label: "Timeline", description: "Records as bars between a start and an end date.", needs: "a date field" },
  { type: "list", label: "List", description: "A compact list with expandable details." },
  { type: "gantt", label: "Gantt", description: "Tasks across a date range with durations and dependencies.", needs: "a date field" },
  { type: "form", label: "Form", description: "Collect new records with a form.", needs: "at least one editable field" },
];

export const viewTypeLabel = (t: ViewType) => VIEW_TYPE_INFO.find((v) => v.type === t)?.label ?? t;

const ofType = (fields: FieldDef[], ...types: FieldDef["type"][]) => fields.filter((f) => types.includes(f.type));

export function defaultFormConfig(fields: FieldDef[], tableName: string): FormConfig {
  const editable = fields.filter((f) => isUserEditable(f, "create"));
  const cfg: FormFieldConfig[] = editable.map((f) => ({ key: f.key, visible: true, required: f.required }));
  return {
    category: "Work",
    title: `New ${tableName.replace(/s$/i, "").toLowerCase()}`,
    description: "",
    submitLabel: "Submit",
    successMessage: "Thanks — your response was saved.",
    fields: cfg,
  };
}

/** Pick sensible fields for a new view so it renders something useful immediately. */
export function defaultConfigFor(type: ViewType, fields: FieldDef[], tableName: string): ViewConfig {
  const cfg = emptyViewConfig();
  const dates = ofType(fields, "date");
  const primary = primaryField(fields);

  switch (type) {
    case "calendar":
      cfg.dateField = dates[0]?.key;
      cfg.endDateField = dates[1]?.key;
      break;
    case "gallery": {
      const cover = ofType(fields, "attachment")[0];
      cfg.coverField = cover?.key;
      cfg.cardSize = "medium";
      cfg.titleField = primary?.key;
      break;
    }
    case "kanban":
      cfg.stackField = ofType(fields, "singleSelect")[0]?.key;
      cfg.titleField = primary?.key;
      break;
    case "timeline":
    case "gantt": {
      cfg.startField = dates[0]?.key;
      cfg.endField = dates[1]?.key;
      cfg.titleField = primary?.key;
      cfg.colorField = ofType(fields, "singleSelect")[0]?.key;
      if (type === "gantt") cfg.dependencyField = fields.find((f) => f.type === "link" && f.options.multiple)?.key;
      break;
    }
    case "list":
      cfg.titleField = primary?.key;
      break;
    case "form":
      cfg.form = defaultFormConfig(fields, tableName);
      break;
    default:
      break;
  }
  return cfg;
}

/** What is missing for a view type to render, if anything. Drives empty states with a clear next step. */
export function missingSetup(type: ViewType, cfg: ViewConfig, fields: FieldDef[]): { title: string; description: string; fix: "date" | "singleSelect" | "config" } | null {
  const has = (key: string | undefined, type?: FieldDef["type"]) => !!key && fields.some((f) => f.key === key && (!type || f.type === type));
  switch (type) {
    case "calendar":
      return has(cfg.dateField, "date") ? null : { title: "Choose a date field", description: "The calendar places each record on the day in its date field.", fix: "date" };
    case "kanban":
      return has(cfg.stackField, "singleSelect") ? null : { title: "Choose a single select field", description: "Kanban columns come from the options of a single select field, such as a status.", fix: "singleSelect" };
    case "timeline":
    case "gantt":
      return has(cfg.startField, "date") ? null : { title: "Choose a start date field", description: type === "gantt" ? "Gantt bars start on the date in this field. Add an end date to give each task a duration." : "Timeline bars start on the date in this field. Add an end date to stretch them.", fix: "date" };
    default:
      return null;
  }
}

/** Keep a config valid when fields are deleted: drop references to fields that no longer exist. */
export function pruneConfig(cfg: ViewConfig, fields: FieldDef[]): ViewConfig {
  const keys = new Set(fields.map((f) => f.key));
  const keep = (k: string | undefined) => (k && keys.has(k) ? k : undefined);
  return {
    ...cfg,
    filters: cfg.filters.filter((f) => keys.has(f.field)),
    sort: cfg.sort.filter((s) => keys.has(s.field)),
    groupBy: cfg.groupBy.filter((g) => keys.has(g.field)),
    hidden: cfg.hidden.filter((k) => keys.has(k)),
    order: cfg.order?.filter((k) => keys.has(k)),
    widths: cfg.widths ? Object.fromEntries(Object.entries(cfg.widths).filter(([k]) => keys.has(k))) : undefined,
    dateField: keep(cfg.dateField),
    endDateField: keep(cfg.endDateField),
    coverField: keep(cfg.coverField),
    stackField: keep(cfg.stackField),
    startField: keep(cfg.startField),
    endField: keep(cfg.endField),
    dependencyField: keep(cfg.dependencyField),
    colorField: keep(cfg.colorField),
    titleField: keep(cfg.titleField),
    form: cfg.form ? { ...cfg.form, fields: cfg.form.fields.filter((f) => keys.has(f.key)) } : undefined,
  };
}

/** Make sure every editable field appears in a form config (new fields are added hidden-off by default = visible). */
export function syncFormConfig(form: FormConfig, fields: FieldDef[]): FormConfig {
  const editable = fields.filter((f) => isUserEditable(f, "create"));
  const known = new Set(form.fields.map((f) => f.key));
  const added = editable.filter((f) => !known.has(f.key)).map((f): FormFieldConfig => ({ key: f.key, visible: false, required: f.required }));
  const valid = new Set(editable.map((f) => f.key));
  return { ...form, fields: [...form.fields.filter((f) => valid.has(f.key)), ...added] };
}
