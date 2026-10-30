"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSharedOperations } from "./useSharedOperations";

type Voucher = { orderId: string; id: string; number: string; url: string };
export function FemaTest({ base = "/api/operations", boss = false }: { base?: string; boss?: boolean }) {
  const { snapshot, error, busy, connected, dispatch } = useSharedOperations(base);
  const [runId, setRunId] = useState("20261030-A");
  const [notice, setNotice] = useState("");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [saving, setSaving] = useState(false);
  const data = snapshot?.data;
  const orders = data?.orders.filter(o => o.testRun === runId) ?? [];
  const transactions = data?.transactions.filter(t => t.testRun === runId) ?? [];
  const products = data?.products.filter(p => p.sku.startsWith("TEST-" + runId + "-")) ?? [];
  useEffect(() => {
    if (!boss) return;
    fetch("/api/multiplexer/test-vouchers", { cache: "no-store" }).then(async r => {
      if (!r.ok) throw new Error("Could not load BOSS vouchers");
      setVouchers((await r.json()).vouchers);
    }).catch(e => setNotice(e.message));
  }, [boss]);
  const makeVouchers = async (ids: string[]) => {
    setSaving(true);
    try {
      for (const orderId of ids) {
        const r = await fetch("/api/multiplexer/test-vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId }) });
        const v = await r.json();
        if (!r.ok) throw new Error(v.error || "Voucher save failed");
        setVouchers(previous => [...previous.filter(p => p.orderId !== orderId), v]);
      }
      setNotice("Test vouchers saved in BOSS. Repeating this action reuses the same vouchers.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Voucher save failed"); }
    finally { setSaving(false); }
  };
  const run = async () => {
    try {
      const result = await dispatch({ action: "runFemaTest", runId });
      setNotice(result.message);
      const ids = (result.value as { orderIds: string[] }).orderIds;
      if (boss) await makeVouchers(ids);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Test failed"); }
  };
  return <section className="fema-test">
    <style>{`.fema-test{max-width:1200px;margin:24px auto;padding:24px;color:inherit}.fema-test h1{font-size:28px;margin:8px 0}.fema-test h2{font-size:19px;margin:24px 0 12px}.fema-test p{margin:10px 0;line-height:1.5}.fema-test .warning{padding:16px;border:1px solid #c8a04d;border-radius:10px;background:#9a710b18}.fema-test .flow{padding:16px;border:1px solid #548187;border-radius:10px;line-height:1.8}.fema-test a{color:#51acb5;text-decoration:underline}.fema-test input,.fema-test button{font:inherit;color:inherit;background:transparent;border:1px solid #62728a;border-radius:6px;padding:10px;margin:8px}.fema-test button{cursor:pointer}.fema-test button:disabled{opacity:.5;cursor:default}.fema-test table{width:100%;border-collapse:collapse;text-align:left}.fema-test td,.fema-test th{padding:12px;border-bottom:1px solid #61718b66;vertical-align:top}.fema-test .table-wrap{overflow:auto}.fema-test pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border:1px solid #61718b66}.fema-test details{margin:12px 0}.fema-test small{display:block}.fema-test [role=alert]{color:#e78b78}`}</style>
    <Link href={boss ? "/multiplexer" : "/shared"}>Back to shared operations</Link>
    <h1>FEMA scenario test</h1>
    <p>{connected ? "Live updates connected" : "Connecting / refresh fallback"} · Revision {snapshot?.revision ?? "—"} · Supabase primary</p>
    <div className="warning"><strong>INTERNAL TEST ONLY — not a real FEMA order</strong>
      <p>200 EA baby wipes to Guam; 100 EA baby ointment to Branford, Florida (assumed). Isolated virtual inventory, synthetic item codes and test tracking. No physical goods, external messages, carrier booking or delivery confirmation.</p>
      <p>The 850/856 adapter is a restricted test subset, not a certified FEMA/LSCMS/GEX mapping. Exact addresses, pack sizes and partner implementation guides remain required.</p>
    </div>
    <h2>What this exercises</h2>
    <p className="flow">Synthetic X12 850 → validate envelope + translate item codes → reserve test stock → two orders / shipments → stored X12 856 ASNs (not sent) → BOSS order-receipt vouchers<br/>Both apps ↔ Supabase primary → Railway asynchronous standby</p>
    <label>Test run ID <input aria-label="Test run ID" value={runId} onChange={e => setRunId(e.target.value.toUpperCase())} maxLength={17} /></label>
    <button disabled={busy || saving || !snapshot || orders.length > 0 || !/^[0-9]{8}-[A-Z0-9]{1,8}$/.test(runId)} onClick={() => void run()}>{busy ? "Running test…" : "Run isolated FEMA test"}</button>
    {boss && orders.length > 0 && <button disabled={busy || saving} onClick={() => void makeVouchers(orders.map(o => o.id))}>{saving ? "Saving vouchers…" : "Create / recheck BOSS test vouchers"}</button>}
    {!boss && <p><a href="https://frontend-boss-production.up.railway.app/multiplexer/test">Open the BOSS test report and create vouchers</a></p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <h2>Order → shipment → ASN → voucher</h2>
    <div className="table-wrap"><table><thead><tr><th>Order / destination</th><th>Translation</th><th>Shipment / ASN</th><th>BOSS voucher</th></tr></thead><tbody>
      {orders.map(o => {
        const inbound = transactions.find(t => t.type === "850" && t.orderId === o.id);
        const asn = transactions.find(t => t.type === "856" && t.orderId === o.id);
        const voucher = vouchers.find(v => v.orderId === o.id);
        return <tr key={o.id}><td><strong>{o.id}</strong><small>{o.reference}</small><p>{o.shipTo?.city}, {o.shipTo?.region}</p></td>
          <td>{inbound?.lines.map(l => <p key={l.sku}>{l.code} → {l.desc}<small>{l.qty} EA · {l.sku}</small></p>)}</td>
          <td>{o.shipmentId}<p>{asn?.ref ?? "No ASN"}</p><small>TEST dispatch only · ASN NOT SENT · NOT DELIVERED</small></td>
          <td>{voucher ? <Link href={voucher.url}>{voucher.number}</Link> : boss ? "Not created yet" : <a href="https://frontend-boss-production.up.railway.app/multiplexer/test">View in BOSS</a>}</td></tr>;
      })}
    </tbody></table></div>
    {!orders.length && <p>No results for this run. Running it creates clearly labeled test records in the shared database.</p>}
    <h2>Inventory reconciliation</h2>
    <p>Test receipts: 200 wipes + 100 ointment. Expected after simulated dispatch: on hand 0, reserved 0. Real inventory is unchanged.</p>
    <div className="table-wrap"><table><thead><tr><th>Test product</th><th>On hand</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{products.map(p => <tr key={p.sku}><td>{p.name}<small>{p.sku}</small></td><td>{p.onHand}</td><td>{p.reserved}</td><td>{p.onHand - p.reserved}</td></tr>)}</tbody></table></div>
    <h2>Stored EDI evidence</h2>
    {transactions.map(t => <details key={t.id}><summary>{t.type} · {t.ref} · {t.dir === "in" ? "Synthetic input" : "Generated, NOT SENT"}</summary><pre>{t.rawEdi}</pre></details>)}
    <p>Vouchers acknowledge the test order internally. They are not signed proof of delivery or payment receipts. Test records are retained for review; no real business records are overwritten.</p>
  </section>;
}

