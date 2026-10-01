import type { AccountRow, RecordSet } from "@/types";

// Transcribed from Screens/11-boss-accounts.png.
export const accounts: RecordSet<AccountRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "revenue",
      label: "REVENUE ACCOUNTS",
      count: 1,
      rows: [{ id: "a1", code: "4000", title: "Sales Revenue", type: "Revenue", def: "Credit", stmt: "Income Statement", debits: 0, credits: 152430, balance: 152430, transactions: 45, frequent: "Yes" }],
    },
    {
      id: "expense",
      label: "EXPENSE ACCOUNTS",
      count: 1,
      rows: [{ id: "a2", code: "5000", title: "Cost of Goods Sold", type: "Expense", def: "Debit", stmt: "Income Statement", debits: 84210, credits: 0, balance: 84210, transactions: 32, frequent: "Yes" }],
    },
  ],
};
