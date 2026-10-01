import type { ConceptRow, RecordSet } from "@/types";

type C = [string, string | null, string | null, string | null, string[]];

// Transcribed from Screens/13-boss-concepts.png.
// NEEDS CLARIFICATION: footer says "Showing 1-2 of 2 records" while nine rows are drawn.
const raw: C[] = [
  ["Web(u) Course Overview", "2022", "Web(u)", null, []],
  ["Introduction & Overview", "2022 r1", "INTRO", "Designed for Specialists, AA's, PC's and new hires", ["AN-1494", "AN-1496"]],
  ["Orientation Project Coordination", "2022 r1", "PC101", "Designed for AA's & PC's / Young professionals", ["AN-1494", "AN-1496"]],
  ["Orientation Action Assistance", "2022 r1", "AA101", "Designed for AA's Only / Action Assistance", []],
  ["Federal Proposal Basics", "2022 r1", "FPB000", null, []],
  ["----", null, null, null, []],
  ["Action Beyond the Basics", "2021 r1", "AA102", null, []],
  ["Precision Coordination", "2021 r1", "PC102", null, []],
  ["Interpersonal Relations", null, null, null, []],
];

export const concepts: RecordSet<ConceptRow> = {
  range: { from: 1, to: 2, total: 2 },
  groups: [
    {
      id: "course",
      label: "TYPE > Course",
      count: 9,
      rows: raw.map(([title, release, acronym, definition, work], i) => ({
        id: `cn${i + 1}`,
        title,
        release,
        acronym,
        type: "Course",
        definition,
        related: null,
        link: "XMIND?",
        work,
      })),
    },
  ],
};
