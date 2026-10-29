import type { RecordSet, VoucherRow } from "@/types";
import { FEMA_VOUCHERS } from "./femaVouchers";

/** FEMA vouchers from FEMA_Vouchers.xlsx (16 rows). */
export const vouchers: RecordSet<VoucherRow> = {
  range: { from: 1, to: FEMA_VOUCHERS.length, total: FEMA_VOUCHERS.length },
  groups: [
    {
      id: "active",
      label: "ACTIVE VOUCHERS",
      count: FEMA_VOUCHERS.length,
      rows: FEMA_VOUCHERS.map((row) => ({
        id: row.id,
        i: row.i,
        accrualDate: row.accrualDate,
        docType: row.docType,
        headline: row.headline,
        docStatus: row.docStatus,
        by: row.by,
        vendorCode: row.vendorCode,
        contractNo: row.contractNo,
        operatorCode: row.operatorCode,
        reference2: row.reference2,
        deliverVia: row.deliverVia,
        resource: row.resource,
        tracking: row.tracking,
        vsf: row.vsf,
        manifest: row.manifest,
        voucherNote: row.voucherNote,
        // Legacy ledger placeholders (hidden in the FEMA grid). Scans left empty to match the sheet.
        voucherId: `LLG-${row.docType}-${row.i + 4000}`,
        sp: 0,
        svc: "",
        debit: 0,
        credit: 0,
        balance: 0,
        prefix: `LLG-${row.docType}`,
        label: row.headline,
        ref: `#${String(row.i).slice(-3)}`,
        sum: 0,
        cover: "",
      })),
    },
  ],
};

export const voucherLegend = {
  title: "VOUCHERS LEGEND & SYSTEM NOTES",
  entries: [
    { term: "Form:", text: "FD = Freight Delivery Confirmation, FT = In Transit ASN, BL = Bill of Lading, FQ = Freight RFQ, IN = Invoice." },
    { term: "Voucher number:", text: "LLG- + Form + (ID + 4000). Example: ID 11574 with Form FD is LLG-FD-15574." },
    { term: "Scan Tracker:", text: "Track total API validations and physical QR code scanning events mapped through systemic client profiles." },
  ],
};
