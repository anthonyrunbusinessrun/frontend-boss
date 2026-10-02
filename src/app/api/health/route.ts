import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!db) {
    return NextResponse.json({ ok: false, database: "not_configured" }, { status: 503 });
  }

  try {
    await db.query("SELECT 1");
    return NextResponse.json({ ok: true, database: "connected" });
  } catch {
    return NextResponse.json({ ok: false, database: "unavailable" }, { status: 503 });
  }
}

