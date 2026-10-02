import { NextResponse } from "next/server";
import { authorizeMutation } from "@/server/records";
import { getAirtableTable, replaceAirtableTable, validateAirtableImport } from "@/server/airtable";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ table: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { table } = await params;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 1_000);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  try {
    const result = await getAirtableTable(table, limit, offset);
    return result
      ? NextResponse.json(result)
      : NextResponse.json({ error: "Unknown Airtable table" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { table } = await params;
  const body: unknown = await request.json();
  if (!validateAirtableImport(body) || body.slug !== table) {
    return NextResponse.json({ error: "Invalid Airtable import payload" }, { status: 400 });
  }

  try {
    return NextResponse.json(await replaceAirtableTable(body));
  } catch {
    return NextResponse.json({ error: "Unable to import Airtable table" }, { status: 500 });
  }
}
