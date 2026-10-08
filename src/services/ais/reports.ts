import { addMonths, diffDays, endOfMonth, monthKey, monthLong, monthShort, startOfMonth } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Account, AccountType, AisData } from "@/types/ais";
import {
  accountById,
  accountTotals,
  billBalance,
  billStatus,
  billTotal,
  invoiceBalance,
  invoiceStatus,
  invoiceTotal,
  isCashAccount,
  isOpenBill,
  isOpenInvoice,
  signedBalance,
} from "./ledger";

/* Report and dashboard calculations. Everything is derived from posted journal lines. */

export interface DateRange {
  from: string;
  to: string;
}

/* ----------------------------- periods ----------------------------- */

export type PeriodKind = "month" | "lastMonth" | "quarter" | "ytd";
export const PERIOD_LABELS: Record<PeriodKind, string> = { month: "This month", lastMonth: "Last month", quarter: "This quarter", ytd: "Year to date" };

export function periodRange(kind: PeriodKind, data: AisData): DateRange {
  const asOf = data.settings.reportingDate;
  const monthStart = startOfMonth(asOf);
  switch (kind) {
    case "month":
      return { from: monthStart, to: endOfMonth(asOf) };
    case "lastMonth": {
      const prev = addMonths(monthStart, -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case "quarter": {
      const m = Number(asOf.slice(5, 7));
      const qStartMonth = m - ((m - 1) % 3);
      const from = `${asOf.slice(0, 4)}-${String(qStartMonth).padStart(2, "0")}-01`;
      return { from, to: endOfMonth(addMonths(from, 2)) };
    }
    case "ytd": {
      const y = data.settings.fiscalYear;
      const start = `${y}-${String(data.settings.fiscalYearStartMonth).padStart(2, "0")}-01`;
      return { from: start, to: asOf };
    }
  }
}

/** The period of the same kind right before `kind`, or null when a comparison makes no sense (YTD). */
export function previousPeriodRange(kind: PeriodKind, data: AisData): DateRange | null {
  const cur = periodRange(kind, data);
  switch (kind) {
    case "month":
    case "lastMonth": {
      const prev = addMonths(cur.from, -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case "quarter": {
      const prev = addMonths(cur.from, -3);
      return { from: prev, to: endOfMonth(addMonths(prev, 2)) };
    }
    case "ytd":
      return null;
  }
}

/* --------------------------- statements --------------------------- */

export interface StatementRow {
  accountId: string;
  code: string;
  name: string;
  subtype: string;
  amount: number;
}

function rowsFor(data: AisData, type: AccountType, range: DateRange | { to: string }, accountFilter?: string): StatementRow[] {
  const totals = accountTotals(data, "from" in range ? range : { to: range.to });
  return data.accounts
    .filter((a) => a.type === type && (!accountFilter || a.id === accountFilter))
    .map((a) => {
      const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
      // Statement sign follows the section (assets / expenses are debit-natural), so a contra account such as
      // accumulated depreciation shows as a negative inside Assets instead of inflating it.
      const debitNatural = type === "Asset" || type === "Expense";
      return { accountId: a.id, code: a.code, name: a.name, subtype: a.subtype, amount: debitNatural ? t.debit - t.credit : t.credit - t.debit };
    })
    .filter((r) => r.amount !== 0)
    .sort((x, y) => x.code.localeCompare(y.code));
}

export interface IncomeStatement {
  revenue: StatementRow[];
  expenses: StatementRow[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

export function incomeStatement(data: AisData, range: DateRange, accountFilter?: string): IncomeStatement {
  const revenue = rowsFor(data, "Revenue", range, accountFilter);
  const expenses = rowsFor(data, "Expense", range, accountFilter);
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0);
  return { revenue, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export function trialBalance(data: AisData, asOf: string, accountFilter?: string) {
  const totals = accountTotals(data, { to: asOf });
  const rows: TrialBalanceRow[] = [];
  for (const a of data.accounts) {
    if (accountFilter && a.id !== accountFilter) continue;
    const t = totals.get(a.id);
    if (!t) continue;
    const net = t.debit - t.credit;
    if (net === 0) continue;
    rows.push({ accountId: a.id, code: a.code, name: a.name, type: a.type, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 });
  }
  rows.sort((x, y) => x.code.localeCompare(y.code));
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { rows, totalDebit: debit, totalCredit: credit, balanced: debit === credit };
}

export interface BalanceSheet {
  assets: StatementRow[];
  liabilities: StatementRow[];
  equity: StatementRow[];
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

export function balanceSheet(data: AisData, asOf: string, accountFilter?: string): BalanceSheet {
  const assets = rowsFor(data, "Asset", { to: asOf }, accountFilter);
  const liabilities = rowsFor(data, "Liability", { to: asOf }, accountFilter);
  const equity = rowsFor(data, "Equity", { to: asOf }, accountFilter);
  // Books are not closed at year end in this prototype, so all revenue/expense to date is "current earnings".
  const is = incomeStatement(data, { from: "0000-01-01", to: asOf });
  const currentEarnings = accountFilter ? 0 : is.netIncome;
  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0) + currentEarnings;
  return { assets, liabilities, equity, currentEarnings, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
}

/* ------------------------------- aging ------------------------------- */

export const AGING_BUCKETS = ["Current", "1–30", "31–60", "61–90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

export function agingBucket(dueDate: string, asOf: string): AgingBucket {
  const late = diffDays(asOf, dueDate);
  if (late <= 0) return "Current";
  if (late <= 30) return "1–30";
  if (late <= 60) return "31–60";
  if (late <= 90) return "61–90";
  return "90+";
}

export interface AgingRow {
  partyId: string;
  party: string;
  buckets: Record<AgingBucket, number>;
  total: number;
}

export function agingReport(data: AisData, kind: "ar" | "ap", asOf = data.settings.reportingDate) {
  const rows = new Map<string, AgingRow>();
  const add = (partyId: string, party: string, due: string, balance: number) => {
    if (balance <= 0) return;
    const row = rows.get(partyId) ?? { partyId, party, buckets: { Current: 0, "1–30": 0, "31–60": 0, "61–90": 0, "90+": 0 }, total: 0 };
    row.buckets[agingBucket(due, asOf)] += balance;
    row.total += balance;
    rows.set(partyId, row);
  };
  if (kind === "ar") {
    for (const inv of data.invoices) if (isOpenInvoice(data, inv) && inv.issueDate <= asOf) add(inv.customerId, data.customers.find((c) => c.id === inv.customerId)?.name ?? "Unknown customer", inv.dueDate, invoiceBalance(data, inv));
  } else {
    for (const b of data.bills) if (isOpenBill(data, b) && b.billDate <= asOf) add(b.vendorId, data.vendors.find((v) => v.id === b.vendorId)?.name ?? "Unknown vendor", b.dueDate, billBalance(data, b));
  }
  const list = [...rows.values()].sort((a, b) => b.total - a.total);
  const totals = { buckets: { Current: 0, "1–30": 0, "31–60": 0, "61–90": 0, "90+": 0 } as Record<AgingBucket, number>, total: 0 };
  for (const r of list) {
    for (const k of AGING_BUCKETS) totals.buckets[k] += r.buckets[k];
    totals.total += r.total;
  }
  return { rows: list, totals };
}

/* ----------------------------- dashboard ----------------------------- */

export interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
}

/** Revenue and expenses for the `count` months ending with the reporting month. */
export function monthlySeries(data: AisData, count = 6): MonthPoint[] {
  const last = startOfMonth(data.settings.reportingDate);
  const points: MonthPoint[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addMonths(last, -i);
    const is = incomeStatement(data, { from: start, to: endOfMonth(start) });
    points.push({ key: monthKey(start), label: monthShort(monthKey(start)), revenue: is.totalRevenue, expenses: is.totalExpenses });
  }
  return points;
}

/** Net cash movement of entries that touch cash and something else (pure account transfers are ignored). */
export function cashFlow(data: AisData, range: DateRange) {
  let cashIn = 0;
  let cashOut = 0;
  for (const e of data.journalEntries) {
    if (e.status !== "Posted" || e.date < range.from || e.date > range.to) continue;
    let cash = 0;
    let other = false;
    for (const l of e.lines) {
      const a = accountById(data, l.accountId);
      if (a && isCashAccount(a)) cash += l.debit - l.credit;
      else other = true;
    }
    if (!other || cash === 0) continue;
    if (cash > 0) cashIn += cash;
    else cashOut += -cash;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

export function cashBalance(data: AisData, asOf: string): number {
  const totals = accountTotals(data, { to: asOf });
  let sum = 0;
  for (const a of data.accounts) if (isCashAccount(a)) sum += signedBalance(a, totals.get(a.id)?.debit ?? 0, totals.get(a.id)?.credit ?? 0);
  return sum;
}

export function receivablesTotal(data: AisData): number {
  return data.invoices.filter((i) => isOpenInvoice(data, i)).reduce((s, i) => s + invoiceBalance(data, i), 0);
}
export function payablesTotal(data: AisData): number {
  return data.bills.filter((b) => isOpenBill(data, b)).reduce((s, b) => s + billBalance(data, b), 0);
}

const pct = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

export interface Delta {
  /** Percentage change vs the previous period (null when there is nothing to compare). */
  pct: number | null;
  previous: number | null;
}

export interface DashboardMetrics {
  range: DateRange;
  revenue: number;
  expenses: number;
  netIncome: number;
  cash: number;
  receivables: number;
  payables: number;
  openInvoices: number;
  openBills: number;
  deltas: { revenue: Delta; expenses: Delta; netIncome: Delta; cash: Delta };
  profitMargin: number | null;
  revenueGrowth: number | null;
  expenseGrowth: number | null;
  /** Months of average expenses the cash balance covers. */
  cashRunwayMonths: number | null;
  /** Share (by value) of invoices already due that have been paid. */
  collectionRate: number | null;
  /** Average days between issue and payment for paid invoices (days sales outstanding proxy). */
  avgDaysToCollect: number | null;
}

export function dashboardMetrics(data: AisData, kind: PeriodKind): DashboardMetrics {
  const range = periodRange(kind, data);
  const prev = previousPeriodRange(kind, data);
  const cur = incomeStatement(data, range);
  const before = prev ? incomeStatement(data, prev) : null;
  const cash = cashBalance(data, range.to);
  const cashBefore = prev ? cashBalance(data, prev.to) : null;
  const delta = (c: number, p: number | null): Delta => ({ pct: p === null ? null : pct(c, p), previous: p });

  // runway: cash vs the average monthly expense of the last three months of the reporting date
  const series = monthlySeries(data, 3);
  const avgExpense = series.reduce((s, m) => s + m.expenses, 0) / (series.length || 1);

  // collection: invoices due on or before the reporting date
  const asOf = data.settings.reportingDate;
  const due = data.invoices.filter((i) => i.status === "Sent" && i.dueDate <= asOf);
  const dueTotal = due.reduce((s, i) => s + invoiceTotal(i), 0);
  const collected = due.reduce((s, i) => s + (invoiceTotal(i) - invoiceBalance(data, i)), 0);

  // days to collect from paid invoices
  const paidDays: number[] = [];
  for (const inv of data.invoices) {
    if (inv.status !== "Sent" || invoiceBalance(data, inv) > 0) continue;
    let last = "";
    for (const p of data.payments) if (p.allocations.some((a) => a.documentId === inv.id) && p.date > last) last = p.date;
    if (last) paidDays.push(diffDays(last, inv.issueDate));
  }

  return {
    range,
    revenue: cur.totalRevenue,
    expenses: cur.totalExpenses,
    netIncome: cur.netIncome,
    cash,
    receivables: receivablesTotal(data),
    payables: payablesTotal(data),
    openInvoices: data.invoices.filter((i) => isOpenInvoice(data, i)).length,
    openBills: data.bills.filter((b) => isOpenBill(data, b)).length,
    deltas: {
      revenue: delta(cur.totalRevenue, before ? before.totalRevenue : null),
      expenses: delta(cur.totalExpenses, before ? before.totalExpenses : null),
      netIncome: delta(cur.netIncome, before ? before.netIncome : null),
      cash: delta(cash, cashBefore),
    },
    profitMargin: cur.totalRevenue > 0 ? (cur.netIncome / cur.totalRevenue) * 100 : null,
    revenueGrowth: before ? pct(cur.totalRevenue, before.totalRevenue) : null,
    expenseGrowth: before ? pct(cur.totalExpenses, before.totalExpenses) : null,
    cashRunwayMonths: avgExpense > 0 ? cash / avgExpense : null,
    collectionRate: dueTotal > 0 ? (collected / dueTotal) * 100 : null,
    avgDaysToCollect: paidDays.length ? paidDays.reduce((s, d) => s + d, 0) / paidDays.length : null,
  };
}

export interface AttentionItem {
  id: string;
  tone: "danger" | "warn" | "ok";
  text: string;
  action: string;
  href: string;
}

/** Things that need a person: overdue money, approvals, drafts. Links open the matching filtered list. */
export function attentionItems(data: AisData): AttentionItem[] {
  const items: AttentionItem[] = [];
  const overdueInv = data.invoices.filter((i) => invoiceStatus(data, i) === "Overdue");
  if (overdueInv.length) {
    const sum = overdueInv.reduce((s, i) => s + invoiceBalance(data, i), 0);
    items.push({ id: "overdue-inv", tone: "danger", text: `${overdueInv.length} invoice${overdueInv.length === 1 ? " is" : "s are"} overdue, totaling ${formatMoney(sum)}`, action: "Review", href: "/ais/accounts-receivable?filter=overdue" });
  }
  const overdueBills = data.bills.filter((b) => billStatus(data, b) === "Overdue");
  if (overdueBills.length) {
    const sum = overdueBills.reduce((s, b) => s + billBalance(data, b), 0);
    items.push({ id: "overdue-bill", tone: "danger", text: `${overdueBills.length} bill${overdueBills.length === 1 ? " is" : "s are"} overdue, totaling ${formatMoney(sum)}`, action: "Pay", href: "/ais/accounts-payable?filter=overdue" });
  }
  const awaiting = data.bills.filter((b) => b.status === "Awaiting Approval");
  if (awaiting.length) items.push({ id: "approve-bills", tone: "warn", text: `${awaiting.length} bill${awaiting.length === 1 ? " is" : "s are"} awaiting approval`, action: "Approve", href: "/ais/bills?status=Awaiting%20Approval" });
  const draftInv = data.invoices.filter((i) => i.status === "Draft");
  if (draftInv.length) items.push({ id: "draft-inv", tone: "warn", text: `${draftInv.length} draft invoice${draftInv.length === 1 ? " is" : "s are"} ready to send`, action: "Review", href: "/ais/invoices?status=Draft" });
  const draftJe = data.journalEntries.filter((e) => e.status === "Draft");
  if (draftJe.length) items.push({ id: "draft-je", tone: "warn", text: `${draftJe.length} journal entr${draftJe.length === 1 ? "y is" : "ies are"} saved as draft`, action: "Post", href: "/ais/journal-entries?status=Draft" });
  const last = addMonths(startOfMonth(data.settings.reportingDate), -1);
  items.push({ id: "report", tone: "ok", text: `${monthLong(monthKey(last))} income statement is ready`, action: "View", href: `/ais/reports?report=income-statement&period=lastMonth` });
  return items;
}

/* --------------------------- misc lookups --------------------------- */

export const partyName = (data: AisData, kind: "customer" | "vendor", id: string) => (kind === "customer" ? data.customers.find((c) => c.id === id)?.name : data.vendors.find((v) => v.id === id)?.name) ?? "Unknown";

export const accountLabel = (a: Account | undefined) => (a ? `${a.code} · ${a.name}` : "Unknown account");

export function openDocuments(data: AisData, direction: "received" | "made", partyId: string, ignorePaymentId?: string): Array<{ id: string; number: string; dueDate: string; total: number; balance: number }> {
  if (direction === "received") {
    return data.invoices
      .filter((i) => i.customerId === partyId && i.status === "Sent" && invoiceBalance(data, i, ignorePaymentId) > 0)
      .map((i) => ({ id: i.id, number: i.number, dueDate: i.dueDate, total: invoiceTotal(i), balance: invoiceBalance(data, i, ignorePaymentId) }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  return data.bills
    .filter((b) => b.vendorId === partyId && b.status === "Approved" && billBalance(data, b, ignorePaymentId) > 0)
    .map((b) => ({ id: b.id, number: b.number, dueDate: b.dueDate, total: billTotal(b), balance: billBalance(data, b, ignorePaymentId) }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

