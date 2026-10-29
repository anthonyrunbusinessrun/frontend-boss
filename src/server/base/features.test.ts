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
      assert.equal(b.records.length, 16);
      assert.ok(b.records.some((r) => r.code === "A-4642"), "existing codes are preserved by the migration");
      assert.equal((await call("GET", "tables/actions/next/code")).json.value, "A-4702", "highest existing is A-4701 (gaps below it are not refilled)");
      const first = await newAction();
      assert.equal(first.status, 201);
      assert.equal(first.json.code, "A-4702");
      assert.equal((await call("GET", "tables/actions/next/code")).json.value, "A-4703");
      assert.equal((await newAction()).json.code, "A-4703");
    });

    it("a code sent by the client is ignored: the server decides", async () => {
      const r = await newAction({ code: "A-1" });
      assert.equal(r.status, 201);
      assert.equal(r.json.code, "A-4704");
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
      await parity("actions", [rule("accrue", "between", { value: "2026-07-08", value2: "2026-07-12" })]);
      await parity("actions", [rule("accrue", "between", { value: "2026-07-14", value2: "" })]);
      await parity("actions", [rule("accrue", "before", { value: "2026-07-08" })]);
      await parity("actions", [rule("accrue", "after", { value: "2026-07-15" })]);
      await parity("actions", [rule("accrue", "is", { value: "2026-07-06" })]);
      await parity("actions", [rule("title", "contains", { value: "deploy" })]);
      await parity("actions", [rule("title", "notContains", { value: "deploy" })]);
      await parity("actions", [rule("code", "is", { value: "a-4642" })]);
      await parity("actions", [rule("act", "is", { value: true })]);
      await parity("actions", [rule("qa", "is", { value: false })]);
      await parity("actions", [rule("wk", "isEmpty")]);
      await parity("actions", [rule("wk", "isNotEmpty")]);
      await parity("actions", [rule("status", "is", { value: "Queue" }), rule("act", "is", { value: false })]);
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

  it("the migration reports no warnings on a fresh database and creates the code indexes", async () => {
    assert.deepEqual(db.report.warnings, []);
    const idx = await db.pool.query("SELECT indexname FROM pg_indexes WHERE indexname LIKE 'boss_seq_%' ORDER BY 1");
    assert.deepEqual(idx.rows.map((r) => r.indexname), ["boss_seq_actions_code", "boss_seq_leads_leadId", "boss_seq_transactions_trans"].map((s) => s.toLowerCase()));
    void USER_A;
  });
});
