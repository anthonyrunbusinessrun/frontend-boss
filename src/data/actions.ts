import type { ActionRow, RecordSet } from "@/types";
import { ACTION_EXPORT } from "./actionsExport";
import { profiles } from "./profiles";

/** The Actions table (158 actions from the Airtable export, in its order). See actionsExport.ts. */

const profileRows = profiles.groups.flatMap((g) => g.rows) as Array<{ id: string; contact: string }>;
const profileId = (contact: string) => profileRows.find((p) => p.contact.trim().toLowerCase() === contact.trim().toLowerCase())?.id;

/**
 * Asn: the team members the action is assigned to, linked by their Contact code. A code that is not a profile (the
 * export has LMF) is kept as text in `asnCode`, so no assignment is lost.
 */
export function assignees(codes: string[], lookup: (contact: string) => string | undefined = profileId): { asn: string[]; asnCode?: string } {
  const asn: string[] = [];
  const unmatched: string[] = [];
  for (const c of codes) {
    const id = lookup(c);
    if (id) asn.push(id);
    else unmatched.push(c);
  }
  return unmatched.length ? { asn, asnCode: unmatched.join(", ") } : { asn };
}

export const actions: RecordSet<ActionRow> = {
  groups: [
    {
      id: "all",
      rows: ACTION_EXPORT.map((a) => ({
        id: a.id,
        code: a.code,
        wk: a.wk,
        accrue: a.accrue || null,
        status: a.status || null,
        title: a.title,
        type: a.type || null,
        folio: a.folio,
        ...assignees(a.asn),
        qa: false,
        sort: a.sort,
      })),
    },
  ],
};
