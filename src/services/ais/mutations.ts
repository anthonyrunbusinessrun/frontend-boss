import { addDays } from "@/lib/dates";
import type {
  Account,
  AisData,
  AisSettings,
  Bill,
  BillStatus,
  Customer,
  Invoice,
  InvoiceStatus,
  JournalEntry,
  Payment,
  Result,
  Vendor,
} from "@/types/ais";
import { buildBillEntry, buildInvoiceEntry, buildPaymentEntry, buildReversal, nextNumber, paidAgainst, SYSTEM_CODES } from "./ledger";
import { validateAccount, validateBill, validateInvoice, validateJournalEntry, validateParty, validatePayment } from "./validation";

/**
 * State transitions of the accounting module. Every function takes the current books and returns
 * new books (or an error message); none of them touches React or storage. This is the layer an
 * API would replace: each function corresponds to one request.
 */

const ok = <T>(data: AisData, value: T): Result<T> => ({ ok: true, data, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const TERM_DAYS = { "Due on receipt": 0, "Net 15": 15, "Net 30": 30, "Net 45": 45, "Net 60": 60 } as const;
export const dueDateFor = (issue: string, terms: keyof typeof TERM_DAYS) => addDays(issue, TERM_DAYS[terms]);

export function newId(prefix: string): string {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

/** Replace the auto-posted journal entry of a document (keeps its number when it already had one). */
function resync(data: AisData, source: "Invoice" | "Bill" | "Payment", sourceId: string, build: (number: string) => JournalEntry | null): AisData {
  const existing = data.journalEntries.find((e) => e.source === source && e.sourceId === sourceId);
  const rest = data.journalEntries.filter((e) => e !== existing);
  const number = existing?.number ?? nextNumber(data.settings.journalPrefix, data.journalEntries.map((e) => e.number));
  const entry = build(number);
  return { ...data, journalEntries: entry ? [...rest, entry] : rest };
}

/* ------------------------------ customers & vendors ------------------------------ */

export function saveCustomer(data: AisData, c: Customer): Result<Customer> {
  const isNew = !data.customers.some((x) => x.id === c.id);
  const errors = validateParty(c, data.customers, isNew ? null : c.id, "Customer");
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const next = { ...c, name: c.name.trim(), code: c.code.trim() };
  return ok({ ...data, customers: isNew ? [...data.customers, next] : data.customers.map((x) => (x.id === c.id ? next : x)) }, next);
}

export function deleteCustomer(data: AisData, id: string): Result {
  const c = data.customers.find((x) => x.id === id);
  if (!c) return fail("This customer no longer exists.");
  const used = data.invoices.filter((i) => i.customerId === id).length + data.payments.filter((p) => p.direction === "received" && p.partyId === id).length;
  if (used > 0) return fail(`${c.name} has ${used} invoice or payment record${used === 1 ? "" : "s"}. Mark the customer inactive instead of deleting it.`);
  return ok({ ...data, customers: data.customers.filter((x) => x.id !== id) }, undefined);
}

export function saveVendor(data: AisData, v: Vendor): Result<Vendor> {
  const isNew = !data.vendors.some((x) => x.id === v.id);
  const errors = validateParty(v, data.vendors, isNew ? null : v.id, "Vendor");
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const next = { ...v, name: v.name.trim(), code: v.code.trim() };
  return ok({ ...data, vendors: isNew ? [...data.vendors, next] : data.vendors.map((x) => (x.id === v.id ? next : x)) }, next);
}

export function deleteVendor(data: AisData, id: string): Result {
  const v = data.vendors.find((x) => x.id === id);
  if (!v) return fail("This vendor no longer exists.");
  const used = data.bills.filter((b) => b.vendorId === id).length + data.payments.filter((p) => p.direction === "made" && p.partyId === id).length;
  if (used > 0) return fail(`${v.name} has ${used} bill or payment record${used === 1 ? "" : "s"}. Mark the vendor inactive instead of deleting it.`);
  return ok({ ...data, vendors: data.vendors.filter((x) => x.id !== id) }, undefined);
}

/* --------------------------------- chart of accounts --------------------------------- */

const SYSTEM_CODE_LIST: string[] = Object.values(SYSTEM_CODES);

export function saveAccount(data: AisData, a: Account): Result<Account> {
  const existing = data.accounts.find((x) => x.id === a.id);
  const errors = validateAccount(a, data.accounts, existing ? a.id : null);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  if (existing && SYSTEM_CODE_LIST.includes(existing.code) && (existing.code !== a.code.trim() || existing.type !== a.type)) return fail(`${existing.name} is a system account: its code and type cannot change.`);
  if (existing && existing.type !== a.type && data.journalEntries.some((e) => e.lines.some((l) => l.accountId === a.id))) return fail("This account has transactions, so its type cannot change.");
  const next = { ...a, code: a.code.trim(), name: a.name.trim() };
  return ok({ ...data, accounts: existing ? data.accounts.map((x) => (x.id === a.id ? next : x)) : [...data.accounts, next] }, next);
}

export function deleteAccount(data: AisData, id: string): Result {
  const a = data.accounts.find((x) => x.id === id);
  if (!a) return fail("This account no longer exists.");
  if (SYSTEM_CODE_LIST.includes(a.code)) return fail(`${a.name} is a system account and cannot be deleted.`);
  const lines = data.journalEntries.reduce((n, e) => n + e.lines.filter((l) => l.accountId === id).length, 0);
  if (lines > 0) return fail(`${a.name} is used by ${lines} journal line${lines === 1 ? "" : "s"}. Mark it inactive instead of deleting it.`);
  const docs = data.invoices.some((i) => i.lines.some((l) => l.accountId === id)) || data.bills.some((b) => b.lines.some((l) => l.accountId === id)) || data.payments.some((p) => p.accountId === id);
  if (docs) return fail(`${a.name} is used by invoices, bills or payments. Mark it inactive instead of deleting it.`);
  return ok({ ...data, accounts: data.accounts.filter((x) => x.id !== id) }, undefined);
}

/* ------------------------------------ journal ------------------------------------ */

/** Save a manual entry as a draft, or post it. Both require debits = credits. */
export function saveJournalEntry(data: AisData, entry: JournalEntry, post: boolean): Result<JournalEntry> {
  const existing = data.journalEntries.find((e) => e.id === entry.id);
  if (existing && existing.source !== "Manual") return fail("This entry was posted automatically by a document and cannot be edited here.");
  if (existing && existing.status === "Posted") return fail("Posted entries cannot be edited. Reverse the entry instead.");
  const cleaned: JournalEntry = { ...entry, memo: entry.memo.trim(), lines: entry.lines.filter((l) => l.accountId !== "" || l.debit !== 0 || l.credit !== 0) };
  const v = validateJournalEntry(cleaned, data.accounts);
  if (!v.valid) return fail(v.summary[0]);
  const number = existing?.number || entry.number || nextNumber(data.settings.journalPrefix, data.journalEntries.map((e) => e.number));
  const saved: JournalEntry = { ...cleaned, number, source: "Manual", status: post ? "Posted" : "Draft" };
  return ok({ ...data, journalEntries: existing ? data.journalEntries.map((e) => (e.id === entry.id ? saved : e)) : [...data.journalEntries, saved] }, saved);
}

export function deleteJournalEntry(data: AisData, id: string): Result {
  const e = data.journalEntries.find((x) => x.id === id);
  if (!e) return fail("This entry no longer exists.");
  if (e.source !== "Manual") return fail("Entries posted by invoices, bills and payments are removed by changing the document.");
  if (e.status === "Posted") return fail("Posted entries cannot be deleted. Reverse the entry instead.");
  return ok({ ...data, journalEntries: data.journalEntries.filter((x) => x.id !== id) }, undefined);
}

export function reverseJournalEntry(data: AisData, id: string, date: string): Result<JournalEntry> {
  const e = data.journalEntries.find((x) => x.id === id);
  if (!e) return fail("This entry no longer exists.");
  if (e.status !== "Posted") return fail("Only posted entries can be reversed.");
  if (e.reversalOf) return fail("A reversing entry cannot be reversed again.");
  if (data.journalEntries.some((x) => x.reversalOf === id)) return fail("This entry has already been reversed.");
  const rev = buildReversal(e, newId("je"), nextNumber(data.settings.journalPrefix, data.journalEntries.map((x) => x.number)), date);
  return ok({ ...data, journalEntries: [...data.journalEntries, rev] }, rev);
}

/* ------------------------------------ invoices ------------------------------------ */

export function saveInvoice(data: AisData, inv: Invoice): Result<Invoice> {
  const isNew = !data.invoices.some((x) => x.id === inv.id);
  const lines = inv.lines.filter((l) => l.description.trim() !== "" || l.unitPrice !== 0 || l.accountId !== "");
  const clean = { ...inv, lines, number: inv.number || nextNumber(data.settings.invoicePrefix, data.invoices.map((i) => i.number)) };
  if (!isNew && data.invoices.find((x) => x.id === inv.id)?.status === "Void") return fail("A void invoice cannot be edited.");
  const errors = validateInvoice(clean, data);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const next: AisData = { ...data, invoices: isNew ? [...data.invoices, clean] : data.invoices.map((x) => (x.id === inv.id ? clean : x)) };
  return ok(resync(next, "Invoice", clean.id, (n) => buildInvoiceEntry(next, clean, n)), clean);
}

export function setInvoiceStatus(data: AisData, id: string, status: InvoiceStatus): Result<Invoice> {
  const inv = data.invoices.find((x) => x.id === id);
  if (!inv) return fail("This invoice no longer exists.");
  if (status !== "Sent" && paidAgainst(data.payments, id) > 0) return fail("This invoice has payments. Delete the payments before changing its status.");
  if (inv.status === "Void") return fail("A void invoice cannot be changed.");
  if (status === "Sent") {
    const errors = validateInvoice(inv, data);
    if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  }
  const next = { ...inv, status };
  const withInv = { ...data, invoices: data.invoices.map((x) => (x.id === id ? next : x)) };
  return ok(resync(withInv, "Invoice", id, (n) => buildInvoiceEntry(withInv, next, n)), next);
}

export function deleteInvoice(data: AisData, id: string): Result {
  const inv = data.invoices.find((x) => x.id === id);
  if (!inv) return fail("This invoice no longer exists.");
  if (inv.status === "Sent") return fail("A sent invoice cannot be deleted. Void it instead.");
  if (paidAgainst(data.payments, id) > 0) return fail("This invoice has payments and cannot be deleted.");
  return ok({ ...data, invoices: data.invoices.filter((x) => x.id !== id), journalEntries: data.journalEntries.filter((e) => !(e.source === "Invoice" && e.sourceId === id)) }, undefined);
}

/* -------------------------------------- bills -------------------------------------- */

export function saveBill(data: AisData, bill: Bill): Result<Bill> {
  const existing = data.bills.find((x) => x.id === bill.id);
  const lines = bill.lines.filter((l) => l.description.trim() !== "" || l.amount !== 0 || l.accountId !== "");
  const clean = { ...bill, lines, number: bill.number || nextNumber(data.settings.billPrefix, data.bills.map((b) => b.number)) };
  if (existing?.status === "Void") return fail("A void bill cannot be edited.");
  const errors = validateBill(clean, data);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const next: AisData = { ...data, bills: existing ? data.bills.map((x) => (x.id === bill.id ? clean : x)) : [...data.bills, clean] };
  return ok(resync(next, "Bill", clean.id, (n) => buildBillEntry(next, clean, n)), clean);
}

const BILL_FLOW: Record<BillStatus, BillStatus[]> = {
  Draft: ["Awaiting Approval", "Approved", "Void"],
  "Awaiting Approval": ["Approved", "Draft", "Void"],
  Approved: ["Void"],
  Void: [],
};

export function setBillStatus(data: AisData, id: string, status: BillStatus): Result<Bill> {
  const bill = data.bills.find((x) => x.id === id);
  if (!bill) return fail("This bill no longer exists.");
  if (!BILL_FLOW[bill.status].includes(status)) return fail(`A bill that is “${bill.status}” cannot move to “${status}”.`);
  if (status === "Void" && paidAgainst(data.payments, id) > 0) return fail("This bill has payments. Delete the payments before voiding it.");
  if (status === "Approved") {
    const errors = validateBill(bill, data);
    if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  }
  const next = { ...bill, status };
  const withBill = { ...data, bills: data.bills.map((x) => (x.id === id ? next : x)) };
  return ok(resync(withBill, "Bill", id, (n) => buildBillEntry(withBill, next, n)), next);
}

export function deleteBill(data: AisData, id: string): Result {
  const bill = data.bills.find((x) => x.id === id);
  if (!bill) return fail("This bill no longer exists.");
  if (bill.status === "Approved") return fail("An approved bill cannot be deleted. Void it instead.");
  return ok({ ...data, bills: data.bills.filter((x) => x.id !== id), journalEntries: data.journalEntries.filter((e) => !(e.source === "Bill" && e.sourceId === id)) }, undefined);
}

/* ------------------------------------- payments ------------------------------------- */

export function savePayment(data: AisData, p: Payment): Result<Payment> {
  if (data.payments.some((x) => x.id === p.id)) return fail("Recorded payments cannot be edited. Delete the payment and record it again.");
  const clean: Payment = { ...p, allocations: p.allocations.filter((a) => a.amount > 0), number: p.number || nextNumber(data.settings.paymentPrefix, data.payments.map((x) => x.number)) };
  const errors = validatePayment(clean, data);
  if (Object.keys(errors).length) return fail(Object.values(errors)[0]);
  const next: AisData = { ...data, payments: [...data.payments, clean] };
  return ok(resync(next, "Payment", clean.id, (n) => buildPaymentEntry(next, clean, n)), clean);
}

export function deletePayment(data: AisData, id: string): Result {
  if (!data.payments.some((x) => x.id === id)) return fail("This payment no longer exists.");
  return ok({ ...data, payments: data.payments.filter((x) => x.id !== id), journalEntries: data.journalEntries.filter((e) => !(e.source === "Payment" && e.sourceId === id)) }, undefined);
}

/* ------------------------------------- settings ------------------------------------- */

export function saveSettings(data: AisData, s: AisSettings): Result<AisSettings> {
  if (s.companyName.trim() === "") return fail("Company name is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.reportingDate)) return fail("Choose a valid reporting date.");
  for (const [label, v] of [["Invoice", s.invoicePrefix], ["Bill", s.billPrefix], ["Journal", s.journalPrefix], ["Payment", s.paymentPrefix]] as const) if (v.trim() === "") return fail(`${label} number prefix is required.`);
  if (!(s.fiscalYear >= 2000 && s.fiscalYear <= 2100)) return fail("Enter a valid fiscal year.");
  return ok({ ...data, settings: { ...s, companyName: s.companyName.trim() } }, s);
}
