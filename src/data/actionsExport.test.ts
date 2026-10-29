import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACTION_STATUSES, ACTION_TYPES } from "@/lib/base/definitions";
import { assignees, actions } from "./actions";
import { ACTION_EXPORT } from "./actionsExport";

const byCode = (code: string) => ACTION_EXPORT.find((a) => a.code === code)!;

/** Expectations are read from the Airtable export "Actions-OPEN ACTIONS - HOT QA NEXT.csv". */
describe("actions seed data (Airtable export)", () => {
  it("has the export's 158 actions with unique codes, in the export's order", () => {
    assert.equal(ACTION_EXPORT.length, 158);
    assert.equal(new Set(ACTION_EXPORT.map((a) => a.code)).size, 158);
    assert.deepEqual(ACTION_EXPORT.slice(0, 5).map((a) => a.code), ["A-4695", "A-4744", "A-4768", "A-4769", "A-4770"]);
    assert.equal(ACTION_EXPORT.at(-1)!.code, "A-4763");
    assert.ok(ACTION_EXPORT.every((a) => a.id === a.code), "the code is the record id");
    assert.equal(Math.max(...ACTION_EXPORT.map((a) => Number(a.code.slice(2)))), 4770);
  });

  it("every Status and Type in the export is a choice of the table", () => {
    for (const a of ACTION_EXPORT) {
      if (a.status) assert.ok(ACTION_STATUSES.includes(a.status), `status ${a.status}`);
      if (a.type) assert.ok(ACTION_TYPES.includes(a.type), `type ${a.type}`);
    }
    assert.equal(new Set(ACTION_EXPORT.map((a) => a.status).filter(Boolean)).size, 10);
    assert.equal(new Set(ACTION_EXPORT.map((a) => a.type).filter(Boolean)).size, 18);
  });

  it("dated actions have a week, undated ones are 'Action'", () => {
    assert.equal(ACTION_EXPORT.filter((a) => a.wk === "Action").length, 84);
    assert.ok(ACTION_EXPORT.filter((a) => a.wk === "Action").every((a) => a.accrue === ""));
    assert.ok(ACTION_EXPORT.filter((a) => a.wk !== "Action").every((a) => /^\d{4}-\d{2}-\d{2}$/.test(a.accrue) && /^26\.\d\d$/.test(a.wk)));
    assert.deepEqual([byCode("A-4542").wk, byCode("A-4542").accrue], ["26.28", "2026-07-06"]);
  });

  it("each column of known rows follows the export", () => {
    assert.deepEqual(byCode("A-4666"), { id: "A-4666", code: "A-4666", wk: "Action", accrue: "", status: "Priority", title: byCode("A-4666").title, type: "Tasking", folio: "FEMA Infant & Toddler Kits", asn: ["AES"], sort: null });
    assert.ok(byCode("A-4666").title.startsWith("⛔ Rebook Baby Bottles as Suppl"));
    assert.deepEqual(byCode("A-4672").asn, ["JAD", "AES"], "two assignees");
    assert.deepEqual(byCode("A-4670").asn, ["AES", "SML"], "whitespace trimmed");
    assert.equal(byCode("A-4768").title, "NEw NEw");
    assert.equal(byCode("A-4768").sort, 1);
    assert.equal(byCode("A-4770").status, "");
    assert.equal(byCode("A-4319").folio, "/// Ray Land, Inc.", "the export quotes a folio that contains a comma");
    assert.equal(byCode("A-4542").title, "Monday Management Meeting", "trailing space trimmed");
    assert.equal(byCode("A-4583").status, "Archive");
    assert.equal(byCode("A-4661").status, "Waiting For");
    assert.equal(byCode("A-4314").asn[0], "LMF");
    assert.deepEqual([byCode("A-4646").type, byCode("A-4646").sort, byCode("A-4646").accrue], ["Meeting", 9, "2026-07-31"]);
    assert.equal(ACTION_EXPORT.filter((a) => a.sort !== null).length, 46);
  });

  it("every row of the export is present as a seed record, with Asn linked to the profile of that Contact code", () => {
    const rows = actions.groups[0].rows;
    assert.equal(rows.length, 158);
    const r = (code: string) => rows.find((x) => x.code === code)!;
    assert.deepEqual(r("A-4666").asn, ["p9"], "AES");
    assert.deepEqual(r("A-4672").asn, ["p8", "p9"], "JAD, AES");
    assert.equal(r("A-4666").accrue, null);
    assert.equal(r("A-4770").status, null);
    assert.deepEqual([r("A-4314").asn, r("A-4314").asnCode], [[], "LMF"], "LMF is not a profile: kept as text");
    assert.equal(r("A-4666").qa, false);
  });

  it("assignees() matches Contact codes without regard to case or spaces and keeps what it cannot match", () => {
    const lookup = (c: string) => ({ aes: "p9", jad: "p8" })[c.trim().toLowerCase() as "aes"];
    assert.deepEqual(assignees(["AES", " jad "], lookup), { asn: ["p9", "p8"] });
    assert.deepEqual(assignees(["AES", "XYZ", "QQ"], lookup), { asn: ["p9"], asnCode: "XYZ, QQ" });
    assert.deepEqual(assignees([], lookup), { asn: [] });
  });
});
