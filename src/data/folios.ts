import type { FolioRow, RecordSet } from "@/types";

// Transcribed from Screens/05-boss-folios.png (visible groups only).
export const folios: RecordSet<FolioRow> = {
  groups: [
    {
      id: "g-empty",
      label: "CATEGORY (Empty)",
      count: 2,
      sums: { asfs: 0, actions: 0 },
      rows: [
        { id: "f1", folio: "Scrapped", cord: null, inactive: null, group: null, category: null, active: null, asfs: null, actions: null },
        { id: "f2", folio: "fina", cord: null, inactive: null, group: null, category: null, active: null, asfs: null, actions: null },
      ],
    },
    {
      id: "g-inbox",
      label: "CATEGORY 1.0 INBOX",
      count: 1,
      sums: { asfs: 3, actions: 3 },
      rows: [{ id: "f3", folio: "Receipts In Basket", cord: "EJE", inactive: null, group: "1.0 INBOX", category: "1.0 INBOX", active: 0, asfs: 3, actions: "A-3125, A-3227, A-38" }],
    },
    {
      id: "g-ref",
      label: "CATEGORY 2.1 Reference",
      count: 3,
      sums: { asfs: 25, actions: 3 },
      rows: [
        { id: "f4", folio: "360° Organization System", cord: "AES", inactive: null, group: "2.0 INTERNAL", category: "2.1 Reference", active: 0, asfs: 25, actions: "A-1337, A-1271, A-131" },
        { id: "f5", folio: "Reference | Library(R)", cord: "RL3", inactive: null, group: "2.0 INTERNAL", category: "2.1 Reference", active: 0, asfs: 0, actions: null },
        { id: "f6", folio: "Reference | Web(U)", cord: "JAD", inactive: null, group: "2.0 INTERNAL", category: "2.1 Reference", active: 0, asfs: 0, actions: null },
      ],
    },
    {
      id: "g-standing",
      label: "CATEGORY 2.2 Standing",
      count: 9,
      rows: [{ id: "f7", folio: "Communications", cord: "AES", inactive: null, group: "2.0 INTERNAL", category: "2.2 Standing", active: 5, asfs: 19, actions: "A-2074, A-2143, A-21" }],
    },
  ],
};
