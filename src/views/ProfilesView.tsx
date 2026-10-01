"use client";

import { Badge } from "@/components/ui/Badge";
import { PROFILE_FIELDS } from "@/components/popovers/fields";
import type { SidebarConfig } from "@/components/shell/Sidebar";
import type { Column } from "@/components/table/DataTable";
import type { TableTheme } from "@/components/table/theme";
import { Workspace } from "@/components/view/Workspace";
import type { Profile, RecordSet } from "@/types";
import { Dash, orDash } from "./cells";
import styles from "./views.module.css";

const sidebar: SidebarConfig = {
  cta: "Create new profile",
  sections: [
    {
      id: "fav",
      label: "My Favorites",
      collapsible: true,
      items: [
        { id: "active", label: "Active Profiles", icon: "star", active: true },
        { id: "vendor-fav", label: "Vendor Profiles", icon: "folder" },
        { id: "bookmarks", label: "Bookmarks", icon: "bookmark" },
      ],
    },
    {
      id: "views",
      label: "Views & Directories",
      collapsible: true,
      items: [
        { id: "company", label: "Company Profiles", icon: "building" },
        { id: "team", label: "Team Profiles", icon: "users", count: 14 },
        { id: "client", label: "Client Profiles", icon: "user" },
        { id: "vendor", label: "Vendor Profiles", icon: "briefcase" },
        { id: "preset", label: "Preset Profiles", icon: "sliders" },
        { id: "archive", label: "Archive", icon: "archive" },
      ],
    },
    {
      id: "collab",
      label: "Collaborative",
      collapsible: true,
      items: [
        { id: "blast", label: "Test Blast", icon: "send" },
        { id: "exceptions", label: "Exceptions", icon: "alert" },
        { id: "system", label: "System view", icon: "settings" },
        { id: "abs", label: "ABS Registry", icon: "database" },
      ],
    },
  ],
};

const theme: TableTheme = { headH: 36, rowH: 48, rowA: "#0f172a", rowB: "#0b1220" };

// Column widths come from the measured header-text positions in Screens/03.
const columns: Column<Profile>[] = [
  { key: "contact", header: "Contact", width: 107, render: (r) => <span className={`${styles.cCell} ${styles.b6}`}>{r.contact}</span> },
  { key: "sal", header: "Sal", width: 62, render: (r) => orDash(r.sal, styles.muted) },
  { key: "name", header: "Name", width: 184, render: (r) => <span className={`${styles.cCell} ${styles.b6}`}>{r.name}</span> },
  { key: "position", header: "Position", width: 192, render: (r) => <span className={styles.muted}>{r.position}</span> },
  {
    key: "billing",
    header: "Billing",
    width: 77,
    align: "center",
    render: (r) => (r.billing ? <Badge tone="billing">{r.billing}</Badge> : <Dash />),
  },
  { key: "type", header: "Type", width: 107, align: "center", render: (r) => <Badge tone={r.type === "Agent" ? "agent" : "rep"} shape="chip">{r.type}</Badge> },
  { key: "email", header: "Email", width: 232, render: (r) => <span className={styles.cyan}>{r.email}</span> },
  // NEEDS CLARIFICATION: columns after Address are cut off in the design.
  { key: "address", header: "Address", width: 250, render: (r) => orDash(r.address && <span className={styles.dim}>{r.address}</span>, styles.muted) },
];

export function ProfilesView({ data }: { data: RecordSet<Profile> }) {
  return (
    <Workspace<Profile>
      sidebar={sidebar}
      title="Active Profiles"
      toolbar={{
        hide: { label: "57 hidden fields", active: true },
        filter: { label: "Filtered by Team, Inactive" },
        group: { label: "Grouped by 1 field" },
      }}
      fields={PROFILE_FIELDS}
      toolbarInsetRight={33}
      toolbarTop={62}
      tableGap={16}
      data={data}
      table={{ columns, rowKey: (r) => r.id, rowLabel: (r) => r.name, theme }}
      footer={{ placement: "outside", variant: "plain" }}
    />
  );
}
