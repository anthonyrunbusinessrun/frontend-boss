import type { RecordSet, VoucherRow } from "@/types";

// Transcribed from Screens/08-boss-vouchers.png.
// NEEDS CLARIFICATION: Cover images are clipped at the frame edge; only slivers exist as assets.
export const vouchers: RecordSet<VoucherRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "active",
      label: "ACTIVE VOUCHERS",
      count: 2,
      rows: [
        { id: "v1", voucherId: "R-IN-1033", sp: 45, svc: "SVC-9", debit: 1250, credit: 0, balance: 1250, scans: 12, prefix: "R-IN", label: "RETAIL_PROMO", ref: "#033", sum: 1250, cover: "/assets/vouchers/cover-1.png" },
        { id: "v2", voucherId: "R-IN-1034", sp: 20, svc: "SVC-2", debit: 450, credit: 450, balance: 0, scans: 3, prefix: "R-IN", label: "CASHBACK", ref: "#034", sum: 450, cover: "/assets/vouchers/cover-2.png" },
      ],
    },
  ],
};

export const voucherLegend = {
  title: "VOUCHERS LEGEND & SYSTEM NOTES",
  entries: [
    { term: "Debit / Credit Rules:", text: "Amounts auto-calculate the final current Balance value depending on prefix classification schemas (e.g. Cashback vs Promo credits)." },
    { term: "Scan Tracker:", text: "Track total API validations and physical QR code scanning events mapped through systemic client profiles." },
  ],
};
