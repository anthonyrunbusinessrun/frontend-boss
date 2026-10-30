import { test } from "node:test";
import assert from "node:assert/strict";
import { testVoucherInput } from "./test-voucher";
import { emptySharedData } from "@/lib/shared-contract";
import { buildVoucherDocument } from "@/lib/base/voucherDocument";
import { createRecord } from "@/server/base/store";
import { createTestDb } from "@/server/base/testDb";
import { testDatabaseUrl } from "@/server/base/testDatabaseUrl";

function fixture() {
  const data = emptySharedData();
  data.products.push({ sku: "TEST-20261030-A-WIPES", name: "TEST ONLY - Baby wipes", unit: "EA", onHand: 0, reserved: 0, location: "TEST", reorderPoint: 0 });
  data.orders.push({ id: "MUX-1", testRun: "20261030-A", reference: "TEST-PO-1", partnerId: "TEST-20261030-A", shipTo: { name: "TEST Guam", city: "Guam", region: "GU", country: "US" }, due: 1793318400000, ts: 1793318400000, status: "shipping", via: "TEST EDI 850", shipmentId: "SHP-1", txnId: "TXN-1", lines: [{ sku: "TEST-20261030-A-WIPES", qty: 200 }] });
  data.shipments.push({ id: "SHP-1", orderId: "MUX-1", status: "transit", carrier: "TEST", tracking: "TEST-TRACK-1", eta: 1793318400000 });
  data.transactions.push({ id: "TXN-2", testRun: "20261030-A", type: "856", dir: "out", partnerId: "TEST-20261030-A", ref: "TEST-ASN-SHP-1", ts: 1793318400000, stage: 2, lines: [], issue: null, orderId: "MUX-1", shipmentId: "SHP-1", history: [], rawEdi: "TEST FIXTURE" });
  return data;
}
test("test voucher mapping preserves quantity, destination and traceability without implying delivery/payment", () => {
  const input = testVoucherInput(fixture(), "MUX-1", "operator@example.test");
  const doc = buildVoucherDocument({ ...input, id: "test", i: 12000 });
  assert.equal(doc.number, "LLG-FT-16000");
  assert.match(doc.barText, /TEST ONLY/);
  assert.match(doc.ref2, /MUX-1.*SHP-1.*TEST-ASN/);
  assert.equal(doc.pack[0][4], "200");
  assert.match(doc.manifest[0][3], /Guam, GU/);
  assert.match(doc.terms.join(" "), /Not an invoice, proof of delivery/);
});
test("no voucher for a real or incomplete order", () => {
  const data = fixture();
  delete data.orders[0].testRun;
  assert.throws(() => testVoucherInput(data, "MUX-1", "operator"), /test order/);
  assert.throws(() => testVoucherInput(fixture(), "MUX-2", "operator"), /test order/);
});
const admin = testDatabaseUrl();
test("voucher creation retries/concurrent calls reuse one record and one voucher number", { skip: !admin }, async () => {
  const db = await createTestDb(admin!);
  try {
    const input = testVoucherInput(fixture(), "MUX-1", "operator@example.test");
    const rows = await Promise.all(Array.from({ length: 4 }, () => createRecord(db.pool, "vouchers", input, { idempotencyKey: { field: "voucherId", value: input.voucherId } })));
    assert.equal(new Set(rows.map(r => r.id)).size, 1);
    assert.equal(new Set(rows.map(r => r.i)).size, 1);
    assert.equal((await db.pool.query("SELECT count(*)::int AS n FROM boss_records WHERE section_slug='vouchers' AND data->>'voucherId'=$1", [input.voucherId])).rows[0].n, 1);
    await assert.rejects(createRecord(db.pool, "vouchers", input, { idempotencyKey: { field: "headline", value: input.headline } }), /unique field/);
  } finally { await db.drop(); }
});
