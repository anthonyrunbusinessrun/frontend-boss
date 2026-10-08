/** Accounting Information System (AIS) domain model. All amounts are integer cents. */

export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  /** Free-form grouping used by reports ("Cash", "Current Asset", "Operating Expense"…). */
  subtype: string;
  normalBalance: "debit" | "credit";
  description: string;
  active: boolean;
}

export type PaymentTerms = "Due on receipt" | "Net 15" | "Net 30" | "Net 45" | "Net 60";
export const PAYMENT_TERMS: readonly PaymentTerms[] = ["Due on receipt", "Net 15", "Net 30", "Net 45", "Net 60"];

export interface Party {
  id: string;
  code: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  terms: PaymentTerms;
  status: "Active" | "Inactive";
  /** Contact code of the matching BOSS profile (e.g. "RL3"); the hook for linking the two systems. */
  profileRef: string;
  notes: string;
}

export interface Customer extends Party {
  creditLimit: number;
}
export interface Vendor extends Party {
  taxId: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  accountId: string;
}

/** Stored status. Paid / Partially Paid / Overdue are derived from payments and the reporting date. */
export type InvoiceStatus = "Draft" | "Sent" | "Void";

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  terms: PaymentTerms;
  status: InvoiceStatus;
  reference: string;
  notes: string;
  lines: InvoiceLine[];
}

export interface BillLine {
  id: string;
  description: string;
  amount: number;
  accountId: string;
}

export type BillStatus = "Draft" | "Awaiting Approval" | "Approved" | "Void";

export interface Bill {
  id: string;
  number: string;
  vendorId: string;
  billDate: string;
  dueDate: string;
  terms: PaymentTerms;
  status: BillStatus;
  /** The vendor's own invoice number. */
  reference: string;
  notes: string;
  lines: BillLine[];
}

export type PaymentMethod = "Bank transfer" | "Check" | "Card" | "Cash";
export const PAYMENT_METHODS: readonly PaymentMethod[] = ["Bank transfer", "Check", "Card", "Cash"];

export interface PaymentAllocation {
  documentId: string;
  amount: number;
}

export interface Payment {
  id: string;
  number: string;
  direction: "received" | "made";
  partyId: string;
  date: string;
  method: PaymentMethod;
  /** Bank / cash account the money moved through. */
  accountId: string;
  reference: string;
  memo: string;
  allocations: PaymentAllocation[];
}

export interface JournalLine {
  id: string;
  accountId: string;
  description: string;
  debit: number;
  credit: number;
}

export type JournalSource = "Manual" | "Invoice" | "Bill" | "Payment";

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  memo: string;
  status: "Draft" | "Posted";
  source: JournalSource;
  /** Document that generated the entry (invoice / bill / payment id). */
  sourceId?: string;
  /** Set on a reversing entry: the entry it reverses. */
  reversalOf?: string;
  lines: JournalLine[];
}

export interface AisSettings {
  companyName: string;
  fiscalYear: number;
  fiscalYearStartMonth: number;
  /** The "today" of the books: aging, overdue flags and "This month" are relative to it. */
  reportingDate: string;
  currency: "USD";
  defaultCustomerTerms: PaymentTerms;
  defaultVendorTerms: PaymentTerms;
  invoicePrefix: string;
  billPrefix: string;
  journalPrefix: string;
  paymentPrefix: string;
}

export interface AisData {
  version: 1;
  settings: AisSettings;
  accounts: Account[];
  customers: Customer[];
  vendors: Vendor[];
  invoices: Invoice[];
  bills: Bill[];
  payments: Payment[];
  journalEntries: JournalEntry[];
}

export type DocStatus = "Draft" | "Open" | "Partially Paid" | "Overdue" | "Paid" | "Void" | "Awaiting Approval" | "Approved";

export type Result<T = undefined> = { ok: true; data: AisData; value: T } | { ok: false; error: string };
