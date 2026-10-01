import type { Metadata } from "next";
import { notFound } from "next/navigation";
import shell from "@/components/shell/shell.module.css";
import { isSectionSlug, SECTIONS } from "@/lib/sections";
import * as api from "@/services";
import { AccountsView } from "@/views/AccountsView";
import { ActionsView } from "@/views/ActionsView";
import { CapabilitiesView } from "@/views/CapabilitiesView";
import { CategoriesView } from "@/views/CategoriesView";
import { ConceptsView } from "@/views/ConceptsView";
import { FoliosView } from "@/views/FoliosView";
import { FormsView } from "@/views/FormsView";
import { ItemsView } from "@/views/ItemsView";
import { LeadsView } from "@/views/LeadsView";
import { PacketView } from "@/views/PacketView";
import { ProfilesView } from "@/views/ProfilesView";
import { RegistriesView } from "@/views/RegistriesView";
import { TransactionsView } from "@/views/TransactionsView";
import { VouchersView } from "@/views/VouchersView";

export const dynamicParams = false;

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
