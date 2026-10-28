import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getFile } from "@/server/base/store";

export const dynamic = "force-dynamic";

/** Serves an uploaded attachment. Images render inline; everything else downloads. Never executable content. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let file;
  try {
    file = await getFile(requireDb(), id);
  } catch {
    return NextResponse.json({ error: "The database is not available." }, { status: 503 });
  }
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const inline = file.mime.startsWith("image/") || file.mime === "application/pdf";
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
