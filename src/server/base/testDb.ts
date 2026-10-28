import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { seedDatabase } from "../../../scripts/seed-data";
import { handleApi, newSessionId } from "./api";
import { applyBaseMigrations } from "./migrate";

/** A throwaway PostgreSQL database (schema + seed + migrations) for integration tests, and a tiny API caller. */
export async function createTestDb(adminUrl: string) {
  const admin = new Pool({ connectionString: adminUrl });
  admin.on("error", () => undefined);
  const name = `boss_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  await admin.query(`CREATE DATABASE ${name}`);
  const u = new URL(adminUrl);
  u.pathname = `/${name}`;
  const pool = new Pool({ connectionString: u.toString() });
  pool.on("error", () => undefined);
  await pool.query(await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8"));
  const seeded = await seedDatabase(pool, { onlyWhenEmpty: true });
  const report = await applyBaseMigrations(pool, { freshSeed: seeded });
  return {
    pool,
    report,
    async drop() {
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS ${name}`);
      await admin.end();
    },
  };
}

export const USER_A = newSessionId();
export const USER_B = newSessionId();

export function makeCaller(pool: Pool) {
  return async function call(method: string, p: string, body?: unknown, userId: string | null = USER_A, headers: Record<string, string> = {}) {
    const url = `http://localhost/api/base/${p}`;
    const init: RequestInit = { method, headers: { "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers } };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await handleApi(pool, { method, segments: p.split("/").filter(Boolean), userId, request: new Request(url, init) });
    return { status: res.status, json: res.json as any, res };
  };
}

/** Multipart upload helper (the API reads `file` and optional `replace`). */
export function makeUploader(pool: Pool) {
  return async function upload(p: string, file: { name: string; type: string; bytes: Uint8Array }, extra: Record<string, string> = {}, userId: string | null = USER_A) {
    const form = new FormData();
    form.set("file", new File([file.bytes as BlobPart], file.name, { type: file.type }));
    for (const [k, v] of Object.entries(extra)) form.set(k, v);
    const req = new Request(`http://localhost/api/base/${p}`, { method: "POST", headers: { "sec-fetch-site": "same-origin" }, body: form });
    const res = await handleApi(pool, { method: "POST", segments: p.split("/").filter(Boolean), userId, request: req });
    return { status: res.status, json: res.json as any };
  };
}
