import type { LeadRow, RecordSet } from "@/types";

type L = [string, string, string, LeadRow["type"], string, boolean, string];

// Transcribed from Screens/15-boss-leads.png.
// NEEDS CLARIFICATION: group says "CLIENT : FEMA" / "5 items" but six rows from several clients are drawn.
const raw: L[] = [
  ["L-4091", "FEMA", "FEMA Water Filters Region 9", "Solicitation", "07/28/2026", true, "lscms.fema.gov/opportunities"],
  ["L-4092", "DLA", "Bill of Materials Cocoa Fuel Storage", "Sources Sought", "07/30/2026", false, "dla.mil/procurement/cocoa"],
  ["L-4093", "FEMA", "Responder Lodging Atlanta", "Combined Syn/Solicitation", "08/05/2026", true, "fema.gov/lodging-atlanta"],
  ["L-4094", "GSA", "Regional Office Relocation Services", "Request for Information", "08/12/2026", false, "gsa.gov/services/relocation"],
  ["L-4095", "US Army", "Tactical Communications Rugged Kits", "Sources Sought", "08/20/2026", true, "sam.gov/opp/rugged-comms"],
  ["L-4096", "FEMA", "Disaster Recovery Consumables Supply", "Solicitation", "08/29/2026", true, "fema.gov/disaster-supplies"],
];

export const leads: RecordSet<LeadRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "fema",
      label: "CLIENT : FEMA",
      count: 5,
      rows: raw.map(([leadId, client, title, type, due, hasFiles, url]) => ({
        id: leadId,
        leadId,
        client,
        title,
        type,
        due,
        hasFiles,
        url,
      })),
    },
  ],
};
