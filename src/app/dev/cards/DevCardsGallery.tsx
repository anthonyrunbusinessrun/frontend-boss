"use client";

import { ColorCard, COLOR_CARD_WIDTH } from "@/components/popovers/ColorCard";
import { FilterCard, FILTER_CARD_WIDTH } from "@/components/popovers/FilterCard";
import { GroupByCard, GROUP_CARD_WIDTH } from "@/components/popovers/GroupByCard";
import { HiddenFieldsCard, HIDDEN_CARD_WIDTH } from "@/components/popovers/HiddenFieldsCard";
import { StaticPanel } from "@/components/popovers/Popover";
import { PROFILE_MENU_WIDTH, ProfileMenu } from "@/components/popovers/ProfileMenu";
import { ShareDialog, SHARE_DIALOG_WIDTH } from "@/components/popovers/ShareDialog";
import { ShareSyncCard, SHARE_SYNC_CARD_WIDTH } from "@/components/popovers/ShareSyncCard";
import { SortCard, SORT_CARD_HEIGHT, SORT_CARD_WIDTH } from "@/components/popovers/SortCard";
import { HIDDEN_CARD_HEIGHT } from "@/components/popovers/HiddenFieldsCard";
import { PROFILE_FIELDS } from "@/components/popovers/fields";


/** Every supplied card rendered statically so each can be compared with its PNG. */
export function DevCardsGallery() {
  const noop = () => {};
  return (

    <main style={{ display: "flex", flexWrap: "wrap", gap: 40, padding: 40, alignItems: "flex-start", background: "var(--bg-page)" }}>
      <StaticPanel id="sort" width={SORT_CARD_WIDTH} height={SORT_CARD_HEIGHT}>
        <SortCard fields={PROFILE_FIELDS} />
      </StaticPanel>
      <StaticPanel id="hidden" width={HIDDEN_CARD_WIDTH} height={HIDDEN_CARD_HEIGHT}>
        <HiddenFieldsCard fields={PROFILE_FIELDS} />
      </StaticPanel>
      <StaticPanel id="filter" width={FILTER_CARD_WIDTH}>
        <FilterCard fields={PROFILE_FIELDS} />
      </StaticPanel>
      <StaticPanel id="color" width={COLOR_CARD_WIDTH}>
        <ColorCard onClose={noop} />
      </StaticPanel>
      <StaticPanel id="share" width={SHARE_SYNC_CARD_WIDTH}>
        <ShareSyncCard onClose={noop} />
      </StaticPanel>
      <StaticPanel id="dialog" width={SHARE_DIALOG_WIDTH}>
        <ShareDialog />
      </StaticPanel>
      <StaticPanel id="group" width={GROUP_CARD_WIDTH}>
        <GroupByCard onCollapseAll={noop} onExpandAll={noop} />
      </StaticPanel>
      <StaticPanel id="profile" width={PROFILE_MENU_WIDTH}>
        <ProfileMenu />
      </StaticPanel>
    </main>
  );
}
