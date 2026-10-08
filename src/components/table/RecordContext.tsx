"use client";

import { createContext, useContext } from "react";

/**
 * Row-level actions provided by the surrounding Workspace. Row icons
 * (RowActions) and the "Add row" control read them from context, so the view
 * definitions stay declarative.
 */
export interface RecordActions {
  open?: (row: unknown) => void;
  edit?: (row: unknown) => void;
  duplicate?: (row: unknown) => void;
  remove?: (row: unknown) => void;
  add?: (groupId?: string) => void;
}

export const RecordActionsContext = createContext<RecordActions | null>(null);
/** The row currently being rendered by DataTable. */
export const RowContext = createContext<unknown>(null);

export function useRecordActions() {
  return useContext(RecordActionsContext);
}

export function useCurrentRow() {
  return useContext(RowContext);
}
