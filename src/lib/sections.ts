/**
 * The primary tab bar. Order and labels are taken from Components/tabs-bar.png.
 * (The design-system doc says "14 tabs" but lists, and the image shows, 15.)
 */
export const SECTIONS = [
  { slug: "boss", label: "BOSS" },
  { slug: "profiles", label: "Profiles" },
  { slug: "categories", label: "Categories" },
  { slug: "folios", label: "Folios" },
  { slug: "actions", label: "Actions" },
  { slug: "packet", label: "Packet" },
  { slug: "vouchers", label: "Vouchers" },
  { slug: "transactions", label: "Transactions" },
  { slug: "items", label: "Items" },
  { slug: "accounts", label: "Accounts" },
  { slug: "forms", label: "Forms" },
  { slug: "concepts", label: "Concepts" },
  { slug: "capabilities", label: "Capabilities" },
  { slug: "leads", label: "Leads" },
  { slug: "registries", label: "Registries" },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]["slug"];

/** Where a successful sign-in lands. NEEDS CLARIFICATION: not specified in the designs. */
export const DEFAULT_SECTION: SectionSlug = "profiles";

export function isSectionSlug(value: string): value is SectionSlug {
  return SECTIONS.some((s) => s.slug === value);
}

/**
 * Extra top-level modules that live outside the `[section]` route (they have their own
 * route tree and sidebar). Rendered before the 15 BOSS tabs in the tab bar: AIS, BOSS, Profiles, …
 */
export const MODULE_TABS: ReadonlyArray<{ slug: string; label: string; href: string; badge?: string }> = [{ slug: "ais", label: "AIS", href: "/ais" }];
