/**
 * Service layer between the UI and data.
 *
 *   UI component -> service (this file) -> PostgreSQL
 *
 * During local design work without DATABASE_URL, the checked-in Airtable seed
 * remains available as a fallback. Railway requests read from PostgreSQL.
 */
import { accounts } from "@/data/accounts";
import { actions } from "@/data/actions";
import { capabilities } from "@/data/capabilities";
import { categories } from "@/data/categories";
import { concepts } from "@/data/concepts";
import { folios } from "@/data/folios";
import { forms } from "@/data/forms";
import { items } from "@/data/items";
import { leads } from "@/data/leads";
import { packet } from "@/data/packet";
import { profiles } from "@/data/profiles";
import { registries } from "@/data/registries";
import { transactions } from "@/data/transactions";
import { voucherLegend, vouchers } from "@/data/vouchers";
import { db } from "@/lib/db";
import { getRecordSet, type DataSection } from "@/server/records";
import type { RecordSet } from "@/types";

async function fromPostgres<T extends { id: string }>(section: DataSection, fallback: RecordSet<T>) {
  return db ? getRecordSet<T>(section) : fallback;
}

export const getProfiles = async () => fromPostgres("profiles", profiles);
export const getCategories = async () => fromPostgres("categories", categories);
export const getFolios = async () => fromPostgres("folios", folios);
export const getActions = async () => fromPostgres("actions", actions);
export const getPacket = async () => fromPostgres("packet", packet);
export const getVouchers = async () => fromPostgres("vouchers", vouchers);
export const getVoucherLegend = async () => voucherLegend;
export const getTransactions = async () => fromPostgres("transactions", transactions);
export const getItems = async () => fromPostgres("items", items);
export const getAccounts = async () => fromPostgres("accounts", accounts);
export const getForms = async () => fromPostgres("forms", forms);
export const getConcepts = async () => fromPostgres("concepts", concepts);
export const getCapabilities = async () => fromPostgres("capabilities", capabilities);
export const getLeads = async () => fromPostgres("leads", leads);
export const getRegistries = async () => fromPostgres("registries", registries);
