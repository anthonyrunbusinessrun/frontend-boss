import { NextResponse } from "next/server";
import { requireDb } from "@/lib/db";
import { getFile } from "@/server/base/store";

export const dynamic = "force-dynamic";

/** Serves an uploaded attachment. Images render inline; everything else downloads. Never executable content. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let file;
  try {
    file = await getFile(requireDb(), id);
  } catch {
    return NextResponse.json({ error: "The database is not available." }, { status: 503 });
  }
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const isPdf = file.mime === "application/pdf";
  const inline = !download && (file.mime.startsWith("image/") || isPdf);
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "X-Content-Type-Options": "nosniff",
      // A PDF has to be allowed to render in the browser's viewer (and in our own preview frame), so it cannot use "sandbox".
      "Content-Security-Policy": isPdf ? "frame-ancestors 'self'" : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
