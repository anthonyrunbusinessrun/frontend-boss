import type { Account, AisData, Bill, DocStatus, Invoice, JournalEntry, JournalLine, Payment } from "@/types/ais";

/* Pure accounting logic: totals, statuses, auto-posting and balances. No React, no storage. */

/** Control accounts the system posts to. They cannot be deleted or re-typed. */
export const SYSTEM_CODES = { ar: "1100", ap: "2000", retained: "3100" } as const;

export const accountById = (data: AisData, id: string) => data.accounts.find((a) => a.id === id);
export const accountByCode = (data: AisData, code: string) => data.accounts.find((a) => a.code === code);
export const isCashAccount = (a: Account) => a.subtype === "Cash";

/* ------------------------------ totals ------------------------------ */

export const lineAmount = (l: { quantity: number; unitPrice: number }) => Math.round(l.quantity * l.unitPrice);
export const invoiceTotal = (inv: Invoice) => inv.lines.reduce((s, l) => s + lineAmount(l), 0);
export const billTotal = (b: Bill) => b.lines.reduce((s, l) => s + l.amount, 0);
export const paymentTotal = (p: Payment) => p.allocations.reduce((s, a) => s + a.amount, 0);

export function paidAgainst(payments: Payment[], documentId: string, ignorePaymentId?: string): number {
  let sum = 0;
  for (const p of payments) {
    if (p.id === ignorePaymentId) continue;
    for (const a of p.allocations) if (a.documentId === documentId) sum += a.amount;
  }
  return sum;
}

export const invoiceBalance = (data: AisData, inv: Invoice, ignorePaymentId?: string) => invoiceTotal(inv) - paidAgainst(data.payments, inv.id, ignorePaymentId);
export const billBalance = (data: AisData, bill: Bill, ignorePaymentId?: string) => billTotal(bill) - paidAgainst(data.payments, bill.id, ignorePaymentId);

/* ------------------------------ status ------------------------------ */

export function invoiceStatus(data: AisData, inv: Invoice): DocStatus {
  if (inv.status === "Draft" || inv.status === "Void") return inv.status;
  const total = invoiceTotal(inv);
  const paid = paidAgainst(data.payments, inv.id);
  if (total > 0 && paid >= total) return "Paid";
  if (inv.dueDate < data.settings.reportingDate) return "Overdue";
  return paid > 0 ? "Partially Paid" : "Open";
}

export function billStatus(data: AisData, bill: Bill): DocStatus {
  if (bill.status !== "Approved") return bill.status;
  const total = billTotal(bill);
  const paid = paidAgainst(data.payments, bill.id);
  if (total > 0 && paid >= total) return "Paid";
  if (bill.dueDate < data.settings.reportingDate) return "Overdue";
  return paid > 0 ? "Partially Paid" : "Approved";
}

/** Invoices that still owe money (sent, not fully paid). */
export const isOpenInvoice = (data: AisData, inv: Invoice) => inv.status === "Sent" && invoiceBalance(data, inv) > 0;
export const isOpenBill = (data: AisData, bill: Bill) => bill.status === "Approved" && billBalance(data, bill) > 0;

/* ----------------------------- numbering ----------------------------- */

export function nextNumber(prefix: string, existing: string[]): string {
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && n.startsWith(prefix)) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/* --------------------------- journal helpers --------------------------- */

export const entryTotals = (e: Pick<JournalEntry, "lines">) => ({
  debit: e.lines.reduce((s, l) => s + l.debit, 0),
  credit: e.lines.reduce((s, l) => s + l.credit, 0),
});

export const isBalanced = (e: Pick<JournalEntry, "lines">) => {
  const t = entryTotals(e);
  return t.debit === t.credit && t.debit > 0;
};

export const signedBalance = (a: Account, debit: number, credit: number) => (a.normalBalance === "debit" ? debit - credit : credit - debit);

export interface PostedLine extends JournalLine {
  entryId: string;
  entryNumber: string;
  date: string;
  memo: string;
  source: JournalEntry["source"];
}

export function postedLines(data: AisData): PostedLine[] {
  const out: PostedLine[] = [];
  for (const e of data.journalEntries) {
    if (e.status !== "Posted") continue;
    for (const l of e.lines) out.push({ ...l, entryId: e.id, entryNumber: e.number, date: e.date, memo: e.memo, source: e.source });
  }
  return out;
}

export interface Totals {
  debit: number;
  credit: number;
}

/** Debit / credit totals per account over posted entries in [from, to] (either bound optional). */
export function accountTotals(data: AisData, range: { from?: string; to?: string } = {}): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const l of postedLines(data)) {
    if (range.from && l.date < range.from) continue;
    if (range.to && l.date > range.to) continue;
    const t = map.get(l.accountId) ?? { debit: 0, credit: 0 };
    t.debit += l.debit;
    t.credit += l.credit;
    map.set(l.accountId, t);
  }
  return map;
}

export function accountBalance(data: AisData, accountId: string, range: { from?: string; to?: string } = {}): number {
  const a = accountById(data, accountId);
  if (!a) return 0;
  const t = accountTotals(data, range).get(accountId) ?? { debit: 0, credit: 0 };
  return signedBalance(a, t.debit, t.credit);
}

/* ------------------------- auto-posting builders ------------------------- */

let counter = 0;
const lineId = (prefix: string) => `${prefix}-l${++counter}`;

function entry(base: Omit<JournalEntry, "status" | "lines">, lines: Omit<JournalLine, "id">[]): JournalEntry {
  return { ...base, status: "Posted", lines: lines.map((l) => ({ ...l, id: lineId(base.id) })) };
}

/** Journal entry for a sent invoice: Dr Accounts Receivable, Cr each revenue line. Null for drafts / void. */
export function buildInvoiceEntry(data: AisData, inv: Invoice, number: string): JournalEntry | null {
  if (inv.status !== "Sent") return null;
  const ar = accountByCode(data, SYSTEM_CODES.ar);
  if (!ar) return null;
  const customer = data.customers.find((c) => c.id === inv.customerId);
  const total = invoiceTotal(inv);
  return entry(
    { id: `je-inv-${inv.id}`, number, date: inv.issueDate, memo: `Invoice ${inv.number} · ${customer?.name ?? "Customer"}`, source: "Invoice", sourceId: inv.id },
    [
      { accountId: ar.id, description: `Invoice ${inv.number}`, debit: total, credit: 0 },
      ...inv.lines.map((l) => ({ accountId: l.accountId, description: l.description, debit: 0, credit: lineAmount(l) })),
    ],
  );
}

/** Journal entry for an approved bill: Dr each expense line, Cr Accounts Payable. */
export function buildBillEntry(data: AisData, bill: Bill, number: string): JournalEntry | null {
  if (bill.status !== "Approved") return null;
  const ap = accountByCode(data, SYSTEM_CODES.ap);
  if (!ap) return null;
  const vendor = data.vendors.find((v) => v.id === bill.vendorId);
  const total = billTotal(bill);
  return entry(
    { id: `je-bill-${bill.id}`, number, date: bill.billDate, memo: `Bill ${bill.number} · ${vendor?.name ?? "Vendor"}`, source: "Bill", sourceId: bill.id },
    [
      ...bill.lines.map((l) => ({ accountId: l.accountId, description: l.description, debit: l.amount, credit: 0 })),
      { accountId: ap.id, description: `Bill ${bill.number}`, debit: 0, credit: total },
    ],
  );
}

/** Receipt: Dr bank, Cr Accounts Receivable.  Disbursement: Dr Accounts Payable, Cr bank. */
export function buildPaymentEntry(data: AisData, p: Payment, number: string): JournalEntry | null {
  const control = accountByCode(data, p.direction === "received" ? SYSTEM_CODES.ar : SYSTEM_CODES.ap);
  if (!control) return null;
  const total = paymentTotal(p);
  const party = p.direction === "received" ? data.customers.find((c) => c.id === p.partyId) : data.vendors.find((v) => v.id === p.partyId);
  const received = p.direction === "received";
  return entry(
    { id: `je-pay-${p.id}`, number, date: p.date, memo: `Payment ${p.number} ${received ? "from" : "to"} ${party?.name ?? "party"}`, source: "Payment", sourceId: p.id },
    received
      ? [
          { accountId: p.accountId, description: `Payment ${p.number}`, debit: total, credit: 0 },
          { accountId: control.id, description: `Applied to receivables`, debit: 0, credit: total },
        ]
      : [
          { accountId: control.id, description: `Applied to payables`, debit: total, credit: 0 },
          { accountId: p.accountId, description: `Payment ${p.number}`, debit: 0, credit: total },
        ],
  );
}

/** Reversing entry: same lines with debits and credits swapped. */
export function buildReversal(original: JournalEntry, id: string, number: string, date: string): JournalEntry {
  return {
    id,
    number,
    date,
    memo: `Reversal of ${original.number}`,
    status: "Posted",
    source: "Manual",
    reversalOf: original.id,
    lines: original.lines.map((l, i) => ({ id: `${id}-l${i + 1}`, accountId: l.accountId, description: l.description, debit: l.credit, credit: l.debit })),
  };
}
