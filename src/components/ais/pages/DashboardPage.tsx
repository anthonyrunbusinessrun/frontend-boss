"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { formatMoney, formatMoneyCompact, formatMoneyWhole } from "@/lib/money";
import { attentionItems, cashFlow, dashboardMetrics, monthlySeries, PERIOD_LABELS, type Delta, type PeriodKind } from "@/services/ais/reports";
import ais from "../ais.module.css";
import styles from "../dashboard.module.css";
import { AisPage, AisPageLoading } from "../AisPage";
import { ChipSelect } from "../AisList";
import { useAis } from "../AisProvider";

const TONE = { danger: "#ff4d6a", warn: "#f5b800", ok: "#34d249" } as const;

/** "↑ 12.4%" with green for good news and red for bad news (`upIsGood` flips for expenses). */
function DeltaText({ delta, upIsGood }: { delta: Delta; upIsGood: boolean }) {
  if (delta.pct === null) return <span className={styles.neutral}>No prior period</span>;
  const up = delta.pct >= 0;
  const good = up === upIsGood;
  return (
    <span className={Math.abs(delta.pct) < 0.05 ? styles.neutral : good ? styles.up : styles.down}>
      {up ? "↑" : "↓"} {Math.abs(delta.pct).toFixed(1)}%
    </span>
  );
}

const pct = (n: number | null, sign = false) => (n === null ? "–" : `${sign && n > 0 ? "+" : ""}${n.toFixed(1)}%`);

export function DashboardPage() {
  const { data, ready } = useAis();
  const [period, setPeriod] = useState<PeriodKind>("month");

  const m = useMemo(() => dashboardMetrics(data, period), [data, period]);
  const series = useMemo(() => monthlySeries(data, 6), [data]);
  const flow = useMemo(() => cashFlow(data, m.range), [data, m.range]);
  const attention = useMemo(() => attentionItems(data), [data]);

  if (!ready) return <AisPageLoading title="Accounting Dashboard" />;

  const max = Math.max(1, ...series.flatMap((s) => [s.revenue, s.expenses]));
  const ceil = Math.ceil(max / 5_000_000) * 5_000_000 || max; // round the axis to $50K steps
  const flowMax = Math.max(1, flow.cashIn, flow.cashOut, Math.abs(flow.net));
  const noData = m.revenue === 0 && m.expenses === 0;

  return (
    <AisPage
      title="Accounting Dashboard"
      subtitle={`AIS · ${data.settings.companyName} · FY${data.settings.fiscalYear} · as of ${formatDate(data.settings.reportingDate)}`}
      actions={
        <>
          <ChipSelect label="Period" value={period} onChange={(v) => setPeriod(v as PeriodKind)} options={(Object.keys(PERIOD_LABELS) as PeriodKind[]).map((k) => ({ value: k, label: PERIOD_LABELS[k] }))} />
        </>
      }
    >
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Total revenue</div>
              <div className={styles.kpiValue}>{formatMoneyWhole(m.revenue)}</div>
              <div className={styles.kpiNote}><DeltaText delta={m.deltas.revenue} upIsGood /> {m.deltas.revenue.previous !== null && <>vs prior period ({formatMoneyCompact(m.deltas.revenue.previous)})</>}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Net income</div>
              <div className={styles.kpiValue} style={{ color: m.netIncome >= 0 ? "var(--success)" : "#ff4d6a" }}>{formatMoneyWhole(m.netIncome)}</div>
              <div className={styles.kpiNote}><DeltaText delta={m.deltas.netIncome} upIsGood /> {m.deltas.netIncome.previous !== null && <>vs prior period ({formatMoneyCompact(m.deltas.netIncome.previous)})</>}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Cash balance</div>
              <div className={styles.kpiValue}>{formatMoneyWhole(m.cash)}</div>
              <div className={styles.kpiNote}><DeltaText delta={m.deltas.cash} upIsGood /> {m.deltas.cash.previous !== null && <>vs prior period ({formatMoneyCompact(m.deltas.cash.previous)})</>}</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Total expenses</div>
              <div className={styles.kpiValue}>{formatMoneyWhole(m.expenses)}</div>
              <div className={styles.kpiNote}><DeltaText delta={m.deltas.expenses} upIsGood={false} /> {m.deltas.expenses.previous !== null && <>vs prior period ({formatMoneyCompact(m.deltas.expenses.previous)})</>}</div>
            </div>
            <Link href="/ais/accounts-receivable" className={`${styles.kpi} ${styles.kpiLink}`}>
              <div className={styles.kpiLabel}>Accounts receivable</div>
              <div className={styles.kpiValue}>{formatMoneyWhole(m.receivables)}</div>
              <div className={styles.kpiNote}>{m.openInvoices} open invoice{m.openInvoices === 1 ? "" : "s"}</div>
            </Link>
            <Link href="/ais/accounts-payable" className={`${styles.kpi} ${styles.kpiLink}`}>
              <div className={styles.kpiLabel}>Accounts payable</div>
              <div className={styles.kpiValue}>{formatMoneyWhole(m.payables)}</div>
              <div className={styles.kpiNote}>{m.openBills} open bill{m.openBills === 1 ? "" : "s"}</div>
            </Link>
          </div>

          <section className={styles.panel} aria-labelledby="rve">
            <div className={styles.panelHead}>
              <div>
                <h2 id="rve" className={styles.panelTitle}>Revenue vs Expenses</h2>
                <p className={styles.panelSub}>Last 6 months · posted entries · all accounts</p>
              </div>
              <div className={styles.legend}>
                <span><span className={styles.dot} style={{ background: "#2fc43f" }} />Revenue</span>
                <span><span className={styles.dot} style={{ background: "#d9112f" }} />Expenses</span>
              </div>
            </div>
            <div className={styles.chart} role="img" aria-label={`Monthly revenue and expenses. ${series.map((s) => `${s.label}: revenue ${formatMoneyCompact(s.revenue)}, expenses ${formatMoneyCompact(s.expenses)}`).join("; ")}.`}>
              {[0, 0.5, 1].map((f) => (
                <div key={f}>
                  <div className={styles.gridLine} style={{ bottom: `${f * 100}%` }} />
                  <span className={styles.gridLabel} style={{ bottom: `${f * 100}%` }}>{formatMoneyCompact(Math.round(ceil * f))}</span>
                </div>
              ))}
              <div className={styles.bars}>
                {series.map((s) => (
                  <div key={s.key} className={styles.group} title={`${s.label}: revenue ${formatMoney(s.revenue)} · expenses ${formatMoney(s.expenses)}`}>
                    <div className={`${styles.bar} ${styles.barRev}`} style={{ height: `${(s.revenue / ceil) * 100}%` }} />
                    <div className={`${styles.bar} ${styles.barExp}`} style={{ height: `${(s.expenses / ceil) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.months} aria-hidden>{series.map((s) => <span key={s.key}>{s.label}</span>)}</div>
          </section>

          <section className={styles.panel} aria-labelledby="cfo">
            <div className={styles.panelHead}>
              <div>
                <h2 id="cfo" className={styles.panelTitle}>Cash Flow Overview</h2>
                <p className={styles.panelSub}>{PERIOD_LABELS[period]} · {formatDate(m.range.from)} – {formatDate(m.range.to)}</p>
              </div>
            </div>
            {flow.cashIn === 0 && flow.cashOut === 0 ? (
              <p className={ais.stickyNote} style={{ marginTop: 16 }}>No cash moved in this period.</p>
            ) : (
              <div className={styles.flowRows}>
                <div className={styles.flow}><span>Cash in</span><div className={styles.track}><div className={styles.fill} style={{ width: `${(flow.cashIn / flowMax) * 100}%`, background: "#2fc43f" }} /></div><span className={styles.flowAmount}>{formatMoney(flow.cashIn)}</span></div>
                <div className={styles.flow}><span>Cash out</span><div className={styles.track}><div className={styles.fill} style={{ width: `${(flow.cashOut / flowMax) * 100}%`, background: "#d9112f" }} /></div><span className={styles.flowAmount}>{formatMoney(flow.cashOut)}</span></div>
                <div className={styles.flow}><span>Net cash flow</span><div className={styles.track}><div className={styles.fill} style={{ width: `${(Math.abs(flow.net) / flowMax) * 100}%`, background: "#e0b000" }} /></div><span className={styles.flowAmount} style={{ color: flow.net >= 0 ? "var(--success)" : "#ff4d6a" }}>{flow.net >= 0 ? "+" : "-"}{formatMoney(Math.abs(flow.net))}</span></div>
              </div>
            )}
          </section>
          {noData && <p className={ais.stickyNote}>There is no posted activity in this period. Choose another period or post an entry.</p>}
        </div>

        <div className={styles.side}>
          <section className={styles.panel} aria-labelledby="att">
            <div className={styles.panelHead}>
              <h2 id="att" className={styles.panelTitle}>Attention Required</h2>
              <span className={styles.countBadge} aria-label={`${attention.length} items`}>{attention.length}</span>
            </div>
            <div className={styles.attention} style={{ marginTop: 10 }}>
              {attention.map((a) => (
                <div key={a.id} className={styles.attentionItem}>
                  <span className={styles.attentionDot} style={{ background: TONE[a.tone] }} aria-hidden />
                  <div>
                    {a.text}{" "}
                    <Link href={a.href} className={styles.attentionLink}>{a.action}</Link>
                  </div>
                </div>
              ))}
              {attention.length === 0 && <p className={ais.stickyNote}>Nothing needs your attention. Books are up to date.</p>}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="fh">
            <h2 id="fh" className={styles.panelTitle}>Financial Health</h2>
            <div className={styles.health}>
              <div className={styles.tile}><div className={styles.tileLabel}>Profit margin</div><div className={styles.tileValue}>{pct(m.profitMargin)}</div><div className={styles.tileNote}>of total revenue</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Revenue growth</div><div className={styles.tileValue} style={{ color: m.revenueGrowth === null ? undefined : m.revenueGrowth >= 0 ? "var(--success)" : "#ff4d6a" }}>{pct(m.revenueGrowth, true)}</div><div className={styles.tileNote}>vs prior period</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Expense growth</div><div className={styles.tileValue} style={{ color: m.expenseGrowth === null ? undefined : m.expenseGrowth > 0 ? "#f5b800" : "var(--success)" }}>{pct(m.expenseGrowth, true)}</div><div className={styles.tileNote}>vs prior period</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Avg days to collect</div><div className={styles.tileValue}>{m.avgDaysToCollect === null ? "–" : Math.round(m.avgDaysToCollect)}</div><div className={styles.tileNote}>on paid invoices</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Cash runway</div><div className={styles.tileValue}>{m.cashRunwayMonths === null ? "–" : `${m.cashRunwayMonths.toFixed(1)} mo`}</div><div className={styles.tileNote}>at current expenses</div></div>
              <div className={styles.tile}><div className={styles.tileLabel}>Collection rate</div><div className={styles.tileValue} style={{ color: m.collectionRate !== null && m.collectionRate >= 90 ? "var(--success)" : undefined }}>{m.collectionRate === null ? "–" : `${Math.round(m.collectionRate)}%`}</div><div className={styles.tileNote}>of due invoices paid</div></div>
            </div>
          </section>
        </div>
      </div>
    </AisPage>
  );
}
