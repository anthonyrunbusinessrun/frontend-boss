import type { FieldType, RecordRow } from "@/lib/base/types";

/** Everything a view renderer needs besides the table state (which comes from useTable()). */
export interface ViewProps {
  /** Records after search, filters and sort. */
  rows: RecordRow[];
  onOpen: (id: string) => void;
  onCreate: (preset?: Record<string, unknown>) => void;
  onEditField: (key: string) => void;
  onAddField: (type?: FieldType) => void;
}
