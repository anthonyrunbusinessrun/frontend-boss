import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEMA_VOUCHERS } from "./femaVouchers";

const byI = (i: number) => FEMA_VOUCHERS.find((v) => v.i === i)!;

/** Expectations are read from the Airtable export "Vouchers-VOUCHERS - Simplified.csv". */
describe("voucher seed data (Airtable export)", () => {
  it("has the export's 16 vouchers, in order, with ids v1 … v16", () => {
    assert.equal(FEMA_VOUCHERS.length, 16);
    assert.deepEqual(FEMA_VOUCHERS.map((v) => v.i), [11574, 11575, 11576, 11577, 11578, 11579, 11580, 11581, 11588, 11589, 11590, 11591, 11592, 11594, 11595, 11596]);
    assert.deepEqual(FEMA_VOUCHERS.map((v) => v.id), Array.from({ length: 16 }, (_, n) => `v${n + 1}`));
  });

  it("every voucher links to its record (VSF) and the links are all different", () => {
    for (const v of FEMA_VOUCHERS) assert.match(v.vsf, /^https:\/\/airtable\.com\/tblK7rY6QSShUYfF7\/rec[A-Za-z0-9]{14}\?blocks=/, v.id);
    assert.equal(new Set(FEMA_VOUCHERS.map((v) => v.vsf)).size, 16);
    assert.equal(byI(11574).vsf, "https://airtable.com/tblK7rY6QSShUYfF7/recnXQccF9jWDFyNX?blocks=bliWJCFmNjlbeUs8q");
  });

  it("Notes have their full multi-line text", () => {
    assert.equal(byI(11574).voucherNote, "");
    assert.equal(byI(11578).voucherNote, "Total Quality Logistics (TQL)\nPhone Number: (513) 831-2600\nEst. Price of Delivery: $3,750.00\nPick-up time: 7:00 AM to 4:30 PM\nPick-up date: 07/28/26");
    assert.equal(byI(11579).voucherNote, "Company: ABC Company\nSales Person: XYZ\nContact Number: + 1 000 000\nDate Issued: 00/00/00", "trailing spaces and blank lines are dropped");
    assert.equal(byI(11589).voucherNote, "SAIA LTL Freight\nPhone Number: (609) 807-9228\nPick-up date: 08/06/26\nDrop off time: Before 2:30 PM\nSpecial Instruction: Do not double stack the pallets.");
    assert.equal(byI(11596).voucherNote.split("\n").length, 5);
  });

  it("Manifest is one line per shipment line; commas inside a line survive; the export's wording is kept", () => {
    assert.deepEqual(byI(11578).manifest.split("\n"), ["P/U - EMERALD PRODUCTS", "Pallet of Baby Bottles, Nipples, and Wipes", "D/O - LAND BRANFORD HQ"]);
    assert.deepEqual(byI(11579).manifest.split("\n"), ["QUOTE REQUESTED:", "Unnamed record", "Unnamed record", "Unnamed record", "Unnamed record"]);
    assert.deepEqual(byI(11589).manifest.split("\n"), ["P/U - LAND BRANFORD HQ", "Pallet of Feeding Bottles", "Pallet of Diaper Ointment — Preventative", "Pallet of Diaper Ointment — Zinc Oxide", "Pallet of Bottle Nipples", "D/O - ATLANTA, GA"]);
    assert.equal(byI(11590).manifest.split("\n")[2], "D/O - GREENCASTLE, PA");
    assert.equal(byI(11594).manifest.split("\n")[0], "D/O - CAGUAS, PR");
    assert.equal(byI(11574).manifest, "I/T-015 · GREENCASTLE · Wipes");
  });

  it("references are trimmed and the other columns follow the export", () => {
    assert.equal(byI(11578).reference2, "37702097", "the export has a trailing space");
    assert.deepEqual([byI(11576).operatorCode, byI(11576).by, byI(11576).docType, byI(11576).headline], ["DC-FTW", "EJE", "FT", "ASN - IN TRANSIT"]);
    assert.deepEqual([byI(11579).vendorCode, byI(11579).operatorCode, byI(11579).deliverVia, byI(11579).docStatus], ["QUOTE", "", "", "Planned"]);
    assert.deepEqual([byI(11595).docType, byI(11595).by, byI(11595).reference2, byI(11595).accrualDate], ["IN", "EJE", "L 705200152", "2026-08-10"]);
    assert.deepEqual([byI(11596).tracking, byI(11596).reference2, byI(11596).accrualDate], ["6402156", "6402156", "2026-09-03"]);
  });
});
