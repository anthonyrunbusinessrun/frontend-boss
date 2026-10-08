import { createSeedData } from "@/data/ais/seed";
import type { AisData } from "@/types/ais";

/**
 * Persistence boundary of the accounting module. The UI only talks to this interface, so moving
 * from the browser to an API means writing one new implementation (load / save / reset); nothing
 * in components or in the pure accounting logic needs to change.
 */
export interface AisRepository {
  load(): Promise<AisData>;
  save(data: AisData): Promise<void>;
  /** Replace the books with the original demo data. */
  reset(): Promise<AisData>;
}

const KEY = "boss:ais:v1";

export const localAisRepository: AisRepository = {
  async load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AisData;
        if (parsed?.version === 1 && Array.isArray(parsed.accounts) && Array.isArray(parsed.journalEntries)) return parsed;
      }
    } catch {
      /* unreadable or unavailable storage: fall through to the seed */
    }
    return createSeedData();
  },
  async save(data) {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  },
  async reset() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    return createSeedData();
  },
};

/** Placeholder books used before the repository has answered (never shown: pages render a loading state). */
export const EMPTY_BOOKS: AisData = {
  version: 1,
  settings: {
    companyName: "",
    fiscalYear: new Date().getUTCFullYear(),
    fiscalYearStartMonth: 1,
    reportingDate: `${new Date().getUTCFullYear()}-01-01`,
    currency: "USD",
    defaultCustomerTerms: "Net 30",
    defaultVendorTerms: "Net 30",
    invoicePrefix: "INV-",
    billPrefix: "BILL-",
    journalPrefix: "JE-",
    paymentPrefix: "PMT-",
  },
  accounts: [],
  customers: [],
  vendors: [],
  invoices: [],
  bills: [],
  payments: [],
  journalEntries: [],
};
