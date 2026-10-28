import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { fileStatus } from "@/lib/base/compute";
import { applyFilters, applySort, matchesSearch } from "@/lib/base/query";
import type { FilterRule, RecordRow, SortRule, TableBundle } from "@/lib/base/types";
import { getFile } from "./store";
import { createTestDb, makeCaller, makeUploader, USER_A } from "./testDb";

/**
 * Integration tests for: automatic Code sequences, Forms category, voucher PDFs (original + generated) and
 * server-side filtering. Needs DATABASE_URL (any PostgreSQL where CREATE DATABASE is allowed); skipped otherwise.
 */
const ADMIN_URL = process.env.DATABASE_URL;
const skip = !ADMIN_URL;

let db: Awaited<ReturnType<typeof createTestDb>>;
let call: ReturnType<typeof makeCaller>;
let upload: ReturnType<typeof makeUploader>;

const sha = (b: Uint8Array | Buffer) => createHash("sha256").update(b).digest("hex");
const bundle = async (t: string) => (await call("GET", `tables/${t}`)).json as TableBundle;
const SAMPLE = path.join(process.cwd(), "db/samples/Voucher-LLG-FD-15574.pdf");
const newAction = (extra: Record<string, unknown> = {}) => call("POST", "tables/actions/records", { accrue: "2026-11-01", title: "Seq test", type: "Notice", status: "Queue", ...extra });

describe("automatic codes, form categories, voucher PDFs and server filtering", { skip }, () => {
  before(async () => {
    db = await createTestDb(ADMIN_URL!);
    call = makeCaller(db.pool);
    upload = makeUploader(db.pool);
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

  describe("Forms: Work / Vouchers category", () => {
    it("existing forms were assigned Work; the field offers exactly Work and Vouchers", async () => {
      const b = await bundle("forms");
      const field = b.fields.find((f) => f.key === "category")!;
      assert.deepEqual(field.options.choices!.map((c) => c.name), ["Work", "Vouchers"]);
      assert.equal(field.required, true);
      assert.ok(b.records.length >= 13 && b.records.every((r) => r.category === "Work"));
    });

    it("a new form takes the chosen category, defaults to Work, rejects anything else, and can be changed", async () => {
      const base = { code: "ZZ", type: "Ticket", slug: "zz-form", title: "ZZ" };
      const v = await call("POST", "tables/forms/records", { ...base, code: "VF", category: "Vouchers" });
      assert.equal(v.json.category, "Vouchers");
      const w = await call("POST", "tables/forms/records", { ...base, code: "WF" });
      assert.equal(w.json.category, "Work", "no category sent: default");
      const bad = await call("POST", "tables/forms/records", { ...base, code: "BF", category: "Other" });
      assert.equal(bad.status, 422);
      const changed = await call("PATCH", `tables/forms/records/${w.json.id}`, { category: "Vouchers" });
      assert.equal(changed.json.category, "Vouchers");
      assert.equal((await call("PATCH", `tables/forms/records/${w.json.id}`, { category: "" })).status, 422, "required: it cannot be cleared");
    });

    it("category views organize forms, and new forms appear under the right one", async () => {
      const b = await bundle("forms");
      const keys = b.views.map((v) => v.config.key);
      for (const k of ["all", "work", "vouchers"]) assert.ok(keys.includes(k), k);
      const vouchersView = b.views.find((v) => v.config.key === "vouchers")!;
      assert.deepEqual(vouchersView.config.filters.map((f) => [f.field, f.op, f.value]), [["category", "is", "Vouchers"]]);
      const shown = applyFilters(b.records, vouchersView.config.filters, b.fields, b.linked).map((r) => r.code);
      assert.ok(shown.includes("VF") && shown.includes("WF"), "records switched to Vouchers show up there");
      assert.ok(!shown.includes("JC"));
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

  describe("Voucher PDFs", () => {
    it("the supplied sample is stored as the original of the sample voucher, byte for byte", async () => {
      const b = await bundle("vouchers");
      const v1 = b.records.find((r) => r.i === 11574)!;
      const att = (v1.pdf as Array<{ id: string; name: string; url: string; type: string }>)[0];
      assert.equal(att.name, "Voucher.pdf");
      const stored = await getFile(db.pool, att.id);
      const original = await fs.readFile(SAMPLE);
      assert.equal(sha(stored!.data), sha(original));
      assert.equal(v1.docType, "FD");
      assert.equal(fileStatus(v1.pdf, v1.generatedPdf), "Original uploaded");
    });

    it("uploads an original PDF to a voucher without one; asks before replacing it", async () => {
      const b = await bundle("vouchers");
      const v2 = b.records.find((r) => r.i === 11575)!;
      const pdf = await fs.readFile(SAMPLE);
      const ok = await upload(`tables/vouchers/records/${v2.id}/files/pdf`, { name: "scan-1.pdf", type: "application/pdf", bytes: pdf });
      assert.equal(ok.status, 201);
      const first = ok.json.pdf[0];
      assert.equal(first.name, "scan-1.pdf");
      const again = await upload(`tables/vouchers/records/${v2.id}/files/pdf`, { name: "scan-2.pdf", type: "application/pdf", bytes: pdf });
      assert.equal(again.status, 409);
      assert.equal(again.json.code, "original-exists");
      assert.equal(((await bundle("vouchers")).records.find((r) => r.id === v2.id)!.pdf as Array<{ id: string }>)[0].id, first.id, "the original was not replaced");
      const replaced = await upload(`tables/vouchers/records/${v2.id}/files/pdf`, { name: "scan-3.pdf", type: "application/pdf", bytes: pdf }, { replace: "true" });
      assert.equal(replaced.status, 201);
      assert.equal(replaced.json.pdf[0].name, "scan-3.pdf");
    });

    it("rejects non-PDFs, spoofed PDFs, wrong tables and unmanaged fields", async () => {
      const v2 = (await bundle("vouchers")).records.find((r) => r.i === 11575)!;
      const path2 = `tables/vouchers/records/${v2.id}/files/pdf`;
      assert.equal((await upload(path2, { name: "x.png", type: "image/png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]) }, { replace: "true" })).status, 415, "a PNG renamed to .pdf is not a PDF");
      assert.equal((await upload(path2, { name: "fake.pdf", type: "application/pdf", bytes: new TextEncoder().encode("<html>not a pdf</html>") }, { replace: "true" })).status, 415);
      assert.equal((await upload(`tables/vouchers/records/${v2.id}/files/qr`, { name: "a.pdf", type: "application/pdf", bytes: await fs.readFile(SAMPLE) })).status, 404, "only fields marked for uploads accept files");
      assert.equal((await upload(`tables/profiles/records/x/files/photo`, { name: "a.pdf", type: "application/pdf", bytes: await fs.readFile(SAMPLE) })).status, 404);
    });

    it("editing voucher details never touches the original PDF, and the PDF fields cannot be edited through the record form", async () => {
      const v1 = (await bundle("vouchers")).records.find((r) => r.i === 11574)!;
      const before = JSON.stringify(v1.pdf);
      const upd = await call("PATCH", `tables/vouchers/records/${v1.id}`, { tracking: "999", voucherNote: "edited", docStatus: "Issued" });
      assert.equal(upd.status, 200);
      assert.equal(JSON.stringify(upd.json.pdf), before);
      const hack = await call("PATCH", `tables/vouchers/records/${v1.id}`, { pdf: [] });
      assert.equal(hack.status, 422);
      assert.match(hack.json.fieldErrors.pdf, /dedicated upload action/);
      assert.equal((await call("PATCH", `tables/vouchers/records/${v1.id}`, { generatedPdf: [] })).status, 422);
      const created = await call("POST", "tables/vouchers/records", { docType: "FD", generatedPdf: [{ id: "x", name: "evil.pdf", url: "/api/files/x", type: "application/pdf" }] });
      assert.equal(created.status, 201);
      assert.deepEqual(created.json.generatedPdf, [], "a client cannot plant a generated document");
    });

    it("an original can be attached while creating a voucher, but only a real stored PDF is accepted", async () => {
      const file = await upload("files", { name: "new.pdf", type: "application/pdf", bytes: await fs.readFile(SAMPLE) });
      assert.equal(file.status, 201);
      const ok = await call("POST", "tables/vouchers/records", { docType: "FD", pdf: [{ id: file.json.id, name: "new.pdf", url: file.json.url, type: "application/pdf" }] });
      assert.equal(ok.status, 201);
      const bad = await call("POST", "tables/vouchers/records", { docType: "FD", pdf: [{ id: "doesnotexist", name: "x.pdf", url: "/api/files/doesnotexist", type: "application/pdf" }] });
      assert.equal(bad.status, 422);
    });

    it("generates a PDF from the saved data, keeps it separate from the original, and labels it as generated", async () => {
      const v1 = (await bundle("vouchers")).records.find((r) => r.i === 11574)!;
      const originalSha = sha((await getFile(db.pool, (v1.pdf as Array<{ id: string }>)[0].id))!.data);
      const gen = await call("POST", `tables/vouchers/records/${v1.id}/generate-pdf`);
      assert.equal(gen.status, 201);
      const g = gen.json.generatedPdf[0];
      assert.match(g.name, /^LLG-FD-15574 \(generated\)\.pdf$/);
      assert.equal(gen.json.pdf[0].id, (v1.pdf as Array<{ id: string }>)[0].id, "the original attachment is untouched");
      const stored = await getFile(db.pool, g.id);
      assert.equal(stored!.mime, "application/pdf");
      assert.notEqual(sha(stored!.data), originalSha, "the generated file is not a copy of the original");
      assert.equal(sha((await getFile(db.pool, (v1.pdf as Array<{ id: string }>)[0].id))!.data), originalSha, "original bytes unchanged");
      const parsed = await PDFDocument.load(stored!.data);
      assert.equal(parsed.getPageCount(), 1);
      assert.match(parsed.getTitle() ?? "", /generated/);
      assert.match(parsed.getSubject() ?? "", /Not an original/);
      assert.equal(fileStatus(gen.json.pdf, gen.json.generatedPdf), "Original uploaded", "an original always wins the status");
    });

    it("a voucher with only a generated PDF is reported as such, and the generated copy can be removed", async () => {
      const created = (await call("POST", "tables/vouchers/records", { docType: "BL", headline: "BILL OF LADING", accrualDate: "2026-10-01" })).json;
      const gen = await call("POST", `tables/vouchers/records/${created.id}/generate-pdf`);
      assert.equal(fileStatus(gen.json.pdf, gen.json.generatedPdf), "Generated only");
      const doc = await PDFDocument.load((await getFile(db.pool, gen.json.generatedPdf[0].id))!.data);
      assert.equal(doc.getPageCount(), 1);
      const removed = await call("DELETE", `tables/vouchers/records/${created.id}/generated-pdf`);
      assert.deepEqual(removed.json.generatedPdf, []);
      assert.equal(fileStatus(removed.json.pdf, removed.json.generatedPdf), "No PDF");
      assert.equal((await call("POST", "tables/vouchers/records/nope/generate-pdf")).status, 404);
      assert.equal((await call("POST", "tables/items/records/x/generate-pdf")).status, 404);
    });

    it("long manifests continue on extra pages instead of being cut off", async () => {
      const lines = Array.from({ length: 14 }, (_, i) => `I/T-${100 + i} | Title ${i} | Description ${i} | 7/13/2026 | 1085912${i}`).join("\n");
      const packs = Array.from({ length: 9 }, (_, i) => `I/T-${100 + i} | 80 Wipes/Bag | 1 Pallet | 24 | 1440 | DEST ${i} / Street ${i} / City, ST 1000${i}`).join("\n");
      const v = (await call("POST", "tables/vouchers/records", { docType: "FD", manifestLines: lines, packLines: packs })).json;
      const gen = await call("POST", `tables/vouchers/records/${v.id}/generate-pdf`);
      const doc = await PDFDocument.load((await getFile(db.pool, gen.json.generatedPdf[0].id))!.data);
      assert.ok(doc.getPageCount() >= 2, `expected continuation pages, got ${doc.getPageCount()}`);
    });

    it("text outside the font's alphabet cannot break generation", async () => {
      const v = (await call("POST", "tables/vouchers/records", { docType: "FD", deliverVia: "Transport 日本 ✓ — “quotes”", headline: "ÅÄÖ ñ" })).json;
      const gen = await call("POST", `tables/vouchers/records/${v.id}/generate-pdf`);
      assert.equal(gen.status, 201);
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
      await parity("vouchers", [rule("pdfStatus", "is", { value: "Original uploaded" })]);
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

  it("the migration reports no warnings on a fresh database and creates the code indexes", async () => {
    assert.deepEqual(db.report.warnings, []);
    const idx = await db.pool.query("SELECT indexname FROM pg_indexes WHERE indexname LIKE 'boss_seq_%' ORDER BY 1");
    assert.deepEqual(idx.rows.map((r) => r.indexname), ["boss_seq_actions_code", "boss_seq_leads_leadId", "boss_seq_transactions_trans"].map((s) => s.toLowerCase()));
    void USER_A;
  });
});
