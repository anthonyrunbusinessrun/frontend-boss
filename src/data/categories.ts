import type { CategoryRow, RecordSet } from "@/types";

// Transcribed from Screens/04-boss-categories.png (the design scrolls past the visible rows).
// NEEDS CLARIFICATION: group 2.0 says "5 items" but four rows are drawn.
export const categories: RecordSet<CategoryRow> = {
  groups: [
    {
      id: "g1",
      label: "GROUP 1.0 INBOX",
      count: 1,
      rows: [{ id: "c1", code: "1.0 INBOX", group: "1.0 INBOX", levelTwo: null, folios: ["Receipts In Basket"] }],
    },
    {
      id: "g2",
      label: "GROUP 2.0 INTERNAL",
      count: 5,
      rows: [
        { id: "c2", code: "2.0 INTERNAL", group: "2.0 INTERNAL", levelTwo: null, folios: [] },
        { id: "c3", code: "2.1 Reference", group: "2.0 INTERNAL", levelTwo: null, folios: ["360° Organization System", "Reference | Web(U)", "Reference | Library(R)"] },
        { id: "c4", code: "2.2 Standing", group: "2.0 INTERNAL", levelTwo: null, folios: ["RayLand.com Website", "Next Generation Proposals", "Artwork, Branding & Stationery", "LandBrokerageRealtor.com"] },
        { id: "c5", code: "2.3 Capabilities", group: "2.0 INTERNAL", levelTwo: null, folios: ["Planning"] },
      ],
    },
    {
      id: "g3",
      label: "GROUP 3.0 PROJECTS",
      count: 10,
      rows: [
        { id: "c6", code: "3.0 PROJECTS", group: "3.0 PROJECTS", levelTwo: null, folios: [] },
        { id: "c7", code: "3.1 Opportunities", group: "3.0 PROJECTS", levelTwo: null, folios: ["Freshbright.com", "BOSS System", "Ideas & Opportunities", "kSunshine Radio", "Fleuridien Mélodique", "GSA Schedule Contracts"] },
        { id: "c8", code: "3.2 Solicited", group: "3.0 PROJECTS", levelTwo: null, folios: ["FEMA Water Filters Region 9", "DLA Coco Fuel Storage Service"] },
      ],
    },
  ],
};
