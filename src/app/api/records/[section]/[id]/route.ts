import { NextResponse } from "next/server";
import { authorizeMutation, deleteRecord, isDataSection, updateRecord } from "@/server/records";

type RouteContext = { params: Promise<{ section: string; id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { section, id } = await params;
  if (!isDataSection(section)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  const patch = (await request.json()) as Record<string, unknown>;
  const updated = await updateRecord(section, id, patch);
  return updated
    ? NextResponse.json(updated)
    : NextResponse.json({ error: "Record not found" }, { status: 404 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  if (!authorizeMutation(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { section, id } = await params;
  if (!isDataSection(section)) return NextResponse.json({ error: "Unknown section" }, { status: 404 });

  return (await deleteRecord(section, id))
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: "Record not found" }, { status: 404 });
}

