import { NextResponse } from "next/server";
import { authorizeMutation, createRecord, getRecordSet, isDataSection } from "@/server/records";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ section: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { section } = await params;
  if (!isDataSection(section)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  try {
    return NextResponse.json(await getRecordSet(section));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Database error" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { section } = await params;
  if (!isDataSection(section)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const body = (await request.json()) as { groupId?: string; data?: { id?: string; [key: string]: unknown } };
  if (!body.groupId || !body.data?.id) {
    return NextResponse.json({ error: "groupId and data.id are required" }, { status: 400 });
  }

  try {
    return NextResponse.json(await createRecord(section, body.groupId, body.data as { id: string }), { status: 201 });
  } catch (error) {
    const status = error instanceof Error && "code" in error && error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: "Unable to create record" }, { status });
  }
}

