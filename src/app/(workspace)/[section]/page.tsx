import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import { notFound } from "next/navigation";
import shell from "@/components/shell/shell.module.css";
import { isSectionSlug, SECTIONS } from "@/lib/sections";
import * as api from "@/services";

// Each table is a sizeable client component. Loading it on demand keeps a
// visit to one tab from downloading the renderers for every other tab.
const AccountsView = dynamicImport(() => import("@/views/AccountsView").then((module) => module.AccountsView));
const ActionsView = dynamicImport(() => import("@/views/ActionsView").then((module) => module.ActionsView));
const CapabilitiesView = dynamicImport(() => import("@/views/CapabilitiesView").then((module) => module.CapabilitiesView));
const CategoriesView = dynamicImport(() => import("@/views/CategoriesView").then((module) => module.CategoriesView));
const ConceptsView = dynamicImport(() => import("@/views/ConceptsView").then((module) => module.ConceptsView));
const FoliosView = dynamicImport(() => import("@/views/FoliosView").then((module) => module.FoliosView));
const FormsView = dynamicImport(() => import("@/views/FormsView").then((module) => module.FormsView));
const ItemsView = dynamicImport(() => import("@/views/ItemsView").then((module) => module.ItemsView));
const LeadsView = dynamicImport(() => import("@/views/LeadsView").then((module) => module.LeadsView));
const PacketView = dynamicImport(() => import("@/views/PacketView").then((module) => module.PacketView));
const ProfilesView = dynamicImport(() => import("@/views/ProfilesView").then((module) => module.ProfilesView));
const RegistriesView = dynamicImport(() => import("@/views/RegistriesView").then((module) => module.RegistriesView));
const TransactionsView = dynamicImport(() => import("@/views/TransactionsView").then((module) => module.TransactionsView));
const VouchersView = dynamicImport(() => import("@/views/VouchersView").then((module) => module.VouchersView));

export const dynamicParams = false;
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ section: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const match = SECTIONS.find((s) => s.slug === section);
  return { title: match?.label ?? "Not found" };
}

/** Server component: loads data through the service layer, then hands it to the client view. */
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSectionSlug(section)) notFound();

  switch (section) {
    case "boss":
      // NEEDS CLARIFICATION: no screen was supplied for the BOSS tab.
      return (
        <div className={shell.placeholder}>
          <div>
            <strong>BOSS</strong>
            No design was supplied for this tab.
            <br />
            It is intentionally left empty until one is provided.
          </div>
        </div>
      );
    case "profiles":
      return <ProfilesView data={await api.getProfiles()} />;
    case "categories":
      return <CategoriesView data={await api.getCategories()} />;
    case "folios":
      return <FoliosView data={await api.getFolios()} />;
    case "actions":
      return <ActionsView data={await api.getActions()} />;
    case "packet":
      return <PacketView data={await api.getPacket()} />;
    case "vouchers":
      return <VouchersView data={await api.getVouchers()} legend={await api.getVoucherLegend()} />;
    case "transactions":
      return <TransactionsView data={await api.getTransactions()} />;
    case "items":
      return <ItemsView data={await api.getItems()} />;
    case "accounts":
      return <AccountsView data={await api.getAccounts()} />;
    case "forms":
      return <FormsView data={await api.getForms()} />;
    case "concepts":
      return <ConceptsView data={await api.getConcepts()} />;
    case "capabilities":
      return <CapabilitiesView data={await api.getCapabilities()} />;
    case "leads":
      return <LeadsView data={await api.getLeads()} />;
    case "registries":
      return <RegistriesView data={await api.getRegistries()} />;
  }
}
