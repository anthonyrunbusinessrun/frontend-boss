import { isIsoDate } from "@/lib/dates";
import type { Account, AisData, Bill, Customer, Invoice, JournalEntry, Payment, Vendor } from "@/types/ais";
import { billBalance, entryTotals, invoiceBalance, invoiceTotal, billTotal, paidAgainst, paymentTotal } from "./ledger";

/** Field → message. An empty object means the input is valid. */
export type Errors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ----------------------------- journal ----------------------------- */

export interface JournalValidation {
  /** Entry-level problems, shown in the banner. */
  summary: string[];
  /** Per line id: which cell is wrong. */
  lines: Record<string, { account?: string; amount?: string }>;
  totals: { debit: number; credit: number; difference: number };
  balanced: boolean;
  valid: boolean;
}

export function validateJournalEntry(entry: Pick<JournalEntry, "date" | "memo" | "lines">, accounts: Account[]): JournalValidation {
  const summary: string[] = [];
  const lines: JournalValidation["lines"] = {};
  const totals = entryTotals(entry);
  const difference = totals.debit - totals.credit;

  if (!entry.date || !isIsoDate(entry.date)) summary.push("Choose a valid entry date.");
  if (entry.memo.trim() === "") summary.push("Add a memo describing the entry.");

  const used = entry.lines.filter((l) => l.accountId !== "" || l.debit !== 0 || l.credit !== 0);
  if (used.length < 2) summary.push("A journal entry needs at least two lines (one debit and one credit).");

  for (const l of entry.lines) {
    const empty = l.accountId === "" && l.debit === 0 && l.credit === 0;
    if (empty) continue;
    const errs: { account?: string; amount?: string } = {};
    if (l.accountId === "") errs.account = "Choose an account.";
    else if (!accounts.some((a) => a.id === l.accountId && a.active)) errs.account = "This account is inactive or no longer exists.";
    if (l.debit < 0 || l.credit < 0) errs.amount = "Amounts cannot be negative.";
    else if (l.debit > 0 && l.credit > 0) errs.amount = "Use either debit or credit on a line, not both.";
    else if (l.debit === 0 && l.credit === 0) errs.amount = "Enter a debit or a credit amount.";
    if (errs.account || errs.amount) lines[l.id] = errs;
  }
  if (Object.keys(lines).length > 0) summary.push("Fix the highlighted lines.");

  const balanced = totals.debit === totals.credit && totals.debit > 0;
  if (totals.debit !== totals.credit) summary.push("Total debits must equal total credits.");
  else if (totals.debit === 0 && used.length >= 2) summary.push("The entry has no amounts.");

  return { summary, lines, totals: { ...totals, difference }, balanced, valid: summary.length === 0 };
}

/* ------------------------------ parties ------------------------------ */

export function validateParty(p: Pick<Customer | Vendor, "name" | "email" | "code">, existing: Array<{ id: string; code: string }>, selfId: string | null, label: string): Errors {
  const e: Errors = {};
  if (p.name.trim() === "") e.name = `${label} name is required.`;
  if (p.code.trim() === "") e.code = "A code is required.";
  else if (existing.some((x) => x.id !== selfId && x.code.toLowerCase() === p.code.trim().toLowerCase())) e.code = `Another ${label.toLowerCase()} already uses this code.`;
  if (p.email.trim() !== "" && !EMAIL.test(p.email.trim())) e.email = "Enter a valid email address.";
  return e;
}

export function validateAccount(a: Pick<Account, "code" | "name">, accounts: Account[], selfId: string | null): Errors {
  const e: Errors = {};
  if (!/^\d{4,6}$/.test(a.code.trim())) e.code = "Use a 4–6 digit account code.";
  else if (accounts.some((x) => x.id !== selfId && x.code === a.code.trim())) e.code = "This account code is already in use.";
  if (a.name.trim() === "") e.name = "Account name is required.";
  return e;
}

/* ------------------------------ documents ------------------------------ */

export function validateInvoice(inv: Invoice, data: AisData): Errors {
  const e: Errors = {};
  if (!inv.customerId) e.customerId = "Choose a customer.";
  else if (!data.customers.some((c) => c.id === inv.customerId)) e.customerId = "This customer no longer exists.";
  if (!isIsoDate(inv.issueDate)) e.issueDate = "Choose an issue date.";
  if (!isIsoDate(inv.dueDate)) e.dueDate = "Choose a due date.";
  else if (isIsoDate(inv.issueDate) && inv.dueDate < inv.issueDate) e.dueDate = "The due date cannot be before the issue date.";
  const real = inv.lines.filter((l) => l.description.trim() !== "" || l.unitPrice !== 0 || l.accountId !== "");
  if (real.length === 0) e.lines = "Add at least one line item.";
  for (const l of real) {
    if (l.description.trim() === "") e[`${l.id}.description`] = "Describe the item.";
    if (!(l.quantity > 0)) e[`${l.id}.quantity`] = "Quantity must be above zero.";
    if (l.unitPrice < 0) e[`${l.id}.unitPrice`] = "Price cannot be negative.";
    if (l.accountId === "") e[`${l.id}.accountId`] = "Choose a revenue account.";
  }
  if (real.length > 0 && invoiceTotal({ ...inv, lines: real }) <= 0) e.lines = "The invoice total must be above zero.";
  const paid = paidAgainst(data.payments, inv.id);
  if (paid > 0 && invoiceTotal({ ...inv, lines: real }) < paid) e.lines = "The total cannot be lower than the payments already received.";
  return e;
}

export function validateBill(bill: Bill, data: AisData): Errors {
  const e: Errors = {};
  if (!bill.vendorId) e.vendorId = "Choose a vendor.";
  else if (!data.vendors.some((v) => v.id === bill.vendorId)) e.vendorId = "This vendor no longer exists.";
  if (!isIsoDate(bill.billDate)) e.billDate = "Choose a bill date.";
  if (!isIsoDate(bill.dueDate)) e.dueDate = "Choose a due date.";
  else if (isIsoDate(bill.billDate) && bill.dueDate < bill.billDate) e.dueDate = "The due date cannot be before the bill date.";
  const real = bill.lines.filter((l) => l.description.trim() !== "" || l.amount !== 0 || l.accountId !== "");
  if (real.length === 0) e.lines = "Add at least one line.";
  for (const l of real) {
    if (l.description.trim() === "") e[`${l.id}.description`] = "Describe the expense.";
    if (!(l.amount > 0)) e[`${l.id}.amount`] = "Amount must be above zero.";
    if (l.accountId === "") e[`${l.id}.accountId`] = "Choose an expense account.";
  }
  const paid = paidAgainst(data.payments, bill.id);
  if (real.length > 0 && paid > 0 && billTotal({ ...bill, lines: real }) < paid) e.lines = "The total cannot be lower than the payments already made.";
  return e;
}

export function validatePayment(p: Payment, data: AisData): Errors {
  const e: Errors = {};
  if (!p.partyId) e.partyId = p.direction === "received" ? "Choose a customer." : "Choose a vendor.";
  if (!isIsoDate(p.date)) e.date = "Choose a payment date.";
  if (!p.accountId) e.accountId = "Choose the bank account.";
  const applied = p.allocations.filter((a) => a.amount !== 0);
  if (applied.length === 0) e.allocations = "Apply the payment to at least one open document.";
  for (const a of p.allocations) {
    if (a.amount < 0) e[`alloc.${a.documentId}`] = "Amount cannot be negative.";
    else if (a.amount > 0) {
      const doc = p.direction === "received" ? data.invoices.find((i) => i.id === a.documentId) : data.bills.find((b) => b.id === a.documentId);
      const balance = !doc ? 0 : p.direction === "received" ? invoiceBalance(data, doc as Invoice, p.id) : billBalance(data, doc as Bill, p.id);
      if (a.amount > balance) e[`alloc.${a.documentId}`] = "More than the open balance.";
    }
  }
  if (applied.length > 0 && paymentTotal(p) <= 0) e.allocations = "The payment total must be above zero.";
  return e;
}

