import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayText, fieldValue, stockStatus } from "./compute";
import { choicesFromNames } from "./fields";
import { applyFilters, applyGroups, applySort, defaultRule, matchesSearch, queryRecords, visibleFields } from "./query";
import { applyNodes, buildTree, moveNode, treeToNodes, uniqueName } from "./layout";
import type { FieldDef, RecordRow, SectionDef, ViewDef } from "./types";
import { emptyViewConfig } from "./types";
import { validateRecordInput } from "./validate";
import { defaultConfigFor, missingSetup, pruneConfig, syncFormConfig } from "./viewDefaults";

const f = (key: string, type: FieldDef["type"], extra: Partial<FieldDef> = {}): FieldDef => ({ key, name: key, type, options: {}, position: 0, required: false, primary: false, ...extra });

const fields: FieldDef[] = [
  f("title", "text", { primary: true, required: true, name: "Title" }),
  f("qty", "number", { options: { format: "integer", min: 0 }, name: "Qty" }),
  f("status", "singleSelect", { options: { choices: choicesFromNames(["Todo", "Doing", "Done"]) }, name: "Status" }),
  f("tags", "multiSelect", { options: { choices: choicesFromNames(["a", "b"]), allowOther: false } }),
  f("due", "date"),
  f("done", "checkbox"),
  f("owner", "link", { options: { linkTable: "profiles" } }),
  f("email", "email"),
];

const rows: RecordRow[] = [
  { id: "1", title: "Alpha", qty: 5, status: "Todo", tags: ["a"], due: "2026-10-03", done: false, owner: "p1" },
  { id: "2", title: "beta", qty: 0, status: "Done", tags: ["a", "b"], due: "2026-10-01", done: true, owner: "p2" },
  { id: "3", title: "Gamma", qty: 12, status: "Doing", tags: [], due: null, done: false, owner: null },
  { id: "4", title: "Delta", qty: null, status: null, tags: ["b"], due: "2026-10-02", done: true, owner: "p1" },
];

const linked = {
  profiles: { slug: "profiles", name: "Profiles", primaryKey: "name", records: [{ id: "p1", label: "Ann", filter: {} }, { id: "p2", label: "Bob", filter: {} }] },
};

describe("filters", () => {
  it("filters text, number, date, select, multi, checkbox and link fields", () => {
    const ids = (rules: Parameters<typeof applyFilters>[1]) => applyFilters(rows, rules, fields, linked).map((r) => r.id);
    const rule = (field: string, op: Parameters<typeof applyFilters>[1][number]["op"], value?: string | boolean) => ({ id: "x", join: "and" as const, field, op, value });
    assert.deepEqual(ids([rule("title", "contains", "ta")]), ["2", "4"]);
    assert.deepEqual(ids([rule("qty", "gt", "4")]), ["1", "3"]);
    assert.deepEqual(ids([rule("qty", "isEmpty")]), ["4"]);
    assert.deepEqual(ids([rule("due", "before", "2026-10-03")]), ["2", "4"]);
    assert.deepEqual(ids([rule("status", "is", "Done")]), ["2"]);
    assert.deepEqual(ids([rule("tags", "contains", "b")]), ["2", "4"]);
    assert.deepEqual(ids([rule("done", "is", true)]), ["2", "4"]);
    assert.deepEqual(ids([rule("owner", "is", "p1")]), ["1", "4"]);
    assert.deepEqual(ids([rule("owner", "isEmpty")]), ["3"]);
  });

  it("combines rules with and / or and ignores incomplete rules", () => {
    const base = { id: "x", field: "status", op: "is" as const };
    const either = applyFilters(rows, [{ ...base, join: "and", value: "Done" }, { ...base, join: "or", value: "Todo" }], fields, linked);
    assert.deepEqual(either.map((r) => r.id), ["1", "2"]);
    assert.equal(applyFilters(rows, [{ ...base, join: "and", value: "" }], fields, linked).length, 4, "empty value must not hide rows");
    assert.equal(applyFilters(rows, [{ id: "x", join: "and", field: "gone", op: "is", value: "x" }], fields).length, 4, "rule on a deleted field is ignored");
  });

  it("defaultRule picks a valid operator for the field type", () => {
    assert.equal(defaultRule("r", fields[1]).op, "eq");
    assert.equal(defaultRule("r", fields[5]).value, true);
  });
});

describe("sort and group", () => {
  it("sorts numbers numerically with blanks last in both directions", () => {
    assert.deepEqual(applySort(rows, [{ field: "qty", dir: "asc" }], fields).map((r) => r.id), ["2", "1", "3", "4"]);
    assert.deepEqual(applySort(rows, [{ field: "qty", dir: "desc" }], fields).map((r) => r.id), ["3", "1", "2", "4"]);
  });

  it("sorts single selects by option order, not alphabetically", () => {
    assert.deepEqual(applySort(rows, [{ field: "status", dir: "asc" }], fields).map((r) => r.id), ["1", "3", "2", "4"]);
  });

  it("sorts linked records by their label", () => {
    assert.deepEqual(applySort(rows, [{ field: "owner", dir: "asc" }], fields, linked).map((r) => r.id), ["1", "4", "2", "3"]);
  });

  it("groups by a select in option order with an Empty group last", () => {
    const groups = applyGroups(rows, [{ field: "status", dir: "asc" }], fields, linked);
    assert.deepEqual(groups.map((g) => g.label), ["Todo", "Doing", "Done", "Empty"]);
    assert.equal(groups[3].rows[0].id, "4");
  });

  it("supports a second grouping level", () => {
    const groups = applyGroups(rows, [{ field: "done", dir: "asc" }, { field: "owner", dir: "asc" }], fields, linked);
    assert.deepEqual(groups.map((g) => g.label), ["Unchecked", "Checked"]);
    assert.deepEqual(groups[1].children?.map((g) => g.label), ["Ann", "Bob"]);
  });
});

describe("search and queryRecords", () => {
  it("searches display text including linked labels", () => {
    assert.equal(matchesSearch(rows[0], "ann", fields, linked), true);
    assert.equal(matchesSearch(rows[0], "bob", fields, linked), false);
    assert.equal(matchesSearch(rows[0], "alpha todo", fields, linked), true);
  });

  it("combines search, filters and sort", () => {
    const cfg = { ...emptyViewConfig(), filters: [{ id: "a", join: "and" as const, field: "done", op: "is" as const, value: true }], sort: [{ field: "title", dir: "asc" as const }] };
    assert.deepEqual(queryRecords(rows, cfg, fields, "", linked).map((r) => r.id), ["2", "4"]);
    assert.deepEqual(queryRecords(rows, cfg, fields, "delta", linked).map((r) => r.id), ["4"]);
  });

  it("hides fields and applies a custom order", () => {
    const v = visibleFields(fields, { hidden: ["qty"], order: ["status", "title"] }).map((x) => x.key);
    assert.deepEqual(v.slice(0, 2), ["status", "title"]);
    assert.ok(!v.includes("qty"));
  });
});

describe("computed fields", () => {
  const no = f("no", "computed", { options: { computed: { fn: "offset", source: "i", add: 1000 } } });
  const status = f("st", "computed", { options: { computed: { fn: "stockStatus", qty: "qty", reorder: "min" } } });

  it("offsets a number and tolerates a missing source", () => {
    assert.equal(fieldValue(no, { id: "1", i: 11574 }), 12574);
    assert.equal(fieldValue(no, { id: "1" }), null);
  });

  it("derives stock status", () => {
    assert.equal(stockStatus(0, 5), "Out of stock");
    assert.equal(stockStatus(5, 5), "Low stock");
    assert.equal(stockStatus(6, 5), "In stock");
    assert.equal(stockStatus(3, null), "In stock");
    assert.equal(stockStatus(null, 5), null);
    assert.equal(fieldValue(status, { id: "1", qty: 2, min: 3 }), "Low stock");
  });

  it("falls back to the legacy text for an unlinked link field", () => {
    const owner = f("owner", "link", { options: { linkTable: "profiles", legacyKey: "cord" } });
    assert.equal(displayText(owner, { id: "1", owner: null, cord: "EJE" }, linked), "EJE");
    assert.equal(displayText(owner, { id: "1", owner: "p1", cord: "EJE" }, linked), "Ann");
  });
});

describe("validation", () => {
  it("requires required fields on create but not on update", () => {
    assert.equal(validateRecordInput(fields, {}, { mode: "create" }).errors.title, "Title is required.");
    assert.deepEqual(validateRecordInput(fields, { qty: 3 }, { mode: "update" }).errors, {});
  });

  it("rejects negative quantities, non-numbers and fractions in integer fields", () => {
    assert.equal(validateRecordInput(fields, { title: "x", qty: -1 }, { mode: "create" }).errors.qty, "Must be 0 or more.");
    assert.equal(validateRecordInput(fields, { title: "x", qty: "abc" }, { mode: "create" }).errors.qty, "Enter a number.");
    assert.equal(validateRecordInput(fields, { title: "x", qty: 1.5 }, { mode: "create" }).errors.qty, "Enter a whole number.");
  });

  it("validates select options, emails and dates", () => {
    const r = validateRecordInput(fields, { title: "x", status: "Nope", email: "bad", due: "2026-13-40" }, { mode: "create" });
    assert.equal(r.errors.status, "Choose one of the listed options.");
    assert.equal(r.errors.email, "Enter a valid email address.");
    assert.equal(r.errors.due, "Enter a valid date.");
  });

  it("drops unknown and read-only keys instead of storing them", () => {
    const r = validateRecordInput(fields, { title: "x", sneaky: 1, id: "hack" }, { mode: "create" });
    assert.deepEqual(r.ignored, ["sneaky"]);
    assert.equal("sneaky" in r.values, false);
    assert.equal("id" in r.values, false);
  });

  it("limits a form to its allowed fields and honours form-level required", () => {
    const r = validateRecordInput(fields, { title: "x", qty: 5 }, { mode: "create", allowedKeys: new Set(["title", "status"]), requiredKeys: new Set(["status"]) });
    assert.equal(r.errors.status, "Choose a value for Status.");
    assert.equal("qty" in r.values, false);
  });

  it("normalises multi values and links", () => {
    const r = validateRecordInput(fields, { title: "x", tags: ["a", "a", "b"], owner: "p9" }, { mode: "create" });
    assert.deepEqual(r.values.tags, ["a", "b"]);
    assert.equal(r.values.owner, "p9");
  });

  it("only accepts uploaded files as attachments", () => {
    const att = f("pic", "attachment");
    assert.ok(validateRecordInput([att], { pic: [{ id: "a", name: "x.png", url: "https://evil.test/x.png" }] }, { mode: "update" }).errors.pic);
    assert.deepEqual(validateRecordInput([att], { pic: [{ id: "a", name: "x.png", url: "/api/files/a", type: "image/png" }] }, { mode: "update" }).errors, {});
  });
});

describe("view defaults", () => {
  it("auto-selects date, select and cover fields", () => {
    assert.equal(defaultConfigFor("calendar", fields, "Things").dateField, "due");
    assert.equal(defaultConfigFor("kanban", fields, "Things").stackField, "status");
    assert.equal(defaultConfigFor("timeline", fields, "Things").startField, "due");
    assert.equal(defaultConfigFor("form", fields, "Things").form?.fields.length, fields.length);
  });

  it("reports what a view still needs", () => {
    const noDates = fields.filter((x) => x.type !== "date");
    assert.equal(missingSetup("calendar", defaultConfigFor("calendar", noDates, "T"), noDates)?.fix, "date");
    assert.equal(missingSetup("grid", emptyViewConfig(), fields), null);
    assert.equal(missingSetup("kanban", defaultConfigFor("kanban", fields, "T"), fields), null);
  });

  it("prunes references to deleted fields", () => {
    const cfg = { ...emptyViewConfig(), hidden: ["qty", "gone"], dateField: "gone", sort: [{ field: "gone", dir: "asc" as const }] };
    const pruned = pruneConfig(cfg, fields);
    assert.deepEqual(pruned.hidden, ["qty"]);
    assert.equal(pruned.dateField, undefined);
    assert.equal(pruned.sort.length, 0);
  });

  it("adds new fields to an existing form as not visible", () => {
    const form = defaultConfigFor("form", fields.slice(0, 2), "T").form!;
    const synced = syncFormConfig(form, fields);
    assert.equal(synced.fields.length, fields.length);
    assert.equal(synced.fields.at(-1)?.visible, false);
  });
});

describe("sidebar layout", () => {
  const view = (id: string, position: number, sectionId: string | null = null): ViewDef => ({ id, table: "t", name: id, type: "grid", config: emptyViewConfig(), access: "collaborative", ownerId: null, sectionId, position });
  const section = (id: string, position: number): SectionDef => ({ id, table: "t", name: id, position });
  const views = [view("v1", 0), view("v2", 1), view("v3", 0, "s1"), view("v4", 1, "s1"), view("v5", 3)];
  const sections = [section("s1", 2)];
  const names = (t: ReturnType<typeof buildTree>) => t.root.map((n) => (n.kind === "view" ? n.view.id : `${n.section.id}[${n.views.map((v) => v.id).join(",")}]`));

  it("builds root order with sections interleaved", () => {
    assert.deepEqual(names(buildTree(views, sections)), ["v1", "v2", "s1[v3,v4]", "v5"]);
  });

  it("moves a root view into a section, and out again", () => {
    const tree = buildTree(views, sections);
    const into = moveNode(tree, { kind: "view", id: "v1" }, { type: "into", sectionId: "s1" })!;
    assert.deepEqual(names(into), ["v2", "s1[v3,v4,v1]", "v5"]);
    const out = moveNode(into, { kind: "view", id: "v3" }, { type: "root-end" })!;
    assert.deepEqual(names(out), ["v2", "s1[v4,v1]", "v5", "v3"]);
  });

  it("reorders within a section and at root", () => {
    const tree = buildTree(views, sections);
    assert.deepEqual(names(moveNode(tree, { kind: "view", id: "v4" }, { type: "before", id: "v3", kind: "view" })!), ["v1", "v2", "s1[v4,v3]", "v5"]);
    assert.deepEqual(names(moveNode(tree, { kind: "view", id: "v5" }, { type: "before", id: "v1", kind: "view" })!), ["v5", "v1", "v2", "s1[v3,v4]"]);
    assert.deepEqual(names(moveNode(tree, { kind: "section", id: "s1" }, { type: "before", id: "v1", kind: "view" })!), ["s1[v3,v4]", "v1", "v2", "v5"]);
  });

  it("moves a view next to a view that lives in a section", () => {
    const tree = buildTree(views, sections);
    assert.deepEqual(names(moveNode(tree, { kind: "view", id: "v1" }, { type: "after", id: "v3", kind: "view" })!), ["v2", "s1[v3,v1,v4]", "v5"]);
  });

  it("refuses nesting a section, self drops and unknown ids", () => {
    const tree = buildTree(views, sections);
    assert.equal(moveNode(tree, { kind: "section", id: "s1" }, { type: "into", sectionId: "s1" }), null);
    assert.equal(moveNode(tree, { kind: "view", id: "v1" }, { type: "before", id: "v1", kind: "view" }), null);
    assert.equal(moveNode(tree, { kind: "view", id: "nope" }, { type: "root-end" }), null);
    assert.equal(moveNode(tree, { kind: "section", id: "s1" }, { type: "after", id: "v3", kind: "view" }), null);
  });

  it("never loses a view on any move", () => {
    const tree = buildTree(views, sections);
    const moved = moveNode(tree, { kind: "view", id: "v2" }, { type: "into", sectionId: "s1" })!;
    const flat = treeToNodes(moved).filter((n) => n.kind === "view").map((n) => n.id).sort();
    assert.deepEqual(flat, ["v1", "v2", "v3", "v4", "v5"]);
  });

  it("round-trips through explicit nodes", () => {
    const tree = moveNode(buildTree(views, sections), { kind: "view", id: "v1" }, { type: "into", sectionId: "s1" })!;
    const applied = applyNodes(views, sections, treeToNodes(tree));
    assert.deepEqual(names(buildTree(applied.views, applied.sections)), names(tree));
  });

  it("makes names unique among siblings", () => {
    assert.equal(uniqueName("Grid", ["Grid", "Form"]), "Grid 2");
    assert.equal(uniqueName("grid", ["Grid", "Grid 2"]), "grid 3");
    assert.equal(uniqueName("New", []), "New");
  });
});
