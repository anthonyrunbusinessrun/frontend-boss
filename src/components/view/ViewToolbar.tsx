"use client";

import { ArrowUpDown, EyeOff, Funnel, Palette, Share, Table2 } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import { ColorCard, COLOR_CARD_WIDTH } from "@/components/popovers/ColorCard";
import { FilterCard, FILTER_CARD_WIDTH } from "@/components/popovers/FilterCard";
import { GroupByCard, GROUP_CARD_WIDTH } from "@/components/popovers/GroupByCard";
import { HiddenFieldsCard, HIDDEN_CARD_WIDTH } from "@/components/popovers/HiddenFieldsCard";
import { Popover } from "@/components/popovers/Popover";
import { ShareSyncCard, SHARE_SYNC_CARD_WIDTH } from "@/components/popovers/ShareSyncCard";
import { SortCard, SORT_CARD_WIDTH } from "@/components/popovers/SortCard";
import type { FieldDef } from "@/components/popovers/fields";
import type { FilterCondition, SortRule } from "@/components/table/tableState";
import { cn } from "@/lib/cn";
import styles from "./view.module.css";

export interface ToolbarConfig {
  /** `label` is the design's label; it is shown until the user changes the view. */
  hide: { label: string; active?: boolean };
  filter: { label: string; active?: boolean; /** Conditions already applied in the design (shown, evaluated when the field is known). */ initial?: FilterCondition[] };
  group: { label: string; active?: boolean };
}

/** Everything the toolbar needs to drive the table. Owned by Workspace. */
export interface ToolbarControls {
  sort: SortRule[];
  onSort: (rules: SortRule[]) => void;
  conditions: FilterCondition[];
  onConditions: (next: FilterCondition[]) => void;
  hidden: ReadonlySet<string>;
  onHidden: (next: Set<string>) => void;
  /** Hide the cards that have no behaviour (Group, Color, Share and sync). */
  simple?: boolean;
  /** Extra controls rendered at the end of the right-hand cluster. */
  extra?: ReactNode;
}

type PanelId = "hide" | "filter" | "group" | "sort" | "color" | "share";

interface ViewToolbarProps {
  config: ToolbarConfig;
  fields: FieldDef[];
  controls: ToolbarControls;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Toolbar under the page title (design-system §6.4). Each control opens its card and applies it to the table. */
export function ViewToolbar({ config, fields, controls, onCollapseAll, onExpandAll }: ViewToolbarProps) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const toggle = (id: PanelId) => setOpen((o) => (o === id ? null : id));

  const chip = (id: PanelId, icon: ReactNode, label: string, active?: boolean) => (
    <button
      type="button"
      className={cn(styles.chip, active && styles.chipActive, open === id && styles.chipOpen)}
      aria-haspopup="dialog"
      aria-expanded={open === id}
      onClick={() => toggle(id)}
    >
      {icon}
      {label}
    </button>
  );
  const icon = { size: 16, strokeWidth: 1.75 } as const;
  const sub = (id: PanelId) => ({ open: open === id, onClose: close });

  // --- labels: the design's wording until the user changes the view, then a truthful summary ---
  const baseHidden = Number(/^(\d+)\s+hidden/.exec(config.hide.label)?.[1] ?? 0);
  const hiddenCount = controls.hidden.size;
  const hideLabel = hiddenCount === 0 ? config.hide.label : plural(baseHidden + hiddenCount, "hidden field");
  const hideActive = hiddenCount > 0 || config.hide.active;

  const initial = config.filter.initial ?? [];
  const untouchedFilter = controls.conditions.length === initial.length && controls.conditions.every((c, i) => c === initial[i]);
  const filterNames = [...new Set(controls.conditions.map((c) => c.field))];
  const filterLabel = untouchedFilter ? config.filter.label : filterNames.length === 0 ? "Filter" : `Filtered by ${filterNames.slice(0, 2).join(", ")}${filterNames.length > 2 ? ` +${filterNames.length - 2}` : ""}`;
  const filterActive = untouchedFilter ? config.filter.active : filterNames.length > 0;

  const sortLabel = controls.sort.length === 0 ? "Sort" : `Sorted by ${plural(controls.sort.length, "field")}`;

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="View options">
      <div className={styles.cluster}>
        <Popover {...sub("hide")} width={HIDDEN_CARD_WIDTH} label="Hide fields" trigger={chip("hide", <EyeOff {...icon} />, hideLabel, hideActive)} panelStyle={{ height: 657 }}>
          <HiddenFieldsCard fields={fields} hidden={controls.hidden} onChange={controls.onHidden} />
        </Popover>
        <Popover {...sub("filter")} width={FILTER_CARD_WIDTH} label="Filter" trigger={chip("filter", <Funnel {...icon} />, filterLabel, filterActive)}>
          <FilterCard fields={fields} conditions={controls.conditions} onChange={controls.onConditions} />
        </Popover>
        {!controls.simple && (
          <Popover {...sub("group")} width={GROUP_CARD_WIDTH} label="Group by" trigger={chip("group", <Table2 {...icon} />, config.group.label, config.group.active)}>
            <GroupByCard onCollapseAll={onCollapseAll} onExpandAll={onExpandAll} />
          </Popover>
        )}
      </div>
      <div className={styles.cluster}>
        <Popover {...sub("sort")} width={SORT_CARD_WIDTH} align="right" label="Sort" trigger={chip("sort", <ArrowUpDown {...icon} />, sortLabel, controls.sort.length > 0)} panelStyle={{ height: 640 }}>
          <SortCard fields={fields} rules={controls.sort} onChange={controls.onSort} />
        </Popover>
        {!controls.simple && (
          <>
            <Popover {...sub("color")} width={COLOR_CARD_WIDTH} align="right" label="Color" trigger={chip("color", <Palette {...icon} />, "Color")}>
              <ColorCard onClose={close} />
            </Popover>
            <Popover {...sub("share")} width={SHARE_SYNC_CARD_WIDTH} align="right" label="Share and sync" trigger={chip("share", <Share {...icon} />, "Share and sync")}>
              <ShareSyncCard onClose={close} />
            </Popover>
          </>
        )}
        {controls.extra}
      </div>
    </div>
  );
}
