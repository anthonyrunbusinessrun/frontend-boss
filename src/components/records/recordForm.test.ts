import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { field, form } from "@/components/popovers/fields";
import { fromFormValues, toFormValues, validateForm } from "./recordForm";

const fields = [
  field("Name", "name", { form: form.text({ required: true }) }),
  field("Email", "email", { form: form.email({ nullable: true }) }),
  field("Qty", "qty", { type: "number", form: form.number({ min: 0 }) }),
  field("Kind", "kind", { form: form.select(["A", "B"], { required: true }) }),
  field("Done", "done", { kind: "checkbox", form: form.check() }),
  field("Tags", "tags", { type: "list", form: form.list() }),
  field("Link", "link", { form: form.url({ nullable: true }) }),
  field("Hidden", "hidden"),
];

describe("record form", () => {
  it("validates required, email, number, url and select fields", () => {
    const errors = validateForm({ name: " ", email: "nope", qty: "-3", kind: "", done: false, tags: "", link: "ftp://x" }, fields);
    assert.deepEqual(Object.keys(errors).sort(), ["email", "kind", "link", "name", "qty"]);
    assert.deepEqual(validateForm({ name: "Ok", email: "a@b.co", qty: "4", kind: "A", done: true, tags: "x", link: "https://x.io" }, fields), {});
    assert.deepEqual(validateForm({ name: "Ok", email: "", qty: "", kind: "B", done: false, tags: "", link: "" }, fields), {});
  });
  it("round-trips rows through form values", () => {
    const row = { name: "Row", email: null, qty: 5, kind: "B", done: true, tags: ["a", "b"], link: null, hidden: "x" };
    const values = toFormValues(row, fields);
    assert.equal(values.tags, "a, b");
    assert.equal(values.email, "");
    assert.deepEqual(fromFormValues(values, fields), { name: "Row", email: null, qty: 5, kind: "B", done: true, tags: ["a", "b"], link: null });
  });
  it("defaults a new record's select to its first option", () => {
    assert.equal(toFormValues(null, fields).kind, "A");
  });
});
