import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { applyFilters, applySort, matchesSearch } from "@/lib/base/query";
import type { FilterRule, RecordRow, SortRule, TableBundle } from "@/lib/base/types";
import { createTestDb, makeCaller, USER_A } from "./testDb";
import { testDatabaseUrl } from "./testDatabaseUrl";

/**
 * Integration tests for: automatic Code sequences, Forms category, voucher PDFs (original + generated) and
 * server-side filtering. Needs TEST_DATABASE_URL (isolated local PostgreSQL); skipped otherwise.
 */
const ADMIN_URL = testDatabaseUrl();
const skip = !ADMIN_URL;

let db: Awaited<ReturnType<typeof createTestDb>>;
let call: ReturnType<typeof makeCaller>;

const sha = (b: Uint8Array | Buffer) => createHash("sha256").update(b).digest("hex");
const bundle = async (t: string) => (await call("GET", `tables/${t}`)).json as TableBundle;
const TEMPLATE_DIR = path.join(process.cwd(), "public/vouchers/template");
const newAction = (extra: Record<string, unknown> = {}) => call("POST", "tables/actions/records", { accrue: "2026-11-01", title: "Seq test", type: "Notice", status: "Queue", ...extra });

describe("automatic codes, form categories, voucher PDFs and server filtering", { skip }, () => {
  before(async () => {
    db = await createTestDb(ADMIN_URL!);
    call = makeCaller(db.pool);
  });
  after(async () => {
    await db?.drop();
  });

  describe("Code sequence", () => {
    it("the next code is one more than the highest existing code, not the record count", async () => {
      const b = await bundle("actions");
      assert.equal(b.records.length, 158);
      assert.ok(b.records.some((r) => r.code === "A-4642"), "existing codes are preserved by the migration");
      assert.equal((await call("GET", "tables/actions/next/code")).json.value, "A-4771", "highest existing is A-4770 (gaps below it are not refilled)");
      const first = await newAction();
      assert.equal(first.status, 201);
      assert.equal(first.json.code, "A-4771");
      assert.equal((await call("GET", "tables/actions/next/code")).json.value, "A-4772");
      assert.equal((await newAction()).json.code, "A-4772");
    });

    it("a code sent by the client is ignored: the server decides", async () => {
      const r = await newAction({ code: "A-1" });
      assert.equal(r.status, 201);
      assert.equal(r.json.code, "A-4773");
    });

    it("an existing code is never regenerated or changed by an update", async () => {
      const r = (await newAction()).json;
      const before = r.code;
      const upd = await call("PATCH", `tables/actions/records/${r.id}`, { title: "Renamed", status: "Ongoing" });
      assert.equal(upd.json.code, before);
      const hack = await call("PATCH", `tables/actions/records/${r.id}`, { code: "A-9999" });
      assert.equal(hack.status, 422);
      assert.match(hack.json.fieldErrors.code, /assigned automatically/);
      assert.equal((await bundle("actions")).records.find((x) => x.id === r.id)!.code, before);
    });

    it("parallel creates never produce a duplicate and use consecutive numbers", async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => newAction()));
      assert.ok(results.every((r) => r.status === 201));
      const nums = results.map((r) => Number(String(r.json.code).slice(2))).sort((a, b) => a - b);
      assert.equal(new Set(nums).size, 12, "all codes distinct");
      for (let i = 1; i < nums.length; i += 1) assert.equal(nums[i], nums[i - 1] + 1, "no skipped numbers under concurrency");
    });

    it("a deleted record's code is not reused, and gaps are not refilled", async () => {
      const a = (await newAction()).json;
      const n = Number(a.code.slice(2));
      await call("DELETE", `tables/actions/records/${a.id}`);
      const b = (await newAction()).json;
      assert.equal(b.code, `A-${n + 1}`, "the code of the deleted highest record is not handed out again");
      // an imported record far ahead moves the sequence past it
      const group = (await db.pool.query("SELECT group_id FROM boss_groups WHERE section_slug = 'actions' LIMIT 1")).rows[0].group_id;
      await db.pool.query(`INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('actions', 'imp1', $1, 999, $2::jsonb)`, [group, JSON.stringify({ id: "imp1", code: "A-5000", title: "imported", accrue: "2026-07-01", type: "Notice", status: "Queue" })]);
      assert.equal((await newAction()).json.code, "A-5001");
    });

    it("the database itself rejects a duplicate code (unique index)", async () => {
      const group = (await db.pool.query("SELECT group_id FROM boss_groups WHERE section_slug = 'actions' LIMIT 1")).rows[0].group_id;
      await assert.rejects(
        db.pool.query(`INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('actions', 'dup1', $1, 1000, $2::jsonb)`, [group, JSON.stringify({ id: "dup1", code: "A-4642" })]),
        /boss_seq_actions_code|duplicate key/,
      );
    });

    it("Leads and Transactions have their own sequences (prefix and zero padding)", async () => {
      assert.equal((await call("POST", "tables/leads/records", { client: "FEMA", title: "New lead" })).json.leadId, "L-4097");
      const t1 = await call("POST", "tables/transactions/records", { voucher: "V-1" });
      assert.equal(t1.json.trans, "04105");
      assert.equal((await call("POST", "tables/transactions/records", { voucher: "V-2" })).json.trans, "04106");
      assert.equal((await call("GET", "tables/leads/next/leadId")).json.value, "L-4098");
    });

    it("fields without automatic codes have no preview, and other tables are unaffected", async () => {
      assert.equal((await call("GET", "tables/profiles/next/name")).status, 404);
      assert.equal((await call("GET", "tables/nope/next/code")).status, 404);
      const p = await call("POST", "tables/profiles/records", { contact: "SEQ", name: "Seq", position: "x", type: "Agent", email: "seq@example.com" });
      assert.equal(p.json.contact, "SEQ", "a manually entered code (not a sequence) is kept");
    });
  });

  describe("Forms: Style is Work or Vouchers", () => {
    it("the Category column is gone; Style offers exactly Work and Vouchers; existing forms stay Work", async () => {
      const b = await bundle("forms");
      assert.ok(!b.fields.some((f) => f.key === "category" || f.name === "Category"), "no Category column");
      const style = b.fields.find((f) => f.key === "style")!;
      assert.equal(style.name, "Style");
      assert.deepEqual(style.options.choices!.map((c) => c.name), ["Work", "Vouchers"]);
      assert.ok(b.records.length >= 13 && b.records.every((r) => r.style === "Work"), "existing forms keep Work");
    });

    it("a form's Style can be Work or Vouchers when creating and editing; anything else is refused", async () => {
      const base = { code: "ZZ", type: "Ticket", slug: "zz-form", title: "ZZ" };
      const v = await call("POST", "tables/forms/records", { ...base, code: "VF", style: "Vouchers" });
      assert.equal(v.json.style, "Vouchers");
      const w = await call("POST", "tables/forms/records", { ...base, code: "WF" });
      assert.equal(w.json.style, "Work", "no style sent: default Work");
      assert.equal((await call("POST", "tables/forms/records", { ...base, code: "BF", style: "Other" })).status, 422);
      assert.equal((await call("PATCH", `tables/forms/records/${w.json.id}`, { style: "Vouchers" })).json.style, "Vouchers");
      assert.equal((await call("PATCH", `tables/forms/records/${w.json.id}`, { style: "Work" })).json.style, "Work");
      assert.equal((await call("PATCH", `tables/forms/records/${w.json.id}`, { style: "Nope" })).status, 422);
    });

    it("Style views organize forms: grouped by Style, and Work / Voucher views", async () => {
      const b = await bundle("forms");
      const keys = b.views.map((v) => v.config.key);
      for (const k of ["all", "work", "vouchers"]) assert.ok(keys.includes(k), k);
      assert.deepEqual(b.views.find((v) => v.config.key === "all")!.config.groupBy, [{ field: "style", dir: "asc" }]);
      const vouchersView = b.views.find((v) => v.config.key === "vouchers")!;
      assert.deepEqual(vouchersView.config.filters.map((f) => [f.field, f.op, f.value]), [["style", "is", "Vouchers"]]);
      const shown = applyFilters(b.records, vouchersView.config.filters, b.fields, b.linked).map((r) => r.code);
      assert.ok(shown.includes("VF") && !shown.includes("JC") && !shown.includes("WF"));
      const work = applyFilters(b.records, b.views.find((v) => v.config.key === "work")!.config.filters, b.fields, b.linked).map((r) => r.code);
      assert.ok(work.includes("JC") && work.includes("WF") && !work.includes("VF"));
    });

    it("a Form view has its own category (separate from the view type), default Work", async () => {
      const w = await call("POST", "tables/profiles/views", { name: "F work", type: "form" });
      assert.equal(w.json.type, "form");
      assert.equal(w.json.config.form.category, "Work");
      const v = await call("POST", "tables/profiles/views", { name: "F vouchers", type: "form", category: "Vouchers" });
      assert.equal(v.json.config.form.category, "Vouchers");
      const bad = await call("POST", "tables/profiles/views", { name: "F bad", type: "form", category: "Nope" });
      assert.equal(bad.json.config.form.category, "Work");
      const changed = await call("PATCH", `tables/profiles/views/${w.json.id}`, { config: { ...w.json.config, form: { ...w.json.config.form, category: "Vouchers" } } });
      assert.equal(changed.json.config.form.category, "Vouchers");
      const seeded = (await bundle("profiles")).views.find((x) => x.config.key === "team-onboarding")!;
      assert.equal(seeded.config.form!.category, "Work", "existing form views keep working and got a default category");
    });
  });

  describe("Voucher document", () => {
    it("the default voucher template is the supplied PNG and PDF, unchanged", async () => {
      const png = await fs.readFile(path.join(TEMPLATE_DIR, "Voucher_Template.png"));
      assert.equal(sha(png), "ad6399878bc6f60bde5f8cb9118be6c72478880ab8b5aaf870e616c42346bdff", "byte-for-byte the supplied PNG");
      assert.equal(png.readUInt32BE(16), 2550, "2550 px wide");
      assert.equal(png.readUInt32BE(20), 3300, "3300 px tall");
      const pdf = await fs.readFile(path.join(TEMPLATE_DIR, "Voucher_Template.pdf"));
      assert.equal(sha(pdf), "ee44b8c71931390324c547e543117ba7ebef2aecab97dda31a6dce7596f4dec6", "byte-for-byte the supplied PDF");
      assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    });

    it("vouchers carry the document details but no per-voucher PDF fields", async () => {
      const b = await bundle("vouchers");
      for (const gone of ["pdf", "generatedPdf", "pdfStatus"]) assert.ok(!b.fields.some((f) => f.key === gone), `${gone} was removed`);
      for (const kept of ["voucherNo", "docType", "headline", "vendorAccount", "contractNo", "operatedBy", "deliverVia", "tracking", "manifestLines", "packLines"]) assert.ok(b.fields.some((f) => f.key === kept), kept);
      const v1 = b.records.find((r) => r.i === 11574)!;
      assert.equal(v1.docType, "FD");
      assert.equal(v1.headline, "ASN - DELIVERED");
      assert.equal(v1.contractNo, "70FB7026F00000036");
      assert.equal("pdf" in v1, false, "no PDF is attached to individual vouchers");
    });

    it("the app no longer generates, uploads or replaces voucher PDFs", async () => {
      const v = (await bundle("vouchers")).records[0];
      assert.equal((await call("POST", `tables/vouchers/records/${v.id}/generate-pdf`)).status, 404);
      assert.equal((await call("DELETE", `tables/vouchers/records/${v.id}/generated-pdf`)).status, 404);
      assert.ok((await bundle("vouchers")).records.some((r) => r.id === v.id), "a stray path suffix must never delete or change the record");
      assert.equal((await call("PATCH", `tables/vouchers/records/${v.id}/whatever`, { tracking: "x" })).status, 404);
      assert.equal((await call("DELETE", `tables/vouchers/fields/tracking/extra`)).status, 404);
      const form = new FormData();
      form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "x.pdf", { type: "application/pdf" }));
      const res = await (await import("./api")).handleApi(db.pool, { method: "POST", segments: ["tables", "vouchers", "records", v.id, "files", "pdf"], userId: USER_A, request: new Request("http://localhost/api/base/tables/vouchers/records/x/files/pdf", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: form }) });
      assert.equal(res.status, 404);
      // saving voucher details works and never invents a document
      const upd = await call("PATCH", `tables/vouchers/records/${v.id}`, { tracking: "T-1", voucherNote: "n" });
      assert.equal(upd.status, 200);
      assert.equal("generatedPdf" in upd.json, false);
      const planted = await call("PATCH", `tables/vouchers/records/${v.id}`, { pdf: [{ id: "x", name: "x.pdf", url: "/api/files/x", type: "application/pdf" }] });
      assert.equal(planted.status, 422, "unknown fields are refused");
    });
  });

  describe("server-side filtering", () => {
    const rule = (field: string, op: FilterRule["op"], extra: Partial<FilterRule> = {}): FilterRule => ({ id: field + op, join: "and", field, op, ...extra });
    async function parity(table: string, filters: FilterRule[], sort: SortRule[] = [], search = "") {
      const b = await bundle(table);
      const client = applySort(applyFilters(b.records.filter((r) => matchesSearch(r, search, b.fields, b.linked)), filters, b.fields, b.linked), sort, b.fields, b.linked).map((r) => r.id);
      const server = await call("POST", `tables/${table}/query`, { filters, sort, search, limit: 500, offset: 0 });
      assert.equal(server.status, 200, `${table} ${JSON.stringify(filters)} -> ${JSON.stringify(server.json)}`);
      assert.deepEqual(server.json.records.map((r: RecordRow) => r.id), client, `${table} ${JSON.stringify(filters)} ${JSON.stringify(sort)}`);
      assert.equal(server.json.total, client.length);
      return client;
    }

    it("matches the in-browser results for text, number, date, select, multi-select, checkbox, link and computed fields", async () => {
      const profiles = (await bundle("profiles")).records;
      const eje = profiles.find((p) => p.contact === "EJE")!.id;
      const jad = profiles.find((p) => p.contact === "JAD")!.id;
      await parity("actions", [rule("status", "is", { value: "Queue" })]);
      await parity("actions", [rule("status", "isAnyOf", { values: ["Queue", "Ongoing"] })]);
      await parity("actions", [rule("status", "isNoneOf", { values: ["Queue"] })]);
      await parity("actions", [rule("type", "isNot", { value: "Notice" })]);
      await parity("actions", [rule("accrue", "between", { value: "2026-07-08", value2: "2026-07-24" })]);
      await parity("actions", [rule("accrue", "between", { value: "2026-07-14", value2: "" })]);
      await parity("actions", [rule("accrue", "before", { value: "2026-07-08" })]);
      await parity("actions", [rule("accrue", "after", { value: "2026-07-15" })]);
      await parity("actions", [rule("accrue", "is", { value: "2026-07-06" })]);
      await parity("actions", [rule("title", "contains", { value: "monday" })]);
      await parity("actions", [rule("title", "notContains", { value: "monday" })]);
      await parity("actions", [rule("code", "is", { value: "a-4642" })]);
      await parity("actions", [rule("asn", "isAnyOf", { values: [eje, jad] })]);
      await parity("actions", [rule("asn", "isNoneOf", { values: [eje] })]);
      await parity("actions", [rule("asn", "isEmpty")]);
      await parity("actions", [rule("asn", "is", { value: jad })]);
      await parity("actions", [rule("sort", "between", { value: 1, value2: 5 })]);
      await parity("actions", [rule("sort", "gt", { value: 10 })]);
      await parity("actions", [rule("sort", "isEmpty")]);
      await parity("actions", [rule("accrue", "isEmpty")]);
      await parity("actions", [rule("status", "isAnyOf", { values: ["Priority", "Review", "NOW"] })]);
      await parity("actions", [rule("type", "is", { value: "Tasking" }), rule("folio", "contains", { value: "FEMA" })]);
      await parity("actions", [rule("title", "contains", { value: "🧾" })]);
      await parity("actions", [rule("qa", "is", { value: false })]);
      await parity("actions", [rule("wk", "isEmpty")]);
      await parity("actions", [rule("wk", "isNotEmpty")]);
      await parity("actions", [rule("status", "is", { value: "Queue" }), rule("qa", "is", { value: false })]);
      await parity("actions", [rule("status", "is", { value: "Queue" }), rule("type", "is", { value: "Notice", join: "or" })]);
      await parity("items", [rule("qty", "between", { value: 50, value2: 120 })]);
      await parity("items", [rule("qty", "gt", { value: 100 })]);
      await parity("items", [rule("qty", "lte", { value: 95 })]);
      await parity("items", [rule("qty", "neq", { value: 95 })]);
      await parity("items", [rule("stockStatus", "isNot", { value: "In stock" })]);
      await parity("items", [rule("stockStatus", "isAnyOf", { values: ["Low stock", "Out of stock"] })]);
      await parity("items", [rule("category", "isAnyOf", { values: ["Feeding", "Hygiene"] })]);
      await parity("items", [rule("reorderLevel", "isEmpty")]);
      await parity("items", [rule("pic", "isNotEmpty")]);
      await parity("profiles", [rule("team", "is", { value: true })]);
      await parity("profiles", [rule("billing", "isEmpty")]);
      await parity("profiles", [rule("email", "contains", { value: "ray" })]);
      await parity("profiles", [rule("photo", "isEmpty")]);
      await parity("folios", [rule("assigneeId", "is", { value: eje })]);
      await parity("folios", [rule("assigneeId", "isAnyOf", { values: [eje, jad] })]);
      await parity("folios", [rule("assigneeId", "isNoneOf", { values: [eje] })]);
      await parity("folios", [rule("categoryId", "isEmpty")]);
      await parity("capabilities", [rule("area", "isAnyOf", { values: ["System", "Exception"] })]);
      await parity("capabilities", [rule("go", "is", { value: true }), rule("area", "is", { value: "System" })]);
      await parity("vouchers", [rule("voucherNo", "contains", { value: "FD" })]);
      await parity("vouchers", [rule("no", "between", { value: 12574, value2: 12575 })]);
      await parity("concepts", [rule("work", "contains", { value: "x" })]);
    });

    it("incomplete conditions never hide anything, on either side", async () => {
      const all = (await bundle("actions")).records.length;
      assert.equal((await parity("actions", [rule("status", "is", { value: "" })])).length, all);
      assert.equal((await parity("actions", [rule("status", "isAnyOf", { values: [] })])).length, all);
      assert.equal((await parity("actions", [rule("accrue", "between", { value: "", value2: "" })])).length, all);
    });

    it("combines with search and sorting exactly like the browser", async () => {
      await parity("actions", [rule("status", "is", { value: "Queue" })], [{ field: "accrue", dir: "desc" }], "");
      await parity("actions", [], [{ field: "status", dir: "asc" }, { field: "accrue", dir: "desc" }], "");
      await parity("actions", [rule("type", "is", { value: "Tasking" })], [{ field: "accrue", dir: "asc" }], "review");
      await parity("items", [rule("qty", "gt", { value: 100 })], [{ field: "qty", dir: "desc" }], "baby");
      await parity("items", [], [{ field: "qty", dir: "asc" }, { field: "title", dir: "asc" }]);
    });

    it("pages results and reports the total", async () => {
      const page1 = await call("POST", "tables/actions/query", { filters: [], limit: 5, offset: 0 });
      const page2 = await call("POST", "tables/actions/query", { filters: [], limit: 5, offset: 5 });
      assert.equal(page1.json.records.length, 5);
      assert.ok(page1.json.total >= 16);
      assert.equal(page2.json.total, page1.json.total);
      const ids = new Set([...page1.json.records, ...page2.json.records].map((r: RecordRow) => r.id));
      assert.equal(ids.size, 10, "pages do not overlap");
    });

    it("treats hostile values as data and refuses filters it cannot evaluate", async () => {
      const evil = `'; DROP TABLE boss_records; --`;
      const r = await call("POST", "tables/actions/query", { filters: [rule("title", "contains", { value: evil })], search: evil, limit: 10, offset: 0 });
      assert.equal(r.status, 200);
      assert.equal(r.json.records.length, 0);
      assert.ok(Number((await db.pool.query("SELECT COUNT(*) AS n FROM boss_records")).rows[0].n) > 100, "the table is intact");
      const unknownField = await call("POST", "tables/actions/query", { filters: [{ id: "x", join: "and", field: "title'; --", op: "is", value: "a" }], limit: 10, offset: 0 });
      assert.equal(unknownField.status, 200, "unknown fields are ignored, never interpolated");
      const bad = await call("POST", "tables/categories/query", { filters: [rule("folios", "contains", { value: "x" })], limit: 10, offset: 0 });
      assert.equal(bad.status, 422);
    });

    it("switches a large table to server mode and serves the first page", async () => {
      process.env.BOSS_SERVER_QUERY_THRESHOLD = "10";
      try {
        const b = await bundle("actions");
        assert.equal(b.serverMode, true);
        assert.ok(b.recordCount > 10);
        const small = await bundle("concepts");
        assert.equal(small.serverMode, b.recordCount <= 10 ? false : small.recordCount > 10);
      } finally {
        delete process.env.BOSS_SERVER_QUERY_THRESHOLD;
      }
      assert.equal((await bundle("actions")).serverMode, false);
    });

    it("filters persist in the view and never change the records", async () => {
      const before = (await bundle("actions")).records.length;
      const view = (await call("POST", "tables/actions/views", { name: "Filtered", type: "grid" })).json;
      const filters = [rule("status", "isAnyOf", { values: ["Queue"] }), rule("accrue", "between", { value: "2026-07-01", value2: "2026-07-31", join: "and" })];
      await call("PATCH", `tables/actions/views/${view.id}`, { config: { ...view.config, filters } });
      const reloaded = (await bundle("actions")).views.find((v) => v.id === view.id)!;
      assert.deepEqual(reloaded.config.filters.map((f) => [f.op, f.values ?? null, f.value2 ?? null]), [["isAnyOf", ["Queue"], null], ["between", null, "2026-07-31"]]);
      assert.equal((await bundle("actions")).records.length, before, "filtering never deletes or edits records");
    });
  });

  it("upgrades a database that still has the Category column: Vouchers carries over to Style, nothing is lost", async () => {
    const { applyBaseMigrations } = await import("./migrate");
    // put the forms table back into its previous state
    await db.pool.query("INSERT INTO boss_fields (table_slug, key, name, type, options, position, required) VALUES ('forms', 'category', 'Category', 'singleSelect', $1::jsonb, 99, true) ON CONFLICT DO NOTHING", [JSON.stringify({ choices: [{ id: "ch_work", name: "Work", color: "green" }, { id: "ch_vouchers", name: "Vouchers", color: "orange" }] })]);
    await db.pool.query(`UPDATE boss_fields SET options = '{"choices":[{"id":"ch_work","name":"Work","color":"green"}]}'::jsonb WHERE table_slug = 'forms' AND key = 'style'`);
    const group = (await db.pool.query("SELECT group_id FROM boss_groups WHERE section_slug = 'forms' LIMIT 1")).rows[0].group_id;
    const rec = (code: string, data: Record<string, unknown>) => db.pool.query(`INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('forms', $1, $2, 900, $3::jsonb)`, [`old-${code}`, group, JSON.stringify({ id: `old-${code}`, code, ...data })]);
    await rec("OV", { slug: "ov", title: "Old voucher form", style: "Work", category: "Vouchers" });
    await rec("OW", { slug: "ow", title: "Old work form", style: "Work", category: "Work" });
    await rec("OB", { slug: "ob", title: "Old blank style", category: "Work" });
    const view = (await bundle("forms")).views.find((v) => v.config.key === "vouchers")!;
    await db.pool.query(`UPDATE boss_views SET config = replace(config::text, '"style"', '"category"')::jsonb WHERE id = $1`, [view.id]);
    await db.pool.query("DELETE FROM boss_migrations WHERE id = 'v4:forms-style-work-vouchers'");

    const report = await applyBaseMigrations(db.pool);
    assert.ok(report.backfills.some((x) => x.id === "v4:forms-style-work-vouchers"));
    const b = await bundle("forms");
    assert.ok(!b.fields.some((f) => f.key === "category"), "Category column removed");
    assert.deepEqual(b.fields.find((f) => f.key === "style")!.options.choices!.map((c) => c.name), ["Work", "Vouchers"]);
    const by = (code: string) => b.records.find((r) => r.code === code)!;
    assert.equal(by("OV").style, "Vouchers", "a form that was Vouchers keeps it");
    assert.equal(by("OW").style, "Work");
    assert.equal(by("OB").style, "Work", "a blank style became Work");
    assert.equal(by("OV").category, "Vouchers", "the old value is kept in the record, never deleted");
    assert.equal(b.views.find((v) => v.id === view.id)!.config.filters[0].field, "style", "views now filter on Style");
    assert.deepEqual((await applyBaseMigrations(db.pool)).backfills, [], "running it again changes nothing");
  });

  it("Vouchers: VSF is a link and Scans an attachment; the seed carries the export's links, notes and manifests", async () => {
    const b = await bundle("vouchers");
    assert.equal(b.fields.find((f) => f.key === "vsf")!.type, "url");
    assert.equal(b.fields.find((f) => f.key === "scans")!.type, "attachment");
    const v = (i: number) => b.records.find((r) => r.i === i)!;
    assert.equal(v(11574).vsf, "https://airtable.com/tblK7rY6QSShUYfF7/recnXQccF9jWDFyNX?blocks=bliWJCFmNjlbeUs8q");
    assert.equal(String(v(11578).voucherNote).split("\n").length, 5);
    assert.ok(String(v(11579).manifest).includes("Unnamed record") && !String(v(11579).manifest).includes("Unnamed manifest"));
    // VSF must be a real link; Scans take files like any attachment field
    assert.equal((await call("POST", "tables/vouchers/records", { docType: "BL", vsf: "VSF" })).status, 422);
    const ok = await call("POST", "tables/vouchers/records", { docType: "BL", vsf: "https://airtable.com/tblX/recY", scans: [] });
    assert.equal(ok.status, 201);
    assert.deepEqual(ok.json.scans, []);
  });

  it("upgrades a database that already has the earlier voucher import: only seed values are replaced, edits are kept, nothing is lost", async () => {
    const { applyBaseMigrations } = await import("./migrate");
    const q = db.pool.query.bind(db.pool);
    // the earlier state: VSF a select holding "VSF", Scans a number, notes cut to their first line, the old manifest wording
    await q(`UPDATE boss_fields SET type = 'singleSelect', options = '{"choices":[{"id":"ch_vsf","name":"VSF","color":"blue"}]}'::jsonb WHERE table_slug = 'vouchers' AND key = 'vsf'`);
    await q(`UPDATE boss_fields SET type = 'number', options = '{"format":"integer","min":0}'::jsonb WHERE table_slug = 'vouchers' AND key = 'scans'`);
    const patch = (i: number, data: Record<string, unknown>) => q(`UPDATE boss_records SET data = data || $2::jsonb WHERE section_slug = 'vouchers' AND data->>'i' = $1`, [String(i), JSON.stringify(data)]);
    await patch(11574, { vsf: "VSF", scans: 0 });
    await patch(11578, { vsf: "VSF", voucherNote: "Total Quality Logistics (TQL)", scans: 3 });
    await patch(11579, { vsf: "VSF", voucherNote: "Company: ABC Company", manifest: "QUOTE REQUESTED:\nUnnamed manifest\nUnnamed manifest", reference2: "Airline Booking #: " });
    await patch(11580, { vsf: "https://my.example/own-link", voucherNote: "My own note, typed by a person" });
    await q("DELETE FROM boss_migrations WHERE id = 'v6:vouchers-csv-update'");

    const report = await applyBaseMigrations(db.pool);
    assert.ok(report.backfills.some((x) => x.id === "v6:vouchers-csv-update"));
    const b = await bundle("vouchers");
    assert.equal(b.fields.find((f) => f.key === "vsf")!.type, "url");
    assert.equal(b.fields.find((f) => f.key === "scans")!.type, "attachment");
    const v = (i: number) => b.records.find((r) => r.i === i)!;
    assert.equal(v(11574).vsf, "https://airtable.com/tblK7rY6QSShUYfF7/recnXQccF9jWDFyNX?blocks=bliWJCFmNjlbeUs8q", "the placeholder VSF became the link");
    assert.equal(v(11578).voucherNote, "Total Quality Logistics (TQL)\nPhone Number: (513) 831-2600\nEst. Price of Delivery: $3,750.00\nPick-up time: 7:00 AM to 4:30 PM\nPick-up date: 07/28/26", "a note cut to its first line was completed");
    assert.equal(v(11578).scansCount, 3, "an old Scans number is kept, under another key");
    assert.ok(!("scans" in v(11578)) || Array.isArray(v(11578).scans), "Scans is free for files");
    assert.equal(v(11579).manifest, "QUOTE REQUESTED:\nUnnamed record\nUnnamed record");
    assert.equal(v(11579).reference2, "Airline Booking #:", "a trailing space was trimmed");
    assert.equal(v(11580).voucherNote, "My own note, typed by a person", "a note a person wrote is never replaced");
    assert.equal(v(11580).vsf, "https://my.example/own-link", "a link a person set is kept");
    assert.deepEqual((await applyBaseMigrations(db.pool)).backfills, [], "running it again changes nothing");
  });

  it("Actions follow the export: its 10 columns in order, 158 actions in the export's order, Asn linked to team profiles", async () => {
    const b = await bundle("actions");
    assert.deepEqual(b.fields.map((f) => f.name), ["Code", "Wk", "Accrue", "Status", "Task Title", "Type", "Folio", "Asn", "QA", "Sort"]);
    assert.deepEqual(b.fields.filter((f) => f.required).map((f) => f.key), ["code"], "only the generated Code is required");
    const f = (k: string) => b.fields.find((x) => x.key === k)!;
    assert.equal(f("asn").type, "link");
    assert.equal(f("asn").options.multiple, true);
    assert.equal(f("sort").type, "number");
    assert.equal(f("qa").type, "checkbox");
    assert.equal(f("status").options.choices!.length, 10);
    assert.equal(f("type").options.choices!.length, 18);
    assert.deepEqual(f("status").options.choices!.slice(0, 3).map((c) => c.name), ["Ongoing", "Queue", "Scheduled"]);
    const { ACTION_EXPORT } = await import("@/data/actionsExport");
    const exported = new Set(ACTION_EXPORT.map((a) => a.code));
    assert.deepEqual(b.records.filter((r) => exported.has(String(r.code))).map((r) => r.code), ACTION_EXPORT.map((a) => a.code), "the export's order (actions other tests created come after)");
    const profiles = (await bundle("profiles")).records;
    const id = (c: string) => profiles.find((p) => p.contact === c)!.id;
    const a = (code: string) => b.records.find((r) => r.code === code)!;
    assert.deepEqual(a("A-4666").asn, [id("AES")]);
    assert.deepEqual(a("A-4672").asn, [id("JAD"), id("AES")]);
    assert.deepEqual([a("A-4314").asn, a("A-4314").asnCode], [[], "LMF"]);
    assert.equal(b.views.find((v) => v.config.key === "all")!.config.sort.length, 0, "All Actions keeps the export's order");
    // an action needs nothing but a title to be saved now; values are still checked
    assert.equal((await call("POST", "tables/actions/records", { title: "Only a title" })).status, 201);
    assert.equal((await call("POST", "tables/actions/records", { status: "Nope" })).status, 422);
    assert.equal((await call("POST", "tables/actions/records", { sort: -1 })).status, 422);
    const notTeam = (await call("POST", "tables/profiles/records", { contact: "NTA", name: "Not Team A", position: "x", type: "Rep", email: "nta@example.com", team: false })).json;
    assert.equal((await call("POST", "tables/actions/records", { asn: [notTeam.id] })).status, 422, "only team members can be assigned");
    assert.equal((await call("POST", "tables/actions/records", { asn: [id("EJE"), id("BEM")], sort: 3, type: "Phone", status: "Priority" })).status, 201);
  });

  it("upgrades a database that has the 16 demo actions: untouched demo rows are replaced or removed, edits are kept, nothing typed is lost", async () => {
    const { applyBaseMigrations } = await import("./migrate");
    const { ACTION_EXPORT } = await import("@/data/actionsExport");
    const q = db.pool.query.bind(db.pool);
    // ---- the earlier state
    await q("DELETE FROM boss_records WHERE section_slug = 'actions'");
    await q("DELETE FROM boss_fields WHERE table_slug = 'actions' AND key IN ('asn', 'sort')");
    await q("UPDATE boss_fields SET name = 'Title' WHERE table_slug = 'actions' AND key = 'title'");
    await q("UPDATE boss_fields SET required = TRUE WHERE table_slug = 'actions' AND key IN ('accrue', 'title', 'type', 'status')");
    await q(`UPDATE boss_fields SET options = '{"choices":[{"id":"c1","name":"Ongoing","color":"red"},{"id":"c2","name":"Queue","color":"purple"},{"id":"c3","name":"Scheduled","color":"cyan"}]}'::jsonb WHERE table_slug = 'actions' AND key = 'status'`);
    await q(`UPDATE boss_fields SET options = '{"choices":[{"id":"t1","name":"Tasking","color":"blue"},{"id":"t2","name":"Training","color":"orange"},{"id":"t3","name":"Notice","color":"yellow"}]}'::jsonb WHERE table_slug = 'actions' AND key = 'type'`);
    await q("INSERT INTO boss_fields (table_slug, key, name, type, options, position) VALUES ('actions', 'act', 'Act', 'checkbox', '{}', 7) ON CONFLICT DO NOTHING");
    await q(`UPDATE boss_views SET config = jsonb_set(config, '{sort}', '[{"field":"accrue","dir":"asc"}]'::jsonb) WHERE table_slug = 'actions' AND config->>'key' = 'all'`);
    await q("DELETE FROM boss_migrations WHERE id = 'v7:actions-export'");
    const group = (await q("SELECT group_id FROM boss_groups WHERE section_slug = 'actions' LIMIT 1")).rows[0].group_id;
    const demo: Array<[string, string, string, string, string, string, string, boolean, boolean]> = [
      ["A-4642", "2026-07-06", "Review S14 Telemetry Reports", "Tasking", "Ongoing", "FL-1002", "26.28", true, true],
      ["A-4643", "2026-07-06", "Update Onboarding Guidelines", "Training", "Queue", "FL-1004", "26.28", false, false],
      ["A-4645", "2026-07-07", "Draft QA Deployment Notice", "Notice", "Scheduled", "FL-1005", "26.29", true, false],
      ["A-4650", "2026-07-07", "API Compliance Test Run", "Tasking", "Ongoing", "FL-1012", "26.29", true, true],
      ["A-4652", "2026-07-08", "Database Indexing Protocols", "Tasking", "Queue", "FL-1001", "26.30", false, false],
    ];
    const ins = (data: Record<string, unknown>, pos: number) => q("INSERT INTO boss_records (section_slug, record_id, group_id, position, data) VALUES ('actions', $1, $2, $3, $4::jsonb)", [data.id, group, pos, JSON.stringify(data)]);
    for (const [n, d] of demo.entries()) await ins({ id: d[0], code: d[0], accrue: d[1], title: d[2], type: d[3], status: d[4], folio: d[5], wk: d[6], act: d[7], qa: d[8] }, n);
    await q(`UPDATE boss_records SET data = data || '{"title":"Edited by a person"}'::jsonb WHERE section_slug = 'actions' AND record_id = 'A-4645'`); // in the export, edited
    await q(`UPDATE boss_records SET data = data || '{"title":"My own action"}'::jsonb WHERE section_slug = 'actions' AND record_id = 'A-4650'`); // not in the export, edited
    await ins({ id: "A-4900", code: "A-4900", title: "Added by a person", status: "Queue" }, 10);

    const report = await applyBaseMigrations(db.pool);
    assert.ok(report.backfills.some((x) => x.id === "v7:actions-export"), JSON.stringify(report.backfills));
    const b = await bundle("actions");
    const a = (code: string) => b.records.find((r) => r.code === code);
    const profiles = (await bundle("profiles")).records;
    const id = (c: string) => profiles.find((p) => p.contact === c)!.id;

    // fields
    assert.deepEqual(b.fields.slice(0, 10).map((f) => f.name), ["Code", "Wk", "Accrue", "Status", "Task Title", "Type", "Folio", "Asn", "QA", "Sort"]);
    assert.deepEqual(b.fields.filter((f) => f.required).map((f) => f.key), ["code"]);
    assert.ok(b.fields.find((f) => f.key === "act" && f.position >= 100), "the previous Act field is kept, after the export's columns");
    assert.deepEqual(b.fields.find((f) => f.key === "status")!.options.choices!.slice(0, 3).map((c) => c.name), ["Ongoing", "Queue", "Scheduled"], "the original choices keep their place");
    assert.equal(b.fields.find((f) => f.key === "status")!.options.choices!.length, 10);
    assert.equal(b.fields.find((f) => f.key === "type")!.options.choices!.length, 18);
    const all = b.views.find((v) => v.config.key === "all")!;
    assert.equal(all.config.sort.length, 0);
    assert.ok(all.config.hidden.includes("act"));

    // rows
    assert.equal(b.records.length, 158 + 2, "158 from the export + the edited demo action that is not in it + the one a person added");
    assert.deepEqual(b.records.slice(0, 158).map((r) => r.code), ACTION_EXPORT.map((x) => x.code), "the export's order comes first");
    assert.deepEqual(b.records.slice(158).map((r) => r.code).sort(), ["A-4650", "A-4900"]);
    assert.equal(a("A-4642")!.title, ACTION_EXPORT.find((x) => x.code === "A-4642")!.title, "an untouched demo action took the export's values");
    assert.deepEqual(a("A-4642")!.asn, [id("JAD")]);
    assert.equal(a("A-4642")!.accrue, null);
    assert.equal(a("A-4643"), undefined, "an untouched demo action the export does not have was removed");
    assert.equal(a("A-4652"), undefined);
    assert.equal(a("A-4645")!.title, "Edited by a person", "an edited action keeps what a person typed");
    assert.equal(a("A-4645")!.status, "Scheduled");
    assert.deepEqual(a("A-4645")!.asn, [id("RL3")], "…and its blank Asn was filled from the export");
    assert.equal(a("A-4650")!.title, "My own action");
    assert.equal(a("A-4900")!.title, "Added by a person");
    assert.equal(a("A-4900")!.status, "Queue");
    assert.deepEqual((await applyBaseMigrations(db.pool)).backfills, [], "running it again changes nothing");
    assert.ok(Number((await call("GET", "tables/actions/next/code")).json.value.slice(2)) > 4900, "numbering continues after the highest code (and never reuses an issued one)");
  });

  it("the migration reports no warnings on a fresh database and creates the code indexes", async () => {
    assert.deepEqual(db.report.warnings, []);
    const idx = await db.pool.query("SELECT indexname FROM pg_indexes WHERE indexname LIKE 'boss_seq_%' ORDER BY 1");
    assert.deepEqual(idx.rows.map((r) => r.indexname), ["boss_seq_actions_code", "boss_seq_leads_leadId", "boss_seq_transactions_trans"].map((s) => s.toLowerCase()));
    void USER_A;
  });
});
