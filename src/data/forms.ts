import type { FormRow, RecordSet } from "@/types";

type F = [string, string, string, string, string, FormRow["group"], string];

// Transcribed from Screens/12-boss-forms.png.
const raw: F[] = [
  ["JC", "Job", "job-card", "Job Card", "Standard Maintenance Job Card", "Buy", "Daily maintenance checklist"],
  ["WT", "Ticket", "work-ticket", "Work Ticket", "FEMA Logistics Work Ticket", "Blanket", "General routing task ticket"],
  ["TT", "Ticket", "task-ticket", "Task Ticket", "Sub-task Assignee Ticket", "Buy", "Granular action items"],
  ["AN", "Info", "announcement", "Announcement", "Agency Wide Broadcast Dispatch", "Blanket", "Official operational notice"],
  ["OP", "Lead", "opportunity", "Opportunity", "Procurement Vendor Opportunity", "Buy", "Vendor solicitation intake"],
  ["TO", "Order", "task-order", "Task Order", "FEMA Regional Task Order", "Blanket", "Authorized tasking order"],
  ["RQ", "Quote", "request-quote", "Request Quote", "Request for Proposal Quote", "Buy", "Vendor pricing acquisition"],
  ["AG", "Contract", "agreement", "Agreement", "Inter-agency Support Agreement", "Blanket", "Binding service level terms"],
  ["AD", "Event", "agenda", "Agenda", "Operations Briefing Agenda", "Buy", "Scheduled timeline items"],
  ["MT", "Event", "meeting", "Meeting", "FEMA Coordination Meeting", "Blanket", "Standard meeting record"],
  ["TC", "Event", "teleconference", "Teleconference", "Emergency Teleconference Bridge", "Buy", "Crisis line sync and notes"],
  ["MS", "Goal", "milestone", "Milestone", "Operational Phase Milestone", "Blanket", "Key project phase marker"],
  ["DL", "Goal", "deliverable", "Deliverable", "Required Operational Deliverable", "Buy", "Formal deliverable record"],
];

// NEEDS CLARIFICATION: long titles / descriptions are truncated with an ellipsis in the design; full text is inferred.
export const forms: RecordSet<FormRow> = {
  groups: [
    {
      id: "work",
      label: "STYLE: Work",
      count: 13,
      rows: raw.map(([code, type, slug, title, longTitle, group, description], i) => ({
        id: `fm${i + 1}`,
        code,
        type,
        slug,
        style: "Work",
        title,
        longTitle,
        group,
        description,
      })),
    },
  ],
};
