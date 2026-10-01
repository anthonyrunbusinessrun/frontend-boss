import type { CSSProperties } from "react";

/**
 * Per-view table theme. Each screen in the supplied designs uses slightly
 * different row colours, header heights and divider tints, so these are measured
 * per view instead of forced into a single style.
 */
export interface TableTheme {
  border?: string;
  radius?: string;
  headBg?: string;
  headH?: number;
  headColor?: string;
  headBorder?: string;
  headBorderW?: number;
  rowH?: number;
  rowA?: string;
  rowB?: string;
  rowBorder?: string;
  rowBorderW?: number;
  rowPadY?: number;
  groupBg?: string;
  groupH?: number;
  groupBorder?: string;
  groupBorderW?: number;
  groupColor?: string;
  groupSize?: number;
  groupWeight?: number;
  groupLetterSpacing?: string;
  groupTransform?: string;
  headTransform?: string;
  headLetterSpacing?: string;
  headSize?: number;
  headWeight?: number;
  chevColor?: string;
  sumBg?: string;
  sumH?: number;
  sumLabel?: string;
  addBg?: string;
  addH?: number;
  addBorder?: string;
  addBorderW?: number;
  selectedBg?: string;
  selectedBar?: string;
  cellColor?: string;
  footBg?: string;
  footH?: number;
  footBorder?: string;
  footGap?: number;
  colBorder?: string;
  cbBorder?: string;
  cbCheckedBg?: string;
  cbCheckedBorder?: string;
  cbCheck?: string;
}

const px = (n: number | undefined) => (n === undefined ? undefined : `${n}px`);

export function themeToStyle(t: TableTheme = {}): CSSProperties {
  const vars: Record<string, string | undefined> = {
    "--t-border": t.border,
    "--t-radius": t.radius,
    "--t-head-bg": t.headBg,
    "--t-head-h": px(t.headH),
    "--t-head-color": t.headColor,
    "--t-head-border": t.headBorder,
    "--t-head-bw": px(t.headBorderW),
    "--t-row-h": px(t.rowH),
    "--t-row-a": t.rowA,
    "--t-row-b": t.rowB,
    "--t-row-border": t.rowBorder,
    "--t-row-bw": px(t.rowBorderW),
    "--t-row-pady": px(t.rowPadY),
    "--t-group-bg": t.groupBg,
    "--t-group-h": px(t.groupH),
    "--t-group-border": t.groupBorder,
    "--t-group-bw": px(t.groupBorderW),
    "--t-group-color": t.groupColor,
    "--t-group-size": px(t.groupSize),
    "--t-group-weight": t.groupWeight?.toString(),
    "--t-group-ls": t.groupLetterSpacing,
    "--t-group-tf": t.groupTransform,
    "--t-head-tf": t.headTransform,
    "--t-head-ls": t.headLetterSpacing,
    "--t-head-size": px(t.headSize),
    "--t-head-weight": t.headWeight?.toString(),
    "--t-chev": t.chevColor,
    "--t-sum-bg": t.sumBg,
    "--t-sum-h": px(t.sumH),
    "--t-sum-label": t.sumLabel,
    "--t-add-bg": t.addBg,
    "--t-add-h": px(t.addH),
    "--t-add-border": t.addBorder,
    "--t-add-bw": px(t.addBorderW),
    "--t-selected-bg": t.selectedBg,
    "--t-selected-bar": t.selectedBar,
    "--t-cell-color": t.cellColor,
    "--t-foot-bg": t.footBg,
    "--t-foot-h": px(t.footH),
    "--t-foot-border": t.footBorder,
    "--t-foot-gap": px(t.footGap),
    "--t-col-border": t.colBorder,
    "--cb-border": t.cbBorder,
    "--cb-checked-bg": t.cbCheckedBg,
    "--cb-checked-border": t.cbCheckedBorder,
    "--cb-checked-check": t.cbCheck,
  };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) out[k] = v;
  return out as CSSProperties;
}
