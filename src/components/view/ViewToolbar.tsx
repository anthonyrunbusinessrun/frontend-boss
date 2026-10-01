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
import { cn } from "@/lib/cn";
import styles from "./view.module.css";

export interface ToolbarConfig {
  hide: { label: string; active?: boolean };
  filter: { label: string; active?: boolean };
  group: { label: string; active?: boolean };
}

type PanelId = "hide" | "filter" | "group" | "sort" | "color" | "share";

interface ViewToolbarProps {
  config: ToolbarConfig;
  fields: FieldDef[];
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

/** Toolbar under the page title (design-system §6.4). Each control opens its supplied card. */
export function ViewToolbar({ config, fields, onCollapseAll, onExpandAll }: ViewToolbarProps) {
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

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="View options">
      <div className={styles.cluster}>
        <Popover {...sub("hide")} width={HIDDEN_CARD_WIDTH} label="Hide fields" trigger={chip("hide", <EyeOff {...icon} />, config.hide.label, config.hide.active)} panelStyle={{ height: 657 }}>
          <HiddenFieldsCard fields={fields} />
        </Popover>
        <Popover {...sub("filter")} width={FILTER_CARD_WIDTH} label="Filter" trigger={chip("filter", <Funnel {...icon} />, config.filter.label, config.filter.active)}>
          <FilterCard fields={fields} />
        </Popover>
        <Popover {...sub("group")} width={GROUP_CARD_WIDTH} label="Group by" trigger={chip("group", <Table2 {...icon} />, config.group.label, config.group.active)}>
          <GroupByCard onCollapseAll={onCollapseAll} onExpandAll={onExpandAll} />
        </Popover>
      </div>
      <div className={styles.cluster}>
        <Popover {...sub("sort")} width={SORT_CARD_WIDTH} align="right" label="Sort" trigger={chip("sort", <ArrowUpDown {...icon} />, "Sort")} panelStyle={{ height: 640 }}>
          <SortCard fields={fields} />
        </Popover>
        <Popover {...sub("color")} width={COLOR_CARD_WIDTH} align="right" label="Color" trigger={chip("color", <Palette {...icon} />, "Color")}>
          <ColorCard onClose={close} />
        </Popover>
        <Popover {...sub("share")} width={SHARE_SYNC_CARD_WIDTH} align="right" label="Share and sync" trigger={chip("share", <Share {...icon} />, "Share and sync")}>
          <ShareSyncCard onClose={close} />
        </Popover>
      </div>
    </div>
  );
}
