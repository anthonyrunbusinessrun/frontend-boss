import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!db) {
    return NextResponse.json({ ok: false, database: "not_configured" }, { status: 503 });
  }

  try {
    const mirror = await db.query<{ tables: number; records: number }>(
      `SELECT COUNT(*)::integer AS tables,
         COALESCE(SUM(record_count), 0)::integer AS records
       FROM airtable_tables`,
    );
    return NextResponse.json({
      ok: true,
      database: "connected",
      airtableMirror: mirror.rows[0],
    });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}
