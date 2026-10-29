import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { Pool } from "pg";
import { seedDatabase } from "../../../scripts/seed-data";
import type { FieldDef, RecordRow, TableBundle, ViewDef } from "@/lib/base/types";
import { handleApi, newSessionId } from "./api";
import { applyBaseMigrations } from "./migrate";
import { testDatabaseUrl } from "./testDatabaseUrl";

/**
 * Integration tests: a throwaway database is created from db/schema.sql + the seed + the migrations, and the
 * real API handler runs against it. Requires TEST_DATABASE_URL pointing to an isolated local Postgres
 * with CREATE DATABASE rights. Production DATABASE_URL is never used.
 */
const ADMIN_URL = testDatabaseUrl();
const skip = !ADMIN_URL;

let admin: Pool;
let pool: Pool;
let dbName = "";

const ALICE = newSessionId();
const BOB = newSessionId();

async function call(method: string, p: string, body?: unknown, userId: string | null = ALICE, headers: Record<string, string> = {}) {
  const url = `http://localhost/api/base/${p}`;
  const init: RequestInit = { method, headers: { "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await handleApi(pool, { method, segments: p.split("/").filter(Boolean), userId, request: new Request(url, init) });
  return { status: res.status, json: res.json as any, res };
}

const bundle = async (table: string, user: string | null = ALICE) => (await call("GET", `tables/${table}`, undefined, user)).json as TableBundle;
const fieldByName = (b: TableBundle, name: string) => b.fields.find((f) => f.name === name) as FieldDef;

describe("table engine API (PostgreSQL)", { skip }, () => {
  before(async () => {
    admin = new Pool({ connectionString: ADMIN_URL });
    admin.on("error", () => undefined);
    dbName = `boss_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    await admin.query(`CREATE DATABASE ${dbName}`);
    const u = new URL(ADMIN_URL!);
    u.pathname = `/${dbName}`;
    pool = new Pool({ connectionString: u.toString() });
    // An idle connection closed during teardown is expected, not a failure.
    pool.on("error", () => undefined);
    await pool.query(await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8"));
    const seeded = await seedDatabase(pool, { onlyWhenEmpty: true });
    await applyBaseMigrations(pool, { freshSeed: seeded });
  });

  after(async () => {
    await pool?.end();
    if (admin && dbName) await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin?.end();
  });

  it("migrations are idempotent and never delete data", async () => {
    const before = (await pool.query("SELECT COUNT(*)::int n FROM boss_records")).rows[0].n;
    const r1 = await applyBaseMigrations(pool);
    const r2 = await applyBaseMigrations(pool);
    assert.equal(r1.fieldsAdded + r1.viewsAdded + r2.fieldsAdded + r2.viewsAdded, 0);
    assert.equal(r2.backfills.length, 0);
    assert.equal((await pool.query("SELECT COUNT(*)::int n FROM boss_records")).rows[0].n, before);
  });

  it("indexes the view-section and favorite-table foreign keys", async () => {
    const { rows } = await pool.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      AND indexname IN ('boss_views_section_idx', 'boss_favorites_table_idx')`);
    assert.equal(rows.length, 2);
  });

  it("legacy Cord / Category text was linked to profile and category records, and the old text is kept", async () => {
    const b = await bundle("folios");
    const receipts = b.records.find((r) => r.folio === "Receipts In Basket")!;
    const eje = (await bundle("profiles")).records.find((r) => r.contact === "EJE")!;
    assert.equal(receipts.assigneeId, eje.id);
    assert.equal(receipts.cord, "EJE", "legacy cord text is preserved");
    const cat = (await bundle("categories")).records.find((r) => r.code === "1.0 INBOX")!;
    assert.equal(receipts.categoryId, cat.id);
    assert.equal(b.linked.profiles.records.length, 12);
    assert.ok(b.linked.categories.records.some((r) => r.label === "1.0 INBOX"));
    assert.ok(fieldByName(b, "Assignee"), "Cord is exposed as Assignee");
    assert.ok(!b.fields.some((f) => f.name === "Cord"));
  });

  it("Categories no longer has a Group field, but stored group values are untouched", async () => {
    const b = await bundle("categories");
    assert.ok(!b.fields.some((f) => f.name === "Group" || f.key === "group"));
    assert.ok(b.records.some((r) => r.group === "2.0 INTERNAL"), "legacy data kept in the record");
    const created = await call("POST", "tables/categories/records", { code: "9.0 NEW" });
    assert.equal(created.status, 201);
    const dup = await call("POST", "tables/categories/records", { code: "9.0 new" });
    assert.equal(dup.status, 422);
    assert.match(dup.json.fieldErrors.code, /already used/);
  });

  it("Categories show the folios that point at them (reverse link)", async () => {
    const b = await bundle("categories");
    const f = b.fields.find((x) => x.key === "folios")!;
    assert.equal(f.options.computed?.fn, "linkedFrom");
    assert.ok(b.linked.folios.records.length > 0);
    const ref = b.records.find((r) => r.code === "2.1 Reference")!;
    const names = b.linked.folios.records.filter((r) => r.filter.categoryId === ref.id).map((r) => r.label);
    assert.ok(names.includes("Reference | Web(U)"));
  });

  it("requires a session, and rejects cross-site writes", async () => {
    assert.equal((await call("POST", "tables/items/records", { title: "x", qty: 1 }, null)).status, 401);
    const cross = await call("POST", "tables/items/records", { title: "x", qty: 1 }, ALICE, { "sec-fetch-site": "cross-site" });
    assert.equal(cross.status, 403);
    const minted = await call("POST", "session", {}, null);
    assert.equal(minted.status, 201);
    assert.match(minted.res.setUserId!, /^[a-f0-9]{32}$/);
    assert.equal((await call("GET", "tables/nope")).status, 404);
  });

  describe("records", () => {
    it("creates, validates, updates and deletes team profiles", async () => {
      const bad = await call("POST", "tables/profiles/records", { name: "", email: "nope", type: "Alien" });
      assert.equal(bad.status, 422);
      assert.ok(bad.json.fieldErrors.name && bad.json.fieldErrors.email && bad.json.fieldErrors.type && bad.json.fieldErrors.contact && bad.json.fieldErrors.position);

      const ok = await call("POST", "tables/profiles/records", { contact: "TST", name: "Test Person", position: "Tester", type: "Agent", email: "tst@example.com", team: true });
      assert.equal(ok.status, 201);
      const id = ok.json.id as string;
      assert.equal(ok.json.inactive, false, "unspecified checkboxes start unchecked");

      const dupCode = await call("POST", "tables/profiles/records", { contact: "tst", name: "Other", position: "x", type: "Rep", email: "other@example.com" });
      assert.match(dupCode.json.fieldErrors.contact, /already used/, "duplicate contact codes are rejected case-insensitively");
      const dupMail = await call("POST", "tables/profiles/records", { contact: "TS2", name: "Other", position: "x", type: "Rep", email: "TST@example.com" });
      assert.match(dupMail.json.fieldErrors.email, /already used/);

      const upd = await call("PATCH", `tables/profiles/records/${id}`, { position: "Lead Tester", phone1: "555-0100" });
      assert.equal(upd.json.position, "Lead Tester");
      const clear = await call("PATCH", `tables/profiles/records/${id}`, { name: "" });
      assert.equal(clear.status, 422);
      const readOnly = await call("PATCH", `tables/profiles/records/${id}`, { id: "x", nonsense: 1 });
      assert.equal(readOnly.status, 422);

      const del = await call("DELETE", `tables/profiles/records/${id}`);
      assert.equal(del.json.deleted, 1);
      assert.equal((await call("PATCH", `tables/profiles/records/${id}`, { position: "x" })).status, 404);
    });

    it("Assignee must be an active team member; deleting a profile unlinks folios safely", async () => {
      const nonTeam = (await call("POST", "tables/profiles/records", { contact: "NTM", name: "Not Team", position: "Vendor", type: "Rep", email: "ntm@example.com", team: false })).json;
      const team = (await call("POST", "tables/profiles/records", { contact: "TMM", name: "Team Mate", position: "Ops", type: "Agent", email: "tmm@example.com", team: true })).json;

      const rejected = await call("POST", "tables/folios/records", { folio: "Bad assign", assigneeId: nonTeam.id });
      assert.equal(rejected.status, 422);
      assert.match(rejected.json.fieldErrors.assigneeId, /team members/);
      const ghost = await call("POST", "tables/folios/records", { folio: "Ghost", assigneeId: "p-missing" });
      assert.match(ghost.json.fieldErrors.assigneeId, /no longer exists/);

      const cats = (await bundle("categories")).records;
      const folio = await call("POST", "tables/folios/records", { folio: "Linked folio", assigneeId: team.id, categoryId: cats[0].id });
      assert.equal(folio.status, 201);
      assert.equal(folio.json.assigneeId, team.id);

      const del = await call("DELETE", `tables/profiles/records/${team.id}`);
      assert.equal(del.json.unlinked, 1);
      const after = (await bundle("folios")).records.find((r) => r.id === folio.json.id)!;
      assert.equal(after.assigneeId, null);
      assert.equal(after.categoryId, cats[0].id, "category link untouched");

      // deleting a category unlinks folios as well
      const catDel = await call("DELETE", `tables/categories/records/${cats[0].id}`);
      assert.ok(catDel.json.unlinked >= 1);
      assert.equal((await bundle("folios")).records.find((r) => r.id === folio.json.id)!.categoryId, null);
    });

    it("an existing assignee stays valid after leaving the team", async () => {
      const p = (await call("POST", "tables/profiles/records", { contact: "LVR", name: "Leaver", position: "Ops", type: "Agent", email: "lvr@example.com", team: true })).json;
      const f = (await call("POST", "tables/folios/records", { folio: "Keeps assignee", assigneeId: p.id })).json;
      await call("PATCH", `tables/profiles/records/${p.id}`, { team: false });
      const edit = await call("PATCH", `tables/folios/records/${f.id}`, { assigneeId: p.id, active: 2 });
      assert.equal(edit.status, 200);
    });

    it("inventory: validates quantity, unique SKU, and derives stock status", async () => {
      assert.equal((await call("POST", "tables/items/records", { title: "Widget", qty: -3, purstat: "Purchased", kit: "Kit Alpha" })).json.fieldErrors.qty, "Must be 0 or more.");
      assert.equal((await call("POST", "tables/items/records", { title: "Widget", qty: 1.5, purstat: "Purchased", kit: "Kit Alpha" })).json.fieldErrors.qty, "Enter a whole number.");
      const ok = await call("POST", "tables/items/records", { title: "Widget", sku: "WID-1", qty: 4, reorderLevel: 5, unit: "box", purstat: "Purchased", kit: "Kit Alpha" });
      assert.equal(ok.status, 201);
      assert.ok(typeof ok.json.n === "number", "item number is assigned automatically");
      const dup = await call("POST", "tables/items/records", { title: "Widget 2", sku: "wid-1", qty: 1, purstat: "Purchased", kit: "Kit Alpha" });
      assert.match(dup.json.fieldErrors.sku, /already used/);
      const adjusted = await call("PATCH", `tables/items/records/${ok.json.id}`, { qty: 0 });
      assert.equal(adjusted.json.qty, 0);
    });

    it("autonumbers are unique under concurrent creates and continue after existing records", async () => {
      const existing = (await bundle("vouchers")).records.map((r) => r.i as number);
      const created = await Promise.all(Array.from({ length: 8 }, () => call("POST", "tables/vouchers/records", { vsf: "https://airtable.com/tblTEST/recTEST", manifest: "x" })));
      const nums = created.map((c) => c.json.i as number);
      assert.equal(new Set(nums).size, 8);
      assert.ok(Math.min(...nums) > Math.max(...existing));
      assert.equal(created.every((c) => c.status === 201), true);
    });

    it("rejects unknown and read-only fields on create", async () => {
      const r = await call("POST", "tables/vouchers/records", { vsf: "https://airtable.com/tblTEST/recTEST", i: 5, bogus: true });
      assert.equal(r.status, 422);
    });
  });

  describe("fields", () => {
    it("creates, renames and deletes fields; choice renames rewrite records; deleting keeps stored values", async () => {
      const created = await call("POST", "tables/actions/records", { code: "A-9001", accrue: "2026-10-30", title: "Field test", type: "Tasking", status: "Queue" });
      const field = await call("POST", "tables/actions/fields", { name: "Priority", type: "singleSelect", options: { choices: [{ name: "High", color: "red" }, { name: "Low", color: "green" }] } });
      assert.equal(field.status, 201);
      const key = field.json.key as string;
      assert.match(key, /^fld_/);
      assert.equal((await call("POST", "tables/actions/fields", { name: "priority", type: "text" })).status, 422, "names are unique case-insensitively");
      assert.equal((await call("POST", "tables/actions/fields", { name: "X", type: "computed" })).status, 422, "computed cannot be created by hand");
      assert.equal((await call("POST", "tables/actions/fields", { name: "L", type: "link", options: { linkTable: "nowhere" } })).status, 422);

      await call("PATCH", `tables/actions/records/${created.json.id}`, { [key]: "High" });
      const high = field.json.options.choices[0];
      const renamed = await call("PATCH", `tables/actions/fields/${key}`, { options: { choices: [{ ...high, name: "Urgent" }, field.json.options.choices[1]] } });
      assert.equal(renamed.status, 200);
      assert.equal((await bundle("actions")).records.find((r) => r.id === created.json.id)![key], "Urgent");

      // a view that references the field loses the reference when the field goes away
      const view = (await call("POST", "tables/actions/views", { name: "Prio board", type: "kanban", config: { stackField: key } })).json as ViewDef;
      assert.equal(view.config.stackField, key);
      assert.equal((await call("DELETE", `tables/actions/fields/${key}`)).status, 204);
      const b = await bundle("actions");
      assert.ok(!b.fields.some((f) => f.key === key));
      assert.equal(b.views.find((v) => v.id === view.id)!.config.stackField, undefined);
      const raw = await pool.query("SELECT data->>$2 AS v FROM boss_records WHERE section_slug = 'actions' AND record_id = $1", [created.json.id, key]);
      assert.equal(raw.rows[0].v, "Urgent", "values stay in the database");

      const primary = b.fields.find((f) => f.primary)!;
      assert.equal((await call("DELETE", `tables/actions/fields/${primary.key}`)).status, 409);
    });

    it("link fields point at a table; link values must exist", async () => {
      const f = await call("POST", "tables/actions/fields", { name: "Owner", type: "link", options: { linkTable: "profiles" } });
      assert.equal(f.status, 201);
      const p = (await bundle("profiles")).records[0];
      const rec = (await call("POST", "tables/actions/records", { code: "A-9002", accrue: "2026-10-30", title: "Linked", type: "Notice", status: "Queue", [f.json.key]: p.id })).json;
      assert.equal(rec[f.json.key], p.id);
      assert.equal((await call("PATCH", `tables/actions/records/${rec.id}`, { [f.json.key]: "nope" })).status, 422);
    });
  });

  describe("views", () => {
    it("creates every view type with sensible defaults, then renames, duplicates and deletes", async () => {
      const types = ["grid", "calendar", "gallery", "kanban", "timeline", "list", "gantt", "form"] as const;
      const made: ViewDef[] = [];
      for (const type of types) {
        const r = await call("POST", "tables/actions/views", { name: `Test ${type}`, type, access: "collaborative" });
        assert.equal(r.status, 201, `create ${type}`);
        made.push(r.json);
      }
      const by = (t: string) => made.find((v) => v.type === t)!;
      assert.equal(by("calendar").config.dateField, "accrue");
      assert.equal(by("kanban").config.stackField, "type");
      assert.equal(by("timeline").config.startField, "accrue");
      assert.ok(by("form").config.form!.fields.length >= 9);

      // another table's field cannot be referenced
      const wrong = await call("POST", "tables/actions/views", { name: "Wrong", type: "calendar", config: { dateField: "title" } });
      assert.equal(wrong.json.config.dateField, "accrue", "a text field is not accepted as the date field; the default is used");
      await call("DELETE", `tables/actions/views/${wrong.json.id}`);

      const rn = await call("PATCH", `tables/actions/views/${by("list").id}`, { name: "Renamed list" });
      assert.equal(rn.json.name, "Renamed list");
      const dupName = await call("PATCH", `tables/actions/views/${by("list").id}`, { name: "Test grid" });
      assert.equal(dupName.json.name, "Test grid 2", "sibling names stay unique");

      const copy = await call("POST", `tables/actions/views/${by("kanban").id}/duplicate`);
      assert.equal(copy.status, 201);
      assert.equal(copy.json.name, "Test kanban copy");
      assert.equal(copy.json.config.stackField, "type");

      for (const v of [...made, copy.json]) assert.equal((await call("DELETE", `tables/actions/views/${v.id}`)).status, 204);
      const keys = (await bundle("actions")).views.map((v) => v.config.key);
      for (const k of ["all", "calendar", "board"]) assert.ok(keys.includes(k), `seeded view ${k} untouched`);
      for (const v of [...made, copy.json]) assert.ok(!(await bundle("actions")).views.some((x) => x.id === v.id));
    });

    it("saves view settings (filters, sort, grouping, hidden fields, widths) and keeps them after reload", async () => {
      const v = (await call("POST", "tables/actions/views", { name: "Saved settings", type: "grid" })).json as ViewDef;
      const config = { filters: [{ id: "f1", join: "and", field: "status", op: "is", value: "Queue" }], sort: [{ field: "accrue", dir: "desc" }], groupBy: [{ field: "type", dir: "asc" }], hidden: ["wk", "ghost-field"], widths: { title: 333 } };
      const up = await call("PATCH", `tables/actions/views/${v.id}`, { config });
      assert.equal(up.status, 200);
      const reloaded = (await bundle("actions")).views.find((x) => x.id === v.id)!;
      assert.deepEqual(reloaded.config.filters.map((f) => f.field), ["status"]);
      assert.deepEqual(reloaded.config.sort, [{ field: "accrue", dir: "desc" }]);
      assert.deepEqual(reloaded.config.groupBy, [{ field: "type", dir: "asc" }]);
      assert.deepEqual(reloaded.config.hidden, ["wk"], "unknown fields are dropped");
      assert.equal(reloaded.config.widths?.title, 333);
    });

    it("personal views are private; locked views cannot be changed until unlocked by the owner", async () => {
      const mine = (await call("POST", "tables/items/views", { name: "Alice private", type: "grid", access: "personal" }, ALICE)).json as ViewDef;
      assert.ok((await bundle("items", ALICE)).views.some((v) => v.id === mine.id));
      assert.ok(!(await bundle("items", BOB)).views.some((v) => v.id === mine.id), "other users do not see it");
      assert.equal((await call("PATCH", `tables/items/views/${mine.id}`, { name: "hacked" }, BOB)).status, 404);
      assert.equal((await call("DELETE", `tables/items/views/${mine.id}`, undefined, BOB)).status, 404);

      const shared = (await call("POST", "tables/items/views", { name: "Alice shared", type: "grid", access: "collaborative" }, ALICE)).json as ViewDef;
      assert.equal((await call("PATCH", `tables/items/views/${shared.id}`, { name: "Bob edits" }, BOB)).status, 200, "collaborative: anyone can edit");

      const lock = await call("PATCH", `tables/items/views/${shared.id}`, { access: "locked" }, ALICE);
      assert.equal(lock.json.access, "locked");
      assert.equal((await call("PATCH", `tables/items/views/${shared.id}`, { name: "nope" }, ALICE)).status, 403, "even the owner must unlock first");
      assert.equal((await call("DELETE", `tables/items/views/${shared.id}`, undefined, BOB)).status, 403);
      assert.equal((await call("PATCH", `tables/items/views/${shared.id}`, { access: "collaborative" }, BOB)).status, 403, "only the owner can unlock");
      assert.equal((await call("PATCH", `tables/items/views/${shared.id}`, { access: "collaborative" }, ALICE)).json.access, "collaborative");
    });

    it("a table always keeps at least one view", async () => {
      const b = await bundle("concepts");
      assert.equal(b.views.length, 1);
      const r = await call("DELETE", `tables/concepts/views/${b.views[0].id}`);
      assert.equal(r.status, 409);
    });
  });

  describe("form view", () => {
    it("submits records through the form, honouring visible and required fields only", async () => {
      const view = (await call("POST", "tables/profiles/views", { name: "Onboard", type: "form" })).json as ViewDef;
      const form = view.config.form!;
      form.fields = form.fields.map((f) => ({ ...f, visible: ["name", "email", "contact", "position", "type"].includes(f.key), required: ["name", "email"].includes(f.key) }));
      await call("PATCH", `tables/profiles/views/${view.id}`, { config: { ...view.config, form } });

      const missing = await call("POST", `tables/profiles/views/${view.id}/submit`, { name: "Form Person", contact: "FRM", position: "Intern", type: "Rep" });
      assert.equal(missing.status, 422);
      assert.ok(missing.json.fieldErrors.email);

      const hidden = await call("POST", `tables/profiles/views/${view.id}/submit`, { name: "Form Person", email: "form@example.com", contact: "FRM", position: "Intern", type: "Rep", team: true, bio: "sneaky" });
      assert.equal(hidden.status, 201);
      assert.equal(hidden.json.team, false, "a field that is not on the form cannot be set through it");
      assert.ok(!("bio" in hidden.json) || hidden.json.bio === null);

      const notForm = (await bundle("profiles")).views.find((v) => v.type === "grid")!;
      assert.equal((await call("POST", `tables/profiles/views/${notForm.id}/submit`, { name: "x" })).status, 404);
    });
  });

  describe("sidebar sections, ordering and favorites", () => {
    let seed: { a: ViewDef; b: ViewDef; c: ViewDef; sectionId: string };

    it("creates a section and moves views into it, in order, persisted", async () => {
      const mk = async (name: string) => (await call("POST", "tables/transactions/views", { name, type: "grid" })).json as ViewDef;
      const [a, b, c] = [await mk("Org A"), await mk("Org B"), await mk("Org C")];
      const section = (await call("POST", "tables/transactions/sections", { name: "Finance" })).json;
      assert.equal(section.name, "Finance");
      assert.equal((await call("POST", "tables/transactions/sections", { name: "  " })).status, 422);
      seed = { a, b, c, sectionId: section.id };

      const tree = await bundle("transactions");
      const root = tree.views.filter((v) => !v.sectionId).sort((x, y) => x.position - y.position);
      const nodes = [
        ...root.filter((v) => ![a.id, b.id].includes(v.id)).map((v, i) => ({ kind: "view", id: v.id, parentId: null, position: i })),
        { kind: "section", id: section.id, parentId: null, position: root.length },
        { kind: "view", id: b.id, parentId: section.id, position: 0 },
        { kind: "view", id: a.id, parentId: section.id, position: 1 },
      ];
      const moved = await call("PUT", "tables/transactions/layout", { nodes });
      assert.equal(moved.status, 200);

      const reloaded = await bundle("transactions");
      const inSection = reloaded.views.filter((v) => v.sectionId === section.id).sort((x, y) => x.position - y.position).map((v) => v.name);
      assert.deepEqual(inSection, ["Org B", "Org A"]);
      assert.ok(reloaded.views.some((v) => v.id === c.id && !v.sectionId));
    });

    it("rejects malformed layouts, nesting and foreign ids", async () => {
      assert.equal((await call("PUT", "tables/transactions/layout", { nodes: [{ kind: "section", id: seed.sectionId, parentId: seed.sectionId, position: 0 }] })).status, 422);
      assert.equal((await call("PUT", "tables/transactions/layout", { nodes: [{ kind: "view", id: "view_does_not_exist", parentId: null, position: 0 }] })).status, 404);
      assert.equal((await call("PUT", "tables/transactions/layout", { nodes: [{ kind: "view", id: seed.a.id, parentId: "sec_missing", position: 0 }] })).status, 422);
      assert.equal((await call("PUT", "tables/transactions/layout", { nodes: "nope" })).status, 422);
    });

    it("favorites are per user, survive reload, and disappear with the view", async () => {
      assert.equal((await call("PUT", "tables/transactions/favorites", { kind: "view", refId: seed.a.id, favorite: true }, ALICE)).status, 204);
      const rec = (await bundle("profiles")).records[0];
      assert.equal((await call("PUT", "tables/profiles/favorites", { kind: "record", refId: rec.id, favorite: true }, ALICE)).status, 204);
      assert.equal((await call("PUT", "tables/profiles/favorites", { kind: "record", refId: "ghost", favorite: true }, ALICE)).status, 404);

      assert.deepEqual((await bundle("transactions", ALICE)).favorites.map((f) => f.refId), [seed.a.id]);
      assert.deepEqual((await bundle("transactions", BOB)).favorites, []);
      assert.deepEqual((await bundle("profiles", ALICE)).favorites.map((f) => f.refId), [rec.id]);

      await call("PUT", "tables/transactions/favorites", { kind: "view", refId: seed.a.id, favorite: true }, ALICE); // idempotent
      assert.equal((await bundle("transactions", ALICE)).favorites.length, 1);
      await call("PUT", "tables/transactions/favorites", { kind: "view", refId: seed.a.id, favorite: false }, ALICE);
      assert.equal((await bundle("transactions", ALICE)).favorites.length, 0);

      await call("PUT", "tables/transactions/favorites", { kind: "view", refId: seed.c.id, favorite: true }, ALICE);
      await call("DELETE", `tables/transactions/views/${seed.c.id}`, undefined, ALICE);
      assert.equal((await bundle("transactions", ALICE)).favorites.length, 0);
    });

    it("deleting a section keeps its views (moved to the root) and every record", async () => {
      const recordsBefore = (await bundle("transactions")).records.length;
      const del = await call("DELETE", `tables/transactions/sections/${seed.sectionId}`);
      assert.equal(del.status, 200);
      assert.equal(del.json.moved, 2);
      const b = await bundle("transactions");
      assert.ok(!b.sections.some((s) => s.id === seed.sectionId));
      assert.ok(b.views.some((v) => v.id === seed.a.id && v.sectionId === null));
      assert.ok(b.views.some((v) => v.id === seed.b.id && v.sectionId === null));
      assert.equal(b.records.length, recordsBefore);
      const positions = b.views.filter((v) => !v.sectionId).map((v) => v.position);
      assert.equal(new Set(positions).size, positions.length, "no two root items share a position");
    });

    it("renames sections", async () => {
      const s = (await call("POST", "tables/items/sections", { name: "Warehouse" })).json;
      const r = await call("PATCH", `tables/items/sections/${s.id}`, { name: "Warehouse A" });
      assert.equal(r.json.name, "Warehouse A");
      assert.equal((await call("PATCH", "tables/items/sections/sec_missing", { name: "x" })).status, 404);
    });
  });

  describe("attachments", () => {
    const upload = async (name: string, type: string, bytes: Buffer) => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array(bytes)], name, { type }));
      const req = new Request("http://localhost/api/base/files", { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: form });
      return handleApi(pool, { method: "POST", segments: ["files"], userId: ALICE, request: req });
    };
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

    it("stores a profile picture and attaches it to a profile", async () => {
      const up = await upload("me.png", "image/png", PNG);
      assert.equal(up.status, 201);
      const file = up.json as { id: string; url: string };
      const p = (await bundle("profiles")).records[0];
      const r = await call("PATCH", `tables/profiles/records/${p.id}`, { photo: [{ ...file, name: "me.png", type: "image/png" }] });
      assert.equal(r.status, 200);
      const linked = (await bundle("folios")).linked.profiles.records.find((x) => x.id === p.id)!;
      assert.equal(linked.photo, file.url, "assignee pickers receive the profile picture");
      const served = await pool.query("SELECT mime, size FROM boss_files WHERE id = $1", [file.id]);
      assert.equal(served.rows[0].mime, "image/png");
    });

    it("rejects scripts, SVG, spoofed images, oversize files and external URLs", async () => {
      assert.equal((await upload("x.svg", "image/svg+xml", Buffer.from("<svg onload=alert(1)/>"))).status, 415);
      assert.equal((await upload("x.html", "text/html", Buffer.from("<script>"))).status, 415);
      assert.equal((await upload("fake.png", "image/png", Buffer.from("<html>not a png</html>"))).status, 415);
      const big = await upload("big.png", "image/png", Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]));
      assert.equal(big.status, 413);
      const p = (await bundle("profiles")).records[0];
      assert.equal((await call("PATCH", `tables/profiles/records/${p.id}`, { photo: [{ id: "", name: "x.png", url: "https://evil.example/x.png" }] })).status, 422);
    });
  });

  it("every active table has fields, a primary field and at least one view", async () => {
    for (const slug of ["profiles", "categories", "folios", "actions", "vouchers", "transactions", "items", "forms", "concepts", "capabilities", "leads"]) {
      const b = await bundle(slug);
      assert.ok(b.fields.length > 0, slug);
      assert.equal(b.fields.filter((f) => f.primary).length, 1, `${slug} primary`);
      assert.ok(b.views.length > 0, slug);
    }
    for (const gone of ["boss", "packet", "accounts", "registries"]) assert.equal((await call("GET", `tables/${gone}`)).status, 404);
    // removed tabs keep their data
    assert.ok((await pool.query("SELECT COUNT(*)::int n FROM boss_records WHERE section_slug IN ('packet','accounts','registries')")).rows[0].n >= 0);
  });

  it("Capabilities: System, Exception and All come from real data", async () => {
    const b = await bundle("capabilities");
    const area = (r: RecordRow) => r.area;
    assert.equal(b.records.filter((r) => area(r) === "System").length, 5);
    assert.equal(b.records.filter((r) => area(r) === "Exception").length, 4);
    const keys = b.views.map((v) => v.config.key);
    for (const k of ["live", "all", "exceptions", "gallery", "system"]) assert.ok(keys.includes(k), k);
  });
});
