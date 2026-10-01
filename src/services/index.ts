/**
 * Service layer between the UI and data.
 *
 *   UI component -> service (this file) -> mock data  |  future Node.js API
 *
 * No backend endpoints have been specified, so each function resolves local mock
 * data. To connect a real API, replace the body of a function with a `fetch`
 * to the new endpoint; the return types (`RecordSet<T>`) are the contract the
 * UI depends on. NEEDS CLARIFICATION: API specification.
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

export const getProfiles = async () => profiles;
export const getCategories = async () => categories;
export const getFolios = async () => folios;
export const getActions = async () => actions;
export const getPacket = async () => packet;
export const getVouchers = async () => vouchers;
export const getVoucherLegend = async () => voucherLegend;
export const getTransactions = async () => transactions;
export const getItems = async () => items;
export const getAccounts = async () => accounts;
export const getForms = async () => forms;
export const getConcepts = async () => concepts;
export const getCapabilities = async () => capabilities;
export const getLeads = async () => leads;
export const getRegistries = async () => registries;
