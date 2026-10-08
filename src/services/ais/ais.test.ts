import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSeedData } from "@/data/ais/seed";
import { parseMoney, formatMoney } from "@/lib/money";
import type { AisData, Invoice, JournalEntry, Payment } from "@/types/ais";
import { accountBalance, billBalance, billStatus, entryTotals, invoiceBalance, invoiceStatus, invoiceTotal, isBalanced, nextNumber, SYSTEM_CODES, accountByCode } from "./ledger";
import { deleteAccount, deleteCustomer, deleteInvoice, deleteJournalEntry, deletePayment, reverseJournalEntry, saveBill, saveCustomer, saveInvoice, saveJournalEntry, savePayment, setBillStatus, setInvoiceStatus } from "./mutations";
import { agingReport, attentionItems, balanceSheet, dashboardMetrics, incomeStatement, monthlySeries, periodRange, trialBalance } from "./reports";
import { validateJournalEntry } from "./validation";

const acct = (data: AisData, code: string) => accountByCode(data, code)!.id;
const must = <T,>(r: { ok: true; data: AisData; value: T } | { ok: false; error: string }) => {
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r as { ok: true; data: AisData; value: T };
};

describe("money", () => {
  it("parses user input into cents", () => {
    assert.equal(parseMoney("1,234.50"), 123450);
    assert.equal(parseMoney("$99"), 9900);
    assert.equal(parseMoney("0.1"), 10);
    assert.equal(parseMoney("abc"), null);
    assert.equal(parseMoney("1.234"), null);
    assert.equal(parseMoney(""), null);
  });
  it("formats cents", () => assert.equal(formatMoney(-123456), "-$1,234.56"));
});

describe("seed books", () => {
  const data = createSeedData();
  it("every posted entry balances and the trial balance agrees", () => {
    for (const e of data.journalEntries) assert.ok(isBalanced(e), `${e.number} ${e.memo} is unbalanced`);
    const tb = trialBalance(data, data.settings.reportingDate);
    assert.equal(tb.totalDebit, tb.totalCredit);
    assert.ok(tb.rows.length > 10);
  });
  it("the balance sheet balances", () => assert.ok(balanceSheet(data, data.settings.reportingDate).balanced));
  it("control accounts equal the open documents", () => {
    const ar = data.invoices.filter((i) => i.status === "Sent").reduce((s, i) => s + invoiceBalance(data, i), 0);
    const ap = data.bills.filter((b) => b.status === "Approved").reduce((s, b) => s + billBalance(data, b), 0);
    assert.equal(accountBalance(data, acct(data, SYSTEM_CODES.ar)), ar);
    assert.equal(accountBalance(data, acct(data, SYSTEM_CODES.ap)), ap);
  });
  it("numbers are unique and payments never exceed their documents", () => {
    for (const key of ["invoices", "bills", "payments", "journalEntries"] as const) {
      const numbers = data[key].map((x) => x.number);
      assert.equal(new Set(numbers).size, numbers.length, `${key} numbers are not unique`);
    }
    for (const inv of data.invoices) assert.ok(invoiceBalance(data, inv) >= 0, inv.number);
    for (const b of data.bills) assert.ok(billBalance(data, b) >= 0, b.number);
  });
  it("has realistic overdue / approval / draft work for the dashboard", () => {
    const items = attentionItems(data).map((i) => i.id);
    for (const id of ["overdue-inv", "overdue-bill", "approve-bills", "draft-inv", "draft-je"]) assert.ok(items.includes(id), id);
    assert.equal(data.invoices.filter((i) => invoiceStatus(data, i) === "Overdue").length, 3);
    assert.equal(billStatus(data, data.bills.find((b) => b.reference === "TSS-0830")!), "Overdue");
  });
  it("derives dashboard figures from the ledger", () => {
    const m = dashboardMetrics(data, "month");
    const is = incomeStatement(data, periodRange("month", data));
    assert.equal(m.revenue, is.totalRevenue);
    assert.equal(m.netIncome, m.revenue - m.expenses);
    assert.ok(m.revenue > 0 && m.cash > 0 && m.receivables > 0 && m.payables > 0);
    assert.equal(monthlySeries(data, 6).length, 6);
    const aging = agingReport(data, "ar");
    assert.equal(aging.totals.total, m.receivables);
  });
});

describe("journal entries", () => {
  const data = createSeedData();
  const cash = acct(data, "1000");
  const rent = acct(data, "6200");
  const draft = (debit: number, credit: number): JournalEntry => ({
    id: "je-test",
    number: "",
    date: "2026-09-30",
    memo: "Test entry",
    status: "Draft",
    source: "Manual",
    lines: [
      { id: "a", accountId: rent, description: "Rent", debit, credit: 0 },
      { id: "b", accountId: cash, description: "Cash", debit: 0, credit },
    ],
  });

  it("reports an unbalanced entry and refuses to save it", () => {
    const v = validateJournalEntry(draft(10000, 9000), data.accounts);
    assert.equal(v.balanced, false);
    assert.equal(v.totals.difference, 1000);
    assert.ok(v.summary.some((m) => m.includes("debits must equal")));
    const r = saveJournalEntry(data, draft(10000, 9000), false);
    assert.equal(r.ok, false);
    assert.equal(saveJournalEntry(data, draft(10000, 9000), true).ok, false);
  });
  it("rejects lines with both sides, no account or fewer than two lines", () => {
    const both = draft(100, 100);
    both.lines[0].credit = 100;
    assert.ok(validateJournalEntry(both, data.accounts).lines.a?.amount);
    const noAccount = draft(100, 100);
    noAccount.lines[1].accountId = "";
    assert.ok(validateJournalEntry(noAccount, data.accounts).lines.b?.account);
    const one = draft(100, 100);
    one.lines = one.lines.slice(0, 1);
    assert.ok(validateJournalEntry(one, data.accounts).summary.some((m) => m.includes("at least two")));
  });
  it("saves a balanced entry as draft (no ledger effect) and then posts it", () => {
    const before = accountBalance(data, rent);
    const saved = must(saveJournalEntry(data, draft(25000, 25000), false));
    assert.equal(saved.value.status, "Draft");
    assert.match(saved.value.number, /^JE-\d{4}$/);
    assert.equal(accountBalance(saved.data, rent), before);
    const posted = must(saveJournalEntry(saved.data, { ...saved.value }, true));
    assert.equal(posted.value.number, saved.value.number);
    assert.equal(accountBalance(posted.data, rent), before + 25000);
  });
  it("only deletes drafts, and reverses posted entries once", () => {
    const saved = must(saveJournalEntry(data, draft(5000, 5000), false));
    must(deleteJournalEntry(saved.data, saved.value.id));
    const posted = must(saveJournalEntry(data, draft(5000, 5000), true));
    assert.equal(deleteJournalEntry(posted.data, posted.value.id).ok, false);
    assert.equal(saveJournalEntry(posted.data, posted.value, true).ok, false);
    const rev = must(reverseJournalEntry(posted.data, posted.value.id, "2026-09-30"));
    assert.equal(accountBalance(rev.data, rent), accountBalance(data, rent));
    assert.equal(reverseJournalEntry(rev.data, posted.value.id, "2026-09-30").ok, false);
    assert.equal(reverseJournalEntry(rev.data, rev.value.id, "2026-09-30").ok, false);
  });
  it("totals use exact cents", () => {
    const e = draft(1, 1);
    e.lines[0].debit = 10;
    e.lines[1].credit = 7;
    e.lines.push({ id: "c", accountId: cash, description: "", debit: 0, credit: 3 });
    assert.deepEqual(entryTotals(e), { debit: 10, credit: 10 });
  });
});

describe("invoices, bills and payments", () => {
  const base = createSeedData();
  const newInvoice = (): Invoice => ({
    id: "inv-test",
    number: "",
    customerId: base.customers[0].id,
    issueDate: "2026-09-30",
    dueDate: "2026-10-30",
    terms: "Net 30",
    status: "Draft",
    reference: "",
    notes: "",
    lines: [{ id: "l1", description: "Consulting", quantity: 2, unitPrice: 15000, accountId: acct(base, "4200") }],
  });

  it("a draft invoice does not touch the ledger; sending it posts to receivables and revenue", () => {
    const ar0 = accountBalance(base, acct(base, "1100"));
    const draft = must(saveInvoice(base, newInvoice()));
    assert.match(draft.value.number, /^INV-\d{4}$/);
    assert.equal(accountBalance(draft.data, acct(base, "1100")), ar0);
    const sent = must(setInvoiceStatus(draft.data, "inv-test", "Sent"));
    assert.equal(accountBalance(sent.data, acct(base, "1100")), ar0 + 30000);
    assert.equal(invoiceTotal(sent.value), 30000);
    assert.equal(invoiceStatus(sent.data, sent.value), "Open");
    assert.ok(trialBalance(sent.data, "2026-09-30").balanced);
  });
  it("editing a sent invoice re-posts it with the same journal number", () => {
    const sent = must(saveInvoice(base, { ...newInvoice(), status: "Sent" }));
    const number = sent.data.journalEntries.find((e) => e.sourceId === "inv-test")!.number;
    const edited = must(saveInvoice(sent.data, { ...sent.value, lines: [{ ...sent.value.lines[0], quantity: 3 }] }));
    const entries = edited.data.journalEntries.filter((e) => e.sourceId === "inv-test");
    assert.equal(entries.length, 1);
    assert.equal(entries[0].number, number);
    assert.equal(entryTotals(entries[0]).debit, 45000);
  });
  it("validates the invoice", () => {
    assert.equal(saveInvoice(base, { ...newInvoice(), customerId: "" }).ok, false);
    assert.equal(saveInvoice(base, { ...newInvoice(), lines: [] }).ok, false);
    assert.equal(saveInvoice(base, { ...newInvoice(), dueDate: "2026-09-01" }).ok, false);
  });
  it("records a payment, updates the status and refuses over-payment", () => {
    const sent = must(saveInvoice(base, { ...newInvoice(), status: "Sent" }));
    const pay = (amount: number): Payment => ({ id: "pay-test", number: "", direction: "received", partyId: sent.value.customerId, date: "2026-09-30", method: "Check", accountId: acct(base, "1000"), reference: "", memo: "", allocations: [{ documentId: "inv-test", amount }] });
    assert.equal(savePayment(sent.data, pay(30001)).ok, false);
    assert.equal(savePayment(sent.data, pay(0)).ok, false);
    const part = must(savePayment(sent.data, pay(10000)));
    assert.equal(invoiceStatus(part.data, part.data.invoices.find((i) => i.id === "inv-test")!), "Partially Paid");
    assert.equal(invoiceBalance(part.data, part.data.invoices.find((i) => i.id === "inv-test")!), 20000);
    assert.equal(setInvoiceStatus(part.data, "inv-test", "Void").ok, false);
    assert.equal(deleteInvoice(part.data, "inv-test").ok, false);
    const gone = must(deletePayment(part.data, "pay-test"));
    assert.equal(invoiceBalance(gone.data, gone.data.invoices.find((i) => i.id === "inv-test")!), 30000);
    const full = must(savePayment(sent.data, pay(30000)));
    assert.equal(invoiceStatus(full.data, full.data.invoices.find((i) => i.id === "inv-test")!), "Paid");
  });
  it("overdue is derived from the reporting date", () => {
    const sent = must(saveInvoice(base, { ...newInvoice(), status: "Sent", issueDate: "2026-08-15", dueDate: "2026-09-15" }));
    assert.equal(invoiceStatus(sent.data, sent.value), "Overdue");
  });
  it("walks a bill through approval before it hits payables", () => {
    const ap0 = accountBalance(base, acct(base, "2000"));
    const bill = must(saveBill(base, { id: "bill-test", number: "", vendorId: base.vendors[0].id, billDate: "2026-09-30", dueDate: "2026-10-30", terms: "Net 30", status: "Draft", reference: "X-1", notes: "", lines: [{ id: "l1", description: "Cleaning", amount: 8000, accountId: acct(base, "6300") }] }));
    assert.equal(accountBalance(bill.data, acct(base, "2000")), ap0);
    const awaiting = must(setBillStatus(bill.data, "bill-test", "Awaiting Approval"));
    assert.equal(accountBalance(awaiting.data, acct(base, "2000")), ap0);
    const approved = must(setBillStatus(awaiting.data, "bill-test", "Approved"));
    assert.equal(accountBalance(approved.data, acct(base, "2000")), ap0 + 8000);
    assert.equal(setBillStatus(approved.data, "bill-test", "Draft").ok, false);
  });
  it("protects records that are in use", () => {
    assert.equal(deleteCustomer(base, base.customers[0].id).ok, false);
    assert.equal(deleteAccount(base, acct(base, "1100")).ok, false);
    assert.equal(deleteAccount(base, acct(base, "6200")).ok, false);
    const c = { ...base.customers[0], id: "cus-new", code: "C-1001" };
    assert.equal(saveCustomer(base, c).ok, false, "duplicate code");
    must(saveCustomer(base, { ...c, code: "C-1099", name: "Test Customer" }));
    assert.equal(saveCustomer(base, { ...c, code: "C-1099", name: "" }).ok, false);
  });
  it("numbering continues from the highest used number", () => {
    assert.equal(nextNumber("INV-", ["INV-2301", "INV-2335", "BILL-0003"]), "INV-2336");
    assert.equal(nextNumber("PMT-", []), "PMT-0001");
  });
});
