import type { SharedData } from "@/lib/shared-contract";
/** Maps only the explicit internal test scenario. Never guesses a real FEMA item/contract/address. */
export function testVoucherInput(data: SharedData, orderId: string, actor: string) {
  const order = data.orders.find(o => o.id === orderId);
  const shipment = data.shipments.find(s => s.id === order?.shipmentId);
  const asn = data.transactions.find(t => t.type === "856" && t.orderId === orderId && t.testRun === order?.testRun);
  if (!order?.testRun || !order.shipTo || !shipment || !asn?.rawEdi || shipment.status !== "transit") throw new Error("A dispatched internal test order with a stored ASN is required.");
  if (order.partnerId !== `TEST-${order.testRun}` || order.lines.some(l => !l.sku.startsWith(`TEST-${order.testRun}-`))) throw new Error("Only isolated test inventory can create a test voucher.");
  const destination = `${order.shipTo.city}, ${order.shipTo.region}, ${order.shipTo.country}`;
  const lines = order.lines.map(l => {
    const product = data.products.find(p => p.sku === l.sku);
    if (!product || product.unit !== "EA") throw new Error("Mapped test product missing or unit mismatch.");
    return { ...l, name: product.name };
  });
  return {
    voucherId: `TEST-MUX:${order.id}`,
    docType: "FT", docStatus: "Planned",
    headline: "TEST ONLY - ORDER RECEIPT / UNSENT ASN",
    accrualDate: new Date(order.ts).toISOString().slice(0, 10),
    vendorCode: "FEMA-TEST", operatorCode: "TEST-RECEIVING",
    vendorAccount: "FEMA scenario - simulated partner\nNOT a real FEMA order",
    operatedBy: `${order.shipTo.name}\n${destination}\nExact address NOT verified`,
    contractNo: order.reference,
    reference2: `${order.id} / ${shipment.id} / ${asn.ref}`,
    deliverVia: shipment.carrier, tracking: shipment.tracking,
    resource: "TEST VIRTUAL INVENTORY",
    manifest: lines.map(l => `${l.name}: ${l.qty} EA to ${destination}`).join("\n"),
    // CLIN is a narrow printed column, and no real contract line has been supplied.
    manifestLines: lines.map(l => `TEST | ${l.name} | ${l.qty} EA (test only) | ${destination} | ${shipment.id}`).join("\n"),
    packLines: lines.map(l => `TEST | EA | Not specified | 1 | ${l.qty}`).join("\n"),
    voucherNote: `TEST ONLY: ${order.testRun}\nReceipt of order: ${order.reference}\nASN: ${asn.ref} - generated, NOT SENT\nDelivery: NOT performed or confirmed\nCreated by: ${actor}\nTest SKU codes and locations are assumptions; not FEMA-approved mappings.`,
    terms: "INTERNAL TEST ONLY. No physical goods moved.\nNot an invoice, proof of delivery, signed receipt,\nor authorization to ship. No external transmission.",
  };
}
