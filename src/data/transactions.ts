import type { RecordSet, TransactionRow } from "@/types";

// Transcribed from Screens/09-boss-transactions.png.
// NEEDS CLARIFICATION: badge says "Total: 10 Items Listed" but four rows / "2 records" are drawn.
export const transactions: RecordSet<TransactionRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "r1033",
      label: "VOUCHER: R-IN-1033",
      count: 2,
      sums: { drQty: 330, crQty: 660 },
      rows: [
        { id: "t1", trans: "04101", voucher: "R-IN-1033", custRef: "FEMA-994", accrue: "2026-02-14", acct: "COGS", item: "SVC-FEMA-DISP", memo: "FEMA Dispatch Cost", drQty: 330, crQty: 0, qty: 330, direct: "Yes", detail: "Standard dispatch cost line" },
        { id: "t2", trans: "04102", voucher: "R-IN-1033", custRef: "FEMA-994", accrue: "2026-02-14", acct: "SALES", item: "SVC-FEMA-DISP", memo: "Credit memo", drQty: 0, crQty: 660, qty: -660, direct: "Yes", detail: "Credit line item" },
      ],
    },
    {
      id: "r1034",
      label: "VOUCHER: R-IN-1034",
      count: 2,
      sums: { drQty: 450, crQty: 900 },
      rows: [
        { id: "t3", trans: "04103", voucher: "R-IN-1034", custRef: "FEMA-995", accrue: "2026-02-15", acct: "COGS", item: "SVC-FEMA-TRK", memo: "FEMA Transit Cost", drQty: 450, crQty: 0, qty: 450, direct: "No", detail: "Transit log item" },
        { id: "t4", trans: "04104", voucher: "R-IN-1034", custRef: "FEMA-995", accrue: "2026-02-15", acct: "SALES", item: "SVC-FEMA-TRK", memo: "Transit sales", drQty: 0, crQty: 900, qty: -900, direct: "No", detail: "Transit sales offset" },
      ],
    },
  ],
};
