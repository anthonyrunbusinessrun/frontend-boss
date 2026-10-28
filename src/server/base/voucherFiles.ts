import type { Pool } from "pg";
import { attachmentFromRow, readAttachments } from "@/lib/base/fields";
import { voucherNumber } from "@/lib/base/voucher";
import type { FieldDef, RecordRow } from "@/lib/base/types";
import { ApiError, loadFields, saveFile } from "./store";
import { generateVoucherPdf } from "./voucherPdf";

/**
 * Original and generated PDF documents of vouchers.
 *  - An original is exactly the file a person uploaded. It is stored byte for byte and only ever replaced when the
 *    caller says so explicitly; editing voucher fields never touches it.
 *  - A generated PDF is built from the saved fields, stored in its own field and labelled as generated.
 */

async function withRecord<T>(pool: Pool, slug: string, id: string, run: (record: RecordRow, fields: FieldDef[], client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`boss-table:${slug}`]);
    const found = await client.query<{ data: RecordRow }>("SELECT data FROM boss_records WHERE section_slug = $1 AND record_id = $2 FOR UPDATE", [slug, id]);
    if (!found.rowCount) throw new ApiError(404, "Record not found.");
    const out = await run(found.rows[0].data, await loadFields(client, slug), client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Attach an uploaded PDF to a record's "upload"-managed field (the original voucher PDF). */
export async function attachOriginalPdf(pool: Pool, slug: string, id: string, key: string, file: { name: string; bytes: Buffer }, replace: boolean, userId: string | null): Promise<RecordRow> {
  if (slug !== "vouchers") throw new ApiError(404, "Not found");
  // validate and store the bytes first: a bad upload must not touch the record
  const stored = await saveFile(pool, { name: file.name, mime: "application/pdf", bytes: file.bytes }, userId);
  return withRecord(pool, slug, id, async (record, fields, c) => {
    const field = fields.find((f) => f.key === key);
    if (!field || field.options.managed !== "upload") throw new ApiError(404, "That field does not take uploads.");
    const had = readAttachments(record[key]);
    if (had.length > 0 && !replace) {
      throw new ApiError(409, "This voucher already has an original PDF. Replacing it must be confirmed.", { code: "original-exists", existing: had[0].name });
    }
    const res = await c.query<{ data: RecordRow }>("UPDATE boss_records SET data = data || jsonb_build_object($3::text, $4::jsonb), updated_at = NOW() WHERE section_slug = $1 AND record_id = $2 RETURNING data", [
      slug,
      id,
      key,
      JSON.stringify([attachmentFromRow(stored)]),
    ]);
    return res.rows[0].data;
  });
}

/** Build a PDF from the saved voucher and keep it in the "Generated PDF" field. The original, if any, is untouched. */
export async function generateVoucher(pool: Pool, id: string, origin: string, userId: string | null): Promise<RecordRow> {
  const record = await withRecord(pool, "vouchers", id, async (r) => r);
  const number = voucherNumber(record);
  if (!number) throw new ApiError(422, "This voucher has no number yet.");
  const bytes = Buffer.from(await generateVoucherPdf(record, { origin }));
  const stored = await saveFile(pool, { name: `${number} (generated).pdf`, mime: "application/pdf", bytes }, userId);
  return withRecord(pool, "vouchers", id, async (_r, fields, c) => {
    if (!fields.some((f) => f.key === "generatedPdf")) throw new ApiError(500, "The Generated PDF field is missing. Run the database migration.");
    const res = await c.query<{ data: RecordRow }>("UPDATE boss_records SET data = data || jsonb_build_object('generatedPdf', $2::jsonb), updated_at = NOW() WHERE section_slug = 'vouchers' AND record_id = $1 RETURNING data", [id, JSON.stringify([attachmentFromRow(stored)])]);
    return res.rows[0].data;
  });
}

export async function removeGeneratedPdf(pool: Pool, id: string): Promise<RecordRow> {
  return withRecord(pool, "vouchers", id, async (_r, _f, c) => {
    const res = await c.query<{ data: RecordRow }>("UPDATE boss_records SET data = data || '{\"generatedPdf\": []}'::jsonb, updated_at = NOW() WHERE section_slug = 'vouchers' AND record_id = $1 RETURNING data", [id]);
    return res.rows[0].data;
  });
}
