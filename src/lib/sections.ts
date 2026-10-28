/**
 * The primary tab bar. Every tab is a table of the shared table engine (`lib/base/definitions.ts`).
 * Removed on request: BOSS, Packet, Accounts and Registries (their database rows are untouched).
 * AIS is also out of the navigation for now; its routes remain but nothing links to them.
 */
export const SECTIONS = [
  { slug: "profiles", label: "Profiles" },
  { slug: "categories", label: "Categories" },
  { slug: "folios", label: "Folios" },
  { slug: "actions", label: "Actions" },
  { slug: "vouchers", label: "Vouchers" },
  { slug: "transactions", label: "Transactions" },
  { slug: "items", label: "Items" },
  { slug: "forms", label: "Forms" },
  { slug: "concepts", label: "Concepts" },
  { slug: "capabilities", label: "Capabilities" },
  { slug: "leads", label: "Leads" },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]["slug"];

/** Where a successful sign-in lands. */
export const DEFAULT_SECTION: SectionSlug = "profiles";

export function isSectionSlug(value: string): value is SectionSlug {
  return SECTIONS.some((s) => s.slug === value);
}

/** Extra top-level modules shown before the tabs. Empty: AIS was removed from the navigation for now. */
export const MODULE_TABS: ReadonlyArray<{ slug: string; label: string; href: string; badge?: string }> = [];
