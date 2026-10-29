import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEMA_VOUCHERS } from "@/data/femaVouchers";
import { buildVoucherDocument } from "./voucherDocument";
import type { RecordRow } from "./types";

const row = (i: number): RecordRow => ({ ...FEMA_VOUCHERS.find((v) => v.i === i)! } as RecordRow);
const doc = (i: number) => buildVoucherDocument(row(i));

/** Expectations below are read off the sample PDFs (1.pdf … 99.pdf) supplied with the template. */
describe("voucher document: what is printed for each sample voucher", () => {
  it("FD 15574 (1.pdf): Freight Delivery Confirmation", () => {
    const d = doc(11574);
    assert.equal(d.number, "LLG-FD-15574");
    assert.equal(d.accrual, "7/9/2026");
    assert.equal(d.topTitle, "Freight Delivery Confirmation");
    assert.equal(d.barText, "ASN - DELIVERED");
    assert.equal(d.caption, "ASN - DELIVERED");
    assert.deepEqual(d.mark, { letter: "L", code: "FD" });
    assert.deepEqual(d.status, { text: "Issued", fill: "#616670", color: "#ffffff" });
    assert.deepEqual([d.leftLabel, d.rightLabel], ["VENDOR ACCOUNT", "OPERATED BY"]);
    assert.deepEqual([d.issuedCode, d.performCode], ["FEMA-HQ", "DC-GRC"]);
    assert.deepEqual(d.leftLines, ["Federal Emergency Management Agency", "500 C Street SW", "Washington, DC 20472"]);
    assert.deepEqual(d.rightLines, ["FEMA DC Greencastle", "12316 Molly Pitcher Hwy", "Greencastle, PA 17225", "(301) 874-4200"]);
    assert.deepEqual([d.ref1, d.ref2], ["70FB7026F00000036", "70FB7026F00000036"]);
    assert.deepEqual(d.via, [{ text: "SAIA LTL Freight", bold: true }, { text: "(609) 807-9228" }, { text: "800-456-7296", bold: true }]);
    assert.deepEqual([d.resource, d.tracking], ["LTL EXPRESS", "5188241"]);
    assert.deepEqual(d.manifest, [["I/T-015", "I/T-015 · GREENCASTLE · Wipes", "", "", ""]]);
    assert.equal(d.terms[0], "Carrier accepts full responsibility for claim, loss, or");
    assert.equal(d.terms.at(-1), "Delivery is required for freight payment.");
    assert.deepEqual(d.note, []);
  });

  it("FT 15575 and 15577 (2.pdf, 3.pdf): Freight Movement In Transit", () => {
    const atl = doc(11575);
    assert.equal(atl.number, "LLG-FT-15575");
    assert.equal(atl.topTitle, "Freight Movement In Transit");
    assert.equal(atl.barText, "ASN - IN TRANSIT");
    assert.equal(atl.leftLabel, "CONTRACTED TO");
    assert.deepEqual(atl.mark, { letter: "L", code: "FT" });
    assert.deepEqual(atl.rightLines, ["FEMA DC Atlanta", "3780 South Side Industrial Ct", "Atlanta, GA 30354", "(404) 279-6380"]);
    assert.deepEqual(atl.manifest[0], ["I/T-015", "I/T-015 · ATLANTA · Wipes", "", "", ""]);
    assert.deepEqual(atl.via.map((l) => l.text), ["SAIA LTL Freight", "(609) 807-9228", "800-456-7296"]);
    assert.deepEqual(doc(11577).rightLines, ["FEMA DC Tracy", "1547 E Grant Line Rd", "Tracy, CA 95304", "(209) 836-7601"]);
  });

  it("BL 15578 (4.pdf): Bill of Lading, consignee and ship to, mark R", () => {
    const d = doc(11578);
    assert.equal(d.number, "LLG-BL-15578");
    assert.equal(d.accrual, "7/27/2026");
    assert.equal(d.topTitle, "Original | Non Negotiable");
    assert.equal(d.barText, "BILL OF LADING");
    assert.deepEqual(d.mark, { letter: "R", code: "BL" });
    assert.deepEqual([d.leftLabel, d.rightLabel], ["CONSIGNEE", "SHIP TO"]);
    assert.deepEqual([d.issuedCode, d.performCode], ["LLG", "LLG"]);
    const land = ["Land Logistics", "304 SW Suwannee Avenue", "Branford, Florida 32008", "(202) 875-2320"];
    assert.deepEqual(d.leftLines, land);
    assert.deepEqual(d.rightLines, land);
    assert.deepEqual([d.ref1, d.ref2], ["70FB7026F00000036", "37702097"]);
    assert.deepEqual(d.via, [{ text: "Total Quality Logistics", bold: true }, { text: "(513) 831-2600" }], "no second phone on a Bill of Lading");
    assert.deepEqual([d.resource, d.tracking], ["FTL", "37702097"]);
    assert.deepEqual(d.note, [
      { text: "Total Quality Logistics (TQL)", bold: true },
      { label: "Phone Number:", text: "(513) 831-2600" },
      { label: "Est. Price of Delivery:", text: "$3,750.00" },
      { label: "Pick-up time:", text: "7:00 AM to 4:30 PM" },
      { label: "Pick-up date:", text: "07/28/26" },
    ]);
    assert.deepEqual(d.manifest.map((m) => m[1]), ["P/U - EMERALD PRODUCTS", "Pallet of Baby Bottles, Nipples, and Wipes", "D/O - LAND BRANFORD HQ"]);
    assert.equal(d.terms[0], "Shipment is tendered in accordance with applicable");
    assert.ok(d.terms.includes(""), "paragraphs are separated by a blank line");
    assert.equal(d.status!.text, "Issued");
  });

  it("FQ 15579 (5.pdf): Freight RFQ with its quote texts and placeholders", () => {
    const d = doc(11579);
    assert.equal(d.number, "LLG-FQ-15579");
    assert.equal(d.accrual, "7/16/2026");
    assert.equal(d.topTitle, "Request for Quote & Availability");
    assert.equal(d.barText, "FREIGHT RFQ");
    assert.equal(d.leftLabel, "QUOTE FROM");
    assert.deepEqual(d.mark, { letter: "L", code: "FQ" });
    assert.deepEqual(d.status, { text: "Planned", fill: "#88dbff", color: "#0b3552" });
    assert.deepEqual(d.leftLines, ["Please Provide Quotations", "to Action@RayLand.com", "Thank you in advance, -Action Team"]);
    assert.deepEqual(d.rightLines, [], "no Perform code, nothing to print");
    assert.deepEqual([d.ref1, d.ref2], ["Airline Sales Order:", "Airline Booking #:"]);
    assert.deepEqual(d.via.map((l) => l.text), ["VIA FREE ENTRY", "VIA FREE ENTRY", "VIA FREE ENTRY"]);
    assert.deepEqual([d.resource, d.tracking], ["TRANSPORTATION", "TRACKING #"]);
    assert.deepEqual(d.note, [
      { label: "Company:", text: "ABC Company" },
      { label: "Sales Person:", text: "XYZ" },
      { label: "Contact Number:", text: "+ 1 000 000" },
      { label: "Date Issued:", text: "00/00/00" },
    ]);
    assert.equal(d.manifest[0][1], "QUOTE REQUESTED:");
    assert.equal(d.manifest.length, 5);
    assert.equal(d.terms[0], "This document is provided for informational and");
  });

  it("BL 15589 (8.pdf): BOOKED pill and an itemised manifest", () => {
    const d = doc(11589);
    assert.equal(d.accrual, "8/6/2026");
    assert.deepEqual(d.status, { text: "BOOKED", fill: "#c4ecff", color: "#0b3552" });
    assert.deepEqual(d.rightLines.slice(0, 2), ["FEMA DC Atlanta", "3780 South Side Industrial Ct"]);
    assert.deepEqual(d.via.map((l) => l.text), ["SAIA LTL Freight", "(609) 807-9228"]);
    assert.equal(d.ref2, "5753602");
    assert.equal(d.manifest.length, 6);
    assert.equal(d.manifest[0][1], "P/U - LAND BRANFORD HQ");
    assert.deepEqual(d.note, [
      { text: "SAIA LTL Freight", bold: true },
      { label: "Phone Number:", text: "(609) 807-9228" },
      { label: "Pick-up date:", text: "08/06/26" },
      { label: "Drop off time:", text: "Before 2:30 PM" },
      { label: "Special Instruction:", text: "Do not double stack the pallets." },
    ]);
  });

  it("IN 15595 (99.pdf): Invoice, bill to and shipped to, mark R", () => {
    const d = doc(11595);
    assert.equal(d.number, "LLG-IN-15595");
    assert.equal(d.accrual, "8/10/2026");
    assert.equal(d.topTitle, "Request for Payment");
    assert.equal(d.barText, "INVOICE");
    assert.deepEqual([d.leftLabel, d.rightLabel], ["BILL TO", "SHIPPED TO"]);
    assert.deepEqual(d.mark, { letter: "R", code: "IN" });
    assert.deepEqual(d.rightLines, ["FEMA DC Puerto Rico", "San Juan Industrial Park FEMA", "PR-1, KM 25.1", "Caguas, PR 725", "(787) 413-1926"]);
    assert.equal(d.ref2, "L 705200152");
    assert.equal(d.terms[0], "Payment is due within 30 days of invoice date");
  });

  it("every row of the FEMA sheet builds a complete document whose number matches the sheet", () => {
    assert.equal(FEMA_VOUCHERS.length, 16);
    for (const v of FEMA_VOUCHERS) {
      const d = buildVoucherDocument(v as unknown as RecordRow);
      assert.equal(d.number, `LLG-${v.docType}-${v.i + 4000}`);
      assert.equal(d.barText, v.headline);
      assert.equal(d.status!.text, v.docStatus);
      assert.ok(d.topTitle && d.mark && d.terms.length > 0, `${d.number} has its form wording`);
      assert.equal(d.ref1, v.contractNo);
      assert.equal(d.tracking, v.tracking);
    }
  });
});

describe("voucher document: the voucher's own fields win, and odd rows never break it", () => {
  it("a voucher's own details replace the reference text", () => {
    const d = buildVoucherDocument({
      ...row(11574),
      vendorAccount: "My Vendor\n1 Main St",
      operatedBy: "My Depot\n2 Side St\n(555) 000-1111",
      deliverPhone: "(111) 111-1111",
      deliverPhone2: "222-222-2222",
      terms: "Pay on delivery.\n\nThanks.",
      manifestLines: "I/T-001 | Wipes | Fragrance Free | 7/13/2026 | 123\nI/T-002 | Bottles | 4 oz | 7/14/2026 | 456",
      packLines: "I/T-001 | 80/bag | 1 Pallet | 24 | 1440",
    } as RecordRow);
    assert.deepEqual(d.leftLines, ["My Vendor", "1 Main St"]);
    assert.deepEqual(d.rightLines, ["My Depot", "2 Side St", "(555) 000-1111"]);
    assert.deepEqual(d.via.map((l) => l.text), ["SAIA LTL Freight", "(111) 111-1111", "222-222-2222"]);
    assert.deepEqual(d.terms, ["Pay on delivery.", "", "Thanks."]);
    assert.deepEqual(d.manifest, [["I/T-001", "Wipes", "Fragrance Free", "7/13/2026", "123"], ["I/T-002", "Bottles", "4 oz", "7/14/2026", "456"]]);
    assert.deepEqual(d.pack, [["I/T-001", "80/bag", "1 Pallet", "24", "1440"]]);
  });

  it("consignee and ship to fill the parties of a Bill of Lading", () => {
    const d = buildVoucherDocument({ ...row(11578), consignee: "Receiver Inc\n9 Dock Rd", shipTo: "Shipper LLC\n7 Yard Ln" } as RecordRow);
    assert.deepEqual(d.leftLines, ["Receiver Inc", "9 Dock Rd"]);
    assert.deepEqual(d.rightLines, ["Shipper LLC", "7 Yard Ln"]);
  });

  it("an unknown code prints only the code; an unknown carrier prints its code", () => {
    const d = buildVoucherDocument({ ...row(11574), vendorCode: "ACME", operatorCode: "DC-FTW", deliverVia: "XPO" } as RecordRow);
    assert.deepEqual([d.issuedCode, d.performCode], ["ACME", "DC-FTW"]);
    assert.deepEqual([d.leftLines, d.rightLines], [[], []]);
    assert.deepEqual(d.via, [{ text: "XPO", bold: true }]);
  });

  it("a Form added later has no invented wording; its labels are the column names", () => {
    const d = buildVoucherDocument({ id: "x", i: 11700, docType: "ZZ", headline: "SOMETHING NEW", docStatus: "Weird" } as RecordRow);
    assert.equal(d.number, "LLG-ZZ-15700");
    assert.equal(d.topTitle, "");
    assert.deepEqual([d.leftLabel, d.rightLabel], ["ISSUED", "PERFORM"]);
    assert.deepEqual(d.mark, { letter: "L", code: "ZZ" });
    assert.deepEqual(d.terms, []);
    assert.deepEqual(d.status, { text: "Weird", fill: "#616670", color: "#ffffff" }, "unknown statuses get the neutral pill");
  });

  it("a voucher that is not saved yet (no ID, no Form) still builds an empty document", () => {
    const d = buildVoucherDocument({ id: "new" } as RecordRow);
    assert.equal(d.number, "");
    assert.equal(d.accrual, "");
    assert.equal(d.mark, null);
    assert.equal(d.status, null);
    assert.deepEqual(d.manifest, []);
  });

  it("note lines: a label before a colon is bold, any other line is bold", () => {
    const d = buildVoucherDocument({ ...row(11578), voucherNote: "SAIA LTL Freight\nPhone Number: (609) 807-9228\nPick-up date: 08/06/26\nDrop off time: Before 2:30 PM" } as RecordRow);
    assert.deepEqual(d.note, [
      { text: "SAIA LTL Freight", bold: true },
      { label: "Phone Number:", text: "(609) 807-9228" },
      { label: "Pick-up date:", text: "08/06/26" },
      { label: "Drop off time:", text: "Before 2:30 PM" },
    ]);
  });
});
