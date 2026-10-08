"use client";

import { Download, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv, toCsv, type CsvCell } from "@/lib/csv";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { AGING_BUCKETS, agingReport, balanceSheet, incomeStatement, periodRange, PERIOD_LABELS, trialBalance, type PeriodKind, type StatementRow } from "@/services/ais/reports";
import styles from "../ais.module.css";
import { AisPage, AisPageLoading } from "../AisPage";
import { ChipDate, ChipSelect } from "../AisList";
import { useAis } from "../AisProvider";

const REPORTS = [
  { id: "income-statement", label: "Income Statement" },
  { id: "balance-sheet", label: "Balance Sheet" },
  { id: "trial-balance", label: "Trial Balance" },
  { id: "ar-aging", label: "AR Aging" },
  { id: "ap-aging", label: "AP Aging" },
] as const;
type ReportId = (typeof REPORTS)[number]["id"];

const money = (c: number) => <span>{formatMoney(c)}</span>;
const plain = (c: number) => (c / 100).toFixed(2);

export function ReportsPage() {
  const { data, ready } = useAis();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();

  const urlReport = REPORTS.find((r) => r.id === params.get("report"))?.id;
  const [report, setReport] = useState<ReportId>(urlReport ?? "income-statement");
  const [preset, setPreset] = useState<PeriodKind | "custom">((["month", "lastMonth", "quarter", "ytd"] as string[]).includes(params.get("period") ?? "") ? (params.get("period") as PeriodKind) : "ytd");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asOf, setAsOf] = useState("");
  const [accountId, setAccountId] = useState("");
  const [query, setQuery] = useState("");

  // keep the form in sync with the books (reporting date) and with deep links such as ?report=income-statement&period=lastMonth
  useEffect(() => {
    if (urlReport) setReport(urlReport);
  }, [urlReport]);
  useEffect(() => {
    if (!ready) return;
    if (preset !== "custom") {
      const r = periodRange(preset, data);
      setFrom(r.from);
      setTo(r.to);
    }
    setAsOf((cur) => cur || data.settings.reportingDate);
  }, [ready, preset, data]);

  const usesAccount = report === "income-statement" || report === "balance-sheet" || report === "trial-balance";
  const accountFilter = usesAccount && accountId ? accountId : undefined;

  const view = useMemo(() => {
    if (!ready || !from || !to || !asOf) return null;
    const q = query.trim().toLowerCase();
    const keep = (r: { code: string; name: string }) => !q || r.name.toLowerCase().includes(q) || r.code.includes(q);
    const keepRows = (rows: StatementRow[]) => rows.filter(keep);
    switch (report) {
      case "income-statement": {
        const is = incomeStatement(data, { from, to }, accountFilter);
        return { kind: "is" as const, is, revenue: keepRows(is.revenue), expenses: keepRows(is.expenses), total: is.revenue.length + is.expenses.length };
      }
      case "balance-sheet": {
        const bs = balanceSheet(data, asOf, accountFilter);
        return { kind: "bs" as const, bs, assets: keepRows(bs.assets), liabilities: keepRows(bs.liabilities), equity: keepRows(bs.equity), total: bs.assets.length + bs.liabilities.length + bs.equity.length };
      }
      case "trial-balance": {
        const tb = trialBalance(data, asOf, accountFilter);
        return { kind: "tb" as const, tb, rows: tb.rows.filter(keep), total: tb.rows.length };
      }
      case "ar-aging":
      case "ap-aging": {
        const ag = agingReport(data, report === "ar-aging" ? "ar" : "ap", asOf);
        return { kind: "ag" as const, ag, rows: ag.rows.filter((r) => !q || r.party.toLowerCase().includes(q)), total: ag.rows.length, label: report === "ar-aging" ? "Customer" : "Vendor" };
      }
    }
  }, [ready, data, report, from, to, asOf, accountFilter, query]);

  if (!ready) return <AisPageLoading title="Reports" />;

  const title = REPORTS.find((r) => r.id === report)!.label;
  const periodLabel = report === "income-statement" ? `${formatDate(from)} – ${formatDate(to)}` : `As of ${formatDate(asOf)}`;
  const accountName = accountId ? data.accounts.find((a) => a.id === accountId) : undefined;

  const exportCsv = () => {
    if (!view) return;
    let headers: string[] = [];
    let rows: CsvCell[][] = [];
    if (view.kind === "is") {
      headers = ["Section", "Code", "Account", "Amount"];
      rows = [...view.revenue.map((r) => ["Revenue", r.code, r.name, plain(r.amount)]), ["Revenue", "", "Total revenue", plain(view.is.totalRevenue)], ...view.expenses.map((r) => ["Expenses", r.code, r.name, plain(r.amount)]), ["Expenses", "", "Total expenses", plain(view.is.totalExpenses)], ["", "", "Net income", plain(view.is.netIncome)]];
    } else if (view.kind === "bs") {
      headers = ["Section", "Code", "Account", "Amount"];
      rows = [...view.assets.map((r) => ["Assets", r.code, r.name, plain(r.amount)]), ["Assets", "", "Total assets", plain(view.bs.totalAssets)], ...view.liabilities.map((r) => ["Liabilities", r.code, r.name, plain(r.amount)]), ["Liabilities", "", "Total liabilities", plain(view.bs.totalLiabilities)], ...view.equity.map((r) => ["Equity", r.code, r.name, plain(r.amount)]), ["Equity", "", "Current earnings", plain(view.bs.currentEarnings)], ["Equity", "", "Total equity", plain(view.bs.totalEquity)]];
    } else if (view.kind === "tb") {
      headers = ["Code", "Account", "Type", "Debit", "Credit"];
      rows = [...view.rows.map((r) => [r.code, r.name, r.type, plain(r.debit), plain(r.credit)]), ["", "Totals", "", plain(view.tb.totalDebit), plain(view.tb.totalCredit)]];
    } else {
      headers = [view.label, ...AGING_BUCKETS.map((b) => (b === "Current" ? "Current" : `${b} days`)), "Total"];
      rows = [...view.rows.map((r) => [r.party, ...AGING_BUCKETS.map((b) => plain(r.buckets[b])), plain(r.total)]), ["Total", ...AGING_BUCKETS.map((b) => plain(view.ag.totals.buckets[b])), plain(view.ag.totals.total)]];
    }
    if (rows.length === 0) return toast.info("There is nothing to export for this report.");
    const file = `${report}-${report === "income-statement" ? `${from}_to_${to}` : asOf}`;
    downloadCsv(file, toCsv(headers, rows));
    toast.success(`Exported ${title} to ${file}.csv.`);
  };

  const selectReport = (id: ReportId) => {
    setReport(id);
    setQuery("");
    router.replace(`/ais/reports?report=${id}`, { scroll: false });
  };

  const empty = view && view.total === 0;
  const filteredOut = view && view.total > 0 && ((view.kind === "is" && view.revenue.length + view.expenses.length === 0) || (view.kind === "bs" && view.assets.length + view.liabilities.length + view.equity.length === 0) || ((view.kind === "tb" || view.kind === "ag") && view.rows.length === 0));

  const section = (label: string, rows: StatementRow[], total?: { label: string; amount: number }) => (
    <>
      <tr className={styles.section}><td colSpan={3}>{label}</td></tr>
      {rows.map((r) => (
        <tr key={r.accountId} className={styles.line}><td style={{ width: 80, color: "var(--text-secondary)" }}>{r.code}</td><td>{r.name}</td><td className={styles.num}>{money(r.amount)}</td></tr>
      ))}
      {total && <tr className={styles.total}><td colSpan={2}>{total.label}</td><td className={styles.num}>{money(total.amount)}</td></tr>}
    </>
  );

  return (
    <AisPage title="Reports" subtitle="Financial statements and aging, calculated from posted journal entries.">
      <div className={styles.reportTabs} role="tablist" aria-label="Report">
        {REPORTS.map((r) => (
          <button key={r.id} type="button" role="tab" aria-selected={r.id === report} className={`${styles.reportTab} ${r.id === report ? styles.reportTabOn : ""}`} onClick={() => selectReport(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className={styles.reportBar}>
        {report === "income-statement" ? (
          <>
            <ChipSelect label="Period" value={preset} onChange={(v) => setPreset(v as PeriodKind | "custom")} options={[...(Object.keys(PERIOD_LABELS) as PeriodKind[]).map((k) => ({ value: k, label: PERIOD_LABELS[k] })), { value: "custom", label: "Custom range" }]} />
            <ChipDate label="From" value={from} onChange={(v) => { setFrom(v); setPreset("custom"); }} />
            <ChipDate label="To" value={to} onChange={(v) => { setTo(v); setPreset("custom"); }} />
          </>
        ) : (
          <ChipDate label="As of" value={asOf} onChange={setAsOf} />
        )}
        {usesAccount && (
          <ChipSelect label="Account" value={accountId} onChange={setAccountId} options={[{ value: "", label: "All accounts" }, ...[...data.accounts].sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))]} />
        )}
        <label className={styles.searchBox}>
          <Search size={14} aria-hidden />
          <input type="search" aria-label="Search this report" placeholder={report.endsWith("aging") ? "Search names…" : "Search accounts…"} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className={styles.chip} onClick={exportCsv}>
          <Download size={15} strokeWidth={1.75} aria-hidden /> Export CSV
        </button>
      </div>

      <section className={styles.report} aria-label={title}>
        <div className={styles.reportHead}>
          <div className={styles.reportTitle}>{title}</div>
          <div className={styles.reportSub}>
            {data.settings.companyName} · {periodLabel}
            {accountName && ` · ${accountName.code} ${accountName.name}`}
          </div>
        </div>
        {!view ? null : empty ? (
          <EmptyState title="No activity for these filters" description="There are no posted amounts for the chosen dates or account. Widen the range or choose All accounts." />
        ) : filteredOut ? (
          <EmptyState title="No rows match your search" description={`Nothing matches “${query}”. Clear the search to see the full report.`} />
        ) : (
          <div className={styles.reportScroll}>
            {view.kind === "is" && (
              <table className={styles.stmt}>
                <tbody>
                  {section("Revenue", view.revenue, { label: "Total revenue", amount: view.is.totalRevenue })}
                  {section("Expenses", view.expenses, { label: "Total expenses", amount: view.is.totalExpenses })}
                  <tr className={styles.grand}><td colSpan={2}>Net income</td><td className={styles.num} style={{ color: view.is.netIncome >= 0 ? "var(--success)" : "#ff4d6a" }}>{money(view.is.netIncome)}</td></tr>
                </tbody>
              </table>
            )}
            {view.kind === "bs" && (
              <table className={styles.stmt}>
                <tbody>
                  {section("Assets", view.assets, { label: "Total assets", amount: view.bs.totalAssets })}
                  {section("Liabilities", view.liabilities, { label: "Total liabilities", amount: view.bs.totalLiabilities })}
                  <Fragment>
                    <tr className={styles.section}><td colSpan={3}>Equity</td></tr>
                    {view.equity.map((r) => <tr key={r.accountId} className={styles.line}><td style={{ width: 80, color: "var(--text-secondary)" }}>{r.code}</td><td>{r.name}</td><td className={styles.num}>{money(r.amount)}</td></tr>)}
                    {!accountFilter && <tr className={styles.line}><td />
                      <td>Current earnings (not yet closed)</td><td className={styles.num}>{money(view.bs.currentEarnings)}</td></tr>}
                    <tr className={styles.total}><td colSpan={2}>Total equity</td><td className={styles.num}>{money(view.bs.totalEquity)}</td></tr>
                  </Fragment>
                  {!accountFilter && <tr className={styles.grand}><td colSpan={2}>Total liabilities and equity</td><td className={styles.num}>{money(view.bs.totalLiabilities + view.bs.totalEquity)}</td></tr>}
                </tbody>
              </table>
            )}
            {view.kind === "tb" && (
              <table className={styles.stmt}>
                <thead><tr><th>Code</th><th>Account</th><th className={styles.num}>Debit</th><th className={styles.num}>Credit</th></tr></thead>
                <tbody>
                  {view.rows.map((r) => <tr key={r.accountId} className={styles.line}><td className={styles.code}>{r.code}</td><td>{r.name}</td><td className={styles.num}>{r.debit ? money(r.debit) : "–"}</td><td className={styles.num}>{r.credit ? money(r.credit) : "–"}</td></tr>)}
                  <tr className={styles.grand}><td colSpan={2}>Totals</td><td className={styles.num}>{money(view.tb.totalDebit)}</td><td className={styles.num}>{money(view.tb.totalCredit)}</td></tr>
                </tbody>
              </table>
            )}
            {view.kind === "ag" && (
              <table className={styles.stmt}>
                <thead><tr><th>{view.label}</th>{AGING_BUCKETS.map((b) => <th key={b} className={styles.num}>{b === "Current" ? "Current" : `${b} days`}</th>)}<th className={styles.num}>Total</th></tr></thead>
                <tbody>
                  {view.rows.map((r) => <tr key={r.partyId} className={styles.line}><td>{r.party}</td>{AGING_BUCKETS.map((b) => <td key={b} className={styles.num}>{r.buckets[b] ? money(r.buckets[b]) : "–"}</td>)}<td className={styles.num}><strong>{money(r.total)}</strong></td></tr>)}
                  <tr className={styles.grand}><td>Total</td>{AGING_BUCKETS.map((b) => <td key={b} className={styles.num}>{money(view.ag.totals.buckets[b])}</td>)}<td className={styles.num}>{money(view.ag.totals.total)}</td></tr>
                </tbody>
              </table>
            )}
          </div>
        )}
        {view && !empty && !filteredOut && (
          <div className={styles.reportNote}>
            {query.trim() && "Totals include every account, not only the rows shown. "}
            {view.kind === "bs" && <Badge tone={view.bs.balanced || accountFilter ? "statusPaid" : "statusOverdue"}>{accountFilter ? "Filtered to one account" : view.bs.balanced ? "Balanced: assets = liabilities + equity" : "Out of balance"}</Badge>}
            {view.kind === "tb" && <Badge tone={view.tb.balanced || accountFilter ? "statusPaid" : "statusOverdue"}>{accountFilter ? "Filtered to one account" : view.tb.balanced ? "Debits equal credits" : "Debits and credits differ"}</Badge>}
          </div>
        )}
      </section>
    </AisPage>
  );
}
