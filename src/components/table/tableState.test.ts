import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { field, form } from "@/components/popovers/fields";
import type { RecordGroup } from "@/types";
import { applyFilters, applySort, computeView, matchesSearch, type FilterCondition } from "./tableState";

interface Row {
  id: string;
  name: string;
  qty: number;
  active: boolean;
  tags: string[];
  note: string | null;
}
const rows: Row[] = [
  { id: "1", name: "Alpha", qty: 10, active: true, tags: ["x", "y"], note: null },
  { id: "2", name: "beta", qty: 2, active: false, tags: [], note: "hello" },
  { id: "3", name: "Gamma", qty: 100, active: true, tags: ["y"], note: "world" },
  { id: "4", name: "Delta 10", qty: 7, active: false, tags: ["z"], note: null },
];
const fields = [
  field("Name", "name", { form: form.text({ required: true }) }),
  field("Qty", "qty", { type: "number" }),
  field("Active", "active", { kind: "checkbox" }),
  field("Tags", "tags", { type: "list" }),
  field("Note", "note"),
  { name: "Display only", kind: "text" as const },
];
const cond = (id: number, f: string, op: FilterCondition["op"], value: FilterCondition["value"], join: "and" | "or" = "and"): FilterCondition => ({ id, join, field: f, op, value });
const names = (r: Row[]) => r.map((x) => x.name);

describe("search", () => {
  it("matches every term anywhere in the row, ignoring case", () => {
    assert.deepEqual(names(rows.filter((r) => matchesSearch(r, "ALPHA"))), ["Alpha"]);
    assert.deepEqual(names(rows.filter((r) => matchesSearch(r, "hello beta"))), ["beta"]);
    assert.deepEqual(names(rows.filter((r) => matchesSearch(r, "y"))), ["Alpha", "Gamma"]);
    assert.equal(rows.filter((r) => matchesSearch(r, "")).length, 4);
  });
});

describe("filters", () => {
  it("applies text, number and checkbox operators", () => {
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Name", "contains", "a")], fields)), ["Alpha", "beta", "Gamma", "Delta 10"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Name", "is", "alpha")], fields)), ["Alpha"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Qty", "gt", "9")], fields)), ["Alpha", "Gamma"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Active", "is", true)], fields)), ["Alpha", "Gamma"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Note", "isEmpty", "")], fields)), ["Alpha", "Delta 10"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Tags", "contains", "y")], fields)), ["Alpha", "Gamma"]);
  });
  it("combines conditions left to right with and / or", () => {
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Active", "is", true), cond(2, "Qty", "gt", "50")], fields)), ["Gamma"]);
    assert.deepEqual(names(applyFilters(rows, [cond(1, "Qty", "gt", "50"), cond(2, "Name", "is", "beta", "or")], fields)), ["beta", "Gamma"]);
  });
  it("ignores unfinished conditions and fields without a key", () => {
    assert.equal(applyFilters(rows, [cond(1, "Name", "contains", "")], fields).length, 4);
    assert.equal(applyFilters(rows, [cond(1, "Display only", "contains", "zzz")], fields).length, 4);
    assert.equal(applyFilters(rows, [cond(1, "Missing", "is", "x")], fields).length, 4);
  });
});

describe("sort", () => {
  it("sorts numbers numerically, text naturally, blanks last in both directions", () => {
    assert.deepEqual(names(applySort(rows, [{ field: "Qty", dir: "asc" }], fields)), ["beta", "Delta 10", "Alpha", "Gamma"]);
    assert.deepEqual(names(applySort(rows, [{ field: "Qty", dir: "desc" }], fields)), ["Gamma", "Alpha", "Delta 10", "beta"]);
    assert.deepEqual(names(applySort(rows, [{ field: "Name", dir: "asc" }], fields)), ["Alpha", "beta", "Delta 10", "Gamma"]);
    assert.deepEqual(names(applySort(rows, [{ field: "Note", dir: "asc" }], fields)), ["beta", "Gamma", "Alpha", "Delta 10"]);
    assert.deepEqual(names(applySort(rows, [{ field: "Note", dir: "desc" }], fields)), ["Gamma", "beta", "Alpha", "Delta 10"]);
  });
  it("uses later rules to break ties and is stable", () => {
    assert.deepEqual(names(applySort(rows, [{ field: "Active", dir: "desc" }, { field: "Qty", dir: "asc" }], fields)), ["Alpha", "Gamma", "beta", "Delta 10"]);
  });
});

describe("computeView", () => {
  const groups: RecordGroup<Row>[] = [
    { id: "g1", label: "One", count: 9, rows: rows.slice(0, 2) },
    { id: "g2", label: "Two", count: 9, rows: rows.slice(2) },
  ];
  const q = { fields, search: "", sort: [], conditions: [], page: 1, pageSize: 25 };

  it("leaves an untouched view as drawn (design counts, all groups)", () => {
    const v = computeView(groups, q);
    assert.equal(v.matched, 4);
    assert.equal(v.groups[0].count, 9);
    assert.equal(v.filtered, false);
    assert.equal(v.from, 1);
    assert.equal(v.to, 4);
  });
  it("paginates across groups and drops groups with no rows on the page", () => {
    const p1 = computeView(groups, { ...q, pageSize: 3 });
    assert.equal(p1.pages, 2);
    assert.deepEqual(p1.groups.map((g) => g.rows.length), [2, 1]);
    const p2 = computeView(groups, { ...q, pageSize: 3, page: 2 });
    assert.deepEqual(p2.groups.map((g) => g.id), ["g2"]);
    assert.equal(p2.from, 4);
    assert.equal(computeView(groups, { ...q, pageSize: 3, page: 99 }).page, 2);
  });
  it("recounts groups when searching or filtering", () => {
    const v = computeView(groups, { ...q, search: "gamma" });
    assert.equal(v.matched, 1);
    assert.equal(v.filtered, true);
    assert.deepEqual(v.groups.map((g) => [g.id, g.count]), [["g2", 1]]);
    assert.equal(computeView(groups, { ...q, search: "nothing here" }).groups.length, 0);
  });
});
