import type { CapabilityRow, RecordSet } from "@/types";

type K = [string, string, string, string, string[], string];

// Transcribed from Screens/14-boss-capabilities.png.
// NEEDS CLARIFICATION: Brief overview / Notes / Tagline are truncated in the design; full text is inferred.
const raw: K[] = [
  ["Catering Services", "Emergency mobile kitchen operations for displaced populations", "SOP tested, ready for rapid deployment", "SOP-Meals-V4.pdf", "Mobile|Dietary Compliant|High Vol".split("|"), "\"Sustaining first responders and survivors."],
  ["Cleaning Supply Kits", "Rapid packaging of personal/family sanitation supplies", "Stock reserves maintained at regional depots", "HygieneKit-Inv.xlsx", "Bulk Stocked|Packaged|Hygiene".split("|"), "\"Restoring basic health and dignity."],
  ["Debris Management", "Heavy operations clearing paths for emergency access", "Partnership with logistics contractors", "Contract-Ops-D.pdf", "Heavy Duty|Route Clearing|R4 Only".split("|"), "\"Clearing the path to recovery."],
  ["Delivery Support Ops", "Medium lift airlift Coordination and staging", "Authorized for FEMA joint operations", "Airlift-Coord-R9.pdf", "Airlift|Strategic Staging|Fast".split("|"), "\"Rapid response campaigns."],
  ["Door-to-Door Delivery", "Direct localized distribution of basic needs", "Coordinated with local volunteer groups", "LastMile-Guide.docx", "Volunteer Grid|Direct Tracking".split("|"), "\"Help straight to the door."],
  ["Disaster Survivor Kits", "72-hour family food, shelter sheeting and tools", "Pre-positioned inventory in three regions", "SurvivorKit-SOP-V3.pdf", "Immediate Survival|Water Filtration".split("|"), "\"Your immediate shelter and supplies."],
  ["Action Assistance Sys", "Integrated GIS and call hotline workflow", "24/7 technical operations desk", "SysOps-Manual.pdf", "GIS Tracked|Call Intake|Dispatch".split("|"), "\"Data coordination in real time."],
];

export const capabilities: RecordSet<CapabilityRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "logistics",
      label: "LOGISTICS & DEPLOYMENT SERVICES",
      count: 7,
      rows: raw.map(([title, overview, notes, attachment, features, tagline], i) => ({
        id: `cp${i + 1}`,
        code: `CAP-${101 + i}`,
        title,
        overview,
        gallery: `/assets/capabilities/cap-${101 + i}.png`,
        notes,
        attachment,
        features,
        tagline,
      })),
    },
  ],
};
