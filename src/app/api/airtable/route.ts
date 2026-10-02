import { NextResponse } from "next/server";
import { authorizeMutation } from "@/server/records";
import { listAirtableTables } from "@/server/airtable";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json({ tables: await listAirtableTables() });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}
