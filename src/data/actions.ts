import type { ActionRow, RecordSet } from "@/types";

type A = [string, string, string, ActionRow["type"], ActionRow["status"], string, string, boolean, boolean];

// Transcribed from Screens/06-actions-section.png (rows 1–16 visible).
// NEEDS CLARIFICATION: toolbar says "Grouped by 1 field" but no group headers are drawn.
const raw: A[] = [
  ["A-4642", "2026-07-06", "Review S14 Telemetry Reports", "Tasking", "Ongoing", "FL-1002", "26.28", true, true],
  ["A-4643", "2026-07-06", "Update Onboarding Guidelines", "Training", "Queue", "FL-1004", "26.28", false, false],
  ["A-4645", "2026-07-07", "Draft QA Deployment Notice", "Notice", "Scheduled", "FL-1005", "26.29", true, false],
  ["A-4650", "2026-07-07", "API Compliance Test Run", "Tasking", "Ongoing", "FL-1012", "26.29", true, true],
  ["A-4652", "2026-07-08", "Database Indexing Protocols", "Tasking", "Queue", "FL-1001", "26.30", false, false],
  ["A-4658", "2026-07-09", "Deploy Security Patch v2.1", "Notice", "Ongoing", "FL-1002", "26.30", true, true],
  ["A-4663", "2026-07-10", "Prepare Sprint Review Deck", "Training", "Scheduled", "FL-1004", "26.31", true, false],
  ["A-4665", "2026-07-10", "Validate Sourcing Schema", "Tasking", "Queue", "FL-1008", "26.31", false, false],
  ["A-4672", "2026-07-11", "Sync with Vendor Core API", "Tasking", "Ongoing", "FL-1020", "26.32", true, true],
  ["A-4675", "2026-07-12", "Internal Training: Rust Core", "Training", "Scheduled", "FL-1011", "26.32", false, false],
  ["A-4681", "2026-07-13", "Refactor Legacy Auth Modules", "Tasking", "Queue", "FL-1005", "26.33", false, false],
  ["A-4688", "2026-07-14", "Audit Log Processing Flow", "Notice", "Ongoing", "FL-1001", "26.33", true, true],
  ["A-4690", "2026-07-15", "Optimize Image Generation Assets", "Tasking", "Scheduled", "FL-1014", "26.34", true, false],
  ["A-4693", "2026-07-16", "Deploy Hotfix - User Sessions", "Notice", "Ongoing", "FL-1002", "26.34", true, true],
  ["A-4698", "2026-07-17", "Review SML Custom Templates", "Training", "Queue", "FL-1004", "26.35", false, false],
  ["A-4701", "2026-07-18", "Setup Telemetry Edge Cache", "Tasking", "Scheduled", "FL-1012", "26.35", true, false],
];

export const actions: RecordSet<ActionRow> = {
  groups: [
    {
      id: "all",
      rows: raw.map(([code, accrue, title, type, status, folio, wk, act, qa]) => ({
        id: code,
        code,
        accrue,
        title,
        type,
        status,
        folio,
        wk,
        act,
        qa,
      })),
    },
  ],
};
