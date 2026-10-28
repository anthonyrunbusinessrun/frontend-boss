import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";
import type { RecordRow } from "@/lib/base/types";
import { MANIFEST_COLUMNS, PACK_COLUMNS, VOUCHER_LETTERHEAD, VOUCHER_TYPES, docTypeOf, formatVoucherDate, parseRows, voucherNumber } from "@/lib/base/voucher";

/**
 * Builds a voucher PDF from a saved voucher record. The layout follows the supplied sample (a single portrait page with
 * a left column of boxes and a right panel with the letterhead, parties and two tables). All coordinates below are in
 * the sample's own pixel grid (884 x 1162) and are scaled to the page, so the proportions match the reference.
 *
 * The result is a *generated* document: a footer line says so, and the app stores it separately from any original
 * upload. Nothing here ever reads or changes an uploaded original.
 */

const W = 884;
const H = 1162;
const PAGE_W = 612;
const S = PAGE_W / W;
const PAGE_H = H * S;

const INK = rgb(0.07, 0.08, 0.1);
const NAVY = rgb(0.137, 0.169, 0.22);
const BLUE = rgb(0.16, 0.27, 0.44);
const RED = rgb(0.7, 0.09, 0.17);
const GRAY = rgb(0.42, 0.45, 0.5);
const WHITE = rgb(1, 1, 1);

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontBytes: Promise<{ regular: Buffer; bold: Buffer; heavy: Buffer }> | null = null;
function loadFonts() {
  fontBytes ??= Promise.all(["400", "700", "800"].map((w) => fs.readFile(path.join(FONT_DIR, `saira-semi-condensed-latin-${w}-normal.woff`)))).then(([regular, bold, heavy]) => ({ regular, bold, heavy }));
  return fontBytes;
}

/** The embedded font covers Latin text; anything else is replaced so a stray character can never break generation. */
const safe = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\u0009\u000A\u0020-\u007E\u00A0-\u017F\u2022\u00B7]/g, "?");

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  heavy: PDFFont;
}

const X = (x: number) => x * S;
const Y = (y: number) => PAGE_H - y * S;

function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, w = 1.5, color: RGB = INK) {
  c.page.drawLine({ start: { x: X(x1), y: Y(y1) }, end: { x: X(x2), y: Y(y2) }, thickness: w * S, color });
}

function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, opts: { stroke?: number; fill?: RGB; color?: RGB } = {}) {
  const path = `M ${r},0 H ${w - r} Q ${w},0 ${w},${r} V ${h - r} Q ${w},${h} ${w - r},${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 Z`;
  c.page.drawSvgPath(path, {
    x: X(x),
    y: Y(y),
    scale: S,
    ...(opts.fill ? { color: opts.fill } : {}),
    ...(opts.stroke ? { borderWidth: opts.stroke * S, borderColor: opts.color ?? INK } : {}),
  });
}

function textWidth(font: PDFFont, s: string, size: number) {
  return font.widthOfTextAtSize(s, size * S);
}

interface TextOpts {
  size: number;
  font?: PDFFont;
  color?: RGB;
  align?: "left" | "right" | "center";
  /** shrink the text until it fits this width (in grid units) */
  maxWidth?: number;
  skew?: number;
}

function text(c: Ctx, s: string, x: number, baseline: number, o: TextOpts) {
  const str = safe(s);
  if (!str) return;
  const font = o.font ?? c.regular;
  let size = o.size;
  if (o.maxWidth) while (size > 5 && textWidth(font, str, size) > o.maxWidth * S) size -= 0.5;
  const w = textWidth(font, str, size);
  const px = o.align === "right" ? X(x) - w : o.align === "center" ? X(x) - w / 2 : X(x);
  c.page.drawText(str, { x: px, y: Y(baseline), size: size * S, font, color: o.color ?? INK, ...(o.skew ? { ySkew: degrees(o.skew) } : {}) });
}

/** Word-wraps `s` to `width` (grid units); explicit newlines are kept. Returns the lines. */
function wrap(font: PDFFont, s: string, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(s).split(/\r?\n/)) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && textWidth(font, next, size) > width * S) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    out.push(cur);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
}

function paragraph(c: Ctx, s: string, x: number, top: number, width: number, o: { size: number; gap: number; align?: "left" | "center"; font?: PDFFont; maxLines?: number; color?: RGB }) {
  const font = o.font ?? c.regular;
  const lines = wrap(font, s, o.size, width).slice(0, o.maxLines ?? 99);
  lines.forEach((l, i) => text(c, l, o.align === "center" ? x + width / 2 : x, top + i * o.gap, { size: o.size, font, align: o.align === "center" ? "center" : "left", color: o.color }));
  return lines.length;
}

async function qrPng(text: string): Promise<Buffer> {
  return QRCode.toBuffer(text, { margin: 0, width: 512, errorCorrectionLevel: "M" });
}

/* ------------------------------------------------------------------ tables */

interface TableSpec {
  columns: readonly string[];
  /** left edges of each column, plus the right edge (grid units) */
  edges: number[];
  rows: string[][];
  top: number;
  /** last y a row may reach */
  limit: number;
  size: number;
  /** column index holding multi-line text ("/" is a line break) */
  multi?: number;
}

/** Draws as many rows as fit. Returns the rows that did not fit and the y where the table ended. */
function table(c: Ctx, t: TableSpec): { rest: string[][]; bottom: number } {
  const lineGap = t.size + 3.5;
  const headerH = 36;
  const cellLines = (row: string[]) =>
    row.map((cell, i) => {
      const width = t.edges[i + 1] - t.edges[i] - 10;
      const src = i === t.multi ? cell.replace(/\s*\/\s*/g, "\n") : cell;
      return wrap(c.regular, src, t.size, width);
    });

  // header
  line(c, t.edges[0], t.top, t.edges.at(-1)!, t.top, 4.5);
  t.columns.forEach((name, i) => text(c, name, t.edges[i] + 7, t.top + 24, { size: 13, font: c.heavy, maxWidth: t.edges[i + 1] - t.edges[i] - 10 }));
  line(c, t.edges[0], t.top + headerH, t.edges.at(-1)!, t.top + headerH, 2);

  let y = t.top + headerH;
  let used = 0;
  for (const row of t.rows) {
    const cells = cellLines(row);
    const h = Math.max(34, Math.max(...cells.map((l) => l.length)) * lineGap + 14);
    if (y + h > t.limit && used > 0) break;
    cells.forEach((lines, i) => lines.forEach((l, k) => text(c, l, t.edges[i] + 7, y + 22 + k * lineGap, { size: t.size, maxWidth: t.edges[i + 1] - t.edges[i] - 10 })));
    y += h;
    line(c, t.edges[0], y, t.edges.at(-1)!, y, 1);
    used += 1;
  }
  if (used === 0 && t.rows.length === 0) {
    // no rows: keep the empty body the height of one row so the table still reads as a table
    y += 34;
    line(c, t.edges[0], y, t.edges.at(-1)!, y, 1);
  }
  // vertical rules and outer border
  for (const e of t.edges) line(c, e, t.top, e, y, 1.2);
  return { rest: t.rows.slice(used), bottom: y };
}

/* --------------------------------------------------------------------- page */

function drawFrame(c: Ctx, record: RecordRow, qr: Awaited<ReturnType<PDFDocument["embedPng"]>>) {
  const type = docTypeOf(record);
  const kind = VOUCHER_TYPES[type];
  const L = VOUCHER_LETTERHEAD;

  // ---- left column: header box
  rrect(c, 22, 45, 261, 320, 12, { stroke: 2 });
  text(c, kind.title, 152.5, 66, { size: 20, font: c.bold, align: "center", maxWidth: 240 });
  c.page.drawRectangle({ x: X(22), y: Y(122), width: X(261), height: 47 * S, color: NAVY });
  const headline = String(record.headline || "").trim() || kind.defaultHeadline;
  text(c, headline.toUpperCase(), 152.5, 110, { size: 38, font: c.heavy, color: WHITE, align: "center", maxWidth: 246 });
  text(c, "VOUCHER NO.", 28, 138, { size: 12, font: c.bold });
  text(c, "ACCRUAL DATE", 277, 138, { size: 12, font: c.bold, align: "right" });
  text(c, voucherNumber(record), 28, 180, { size: 25, font: c.heavy, maxWidth: 140 });
  text(c, formatVoucherDate(record.accrualDate), 277, 180, { size: 25, font: c.heavy, align: "right", maxWidth: 92 });
  line(c, 22, 190, 283, 190, 2);
  rrect(c, 32, 202, 46, 50, 9, { stroke: 3.5 });
  text(c, kind.mark, 55, 242, { size: 38, font: c.heavy, align: "center" });
  rrect(c, 31, 260, 48, 52, 9, { fill: NAVY });
  text(c, type, 55, 298, { size: 31, font: c.heavy, color: WHITE, align: "center" });
  line(c, 22, 320, 128, 320, 1, GRAY);
  const status = String(record.docStatus || "").trim();
  if (status) {
    rrect(c, 31, 325, 58, 26, 13, { fill: GRAY });
    text(c, status, 60, 343, { size: 14, font: c.bold, color: WHITE, align: "center", maxWidth: 52 });
  }
  c.page.drawImage(qr, { x: X(138), y: Y(343), width: 128 * S, height: 128 * S });

  // ---- deliver via
  rrect(c, 22, 387, 261, 183, 10, { stroke: 2 });
  text(c, "DELIVER VIA", 28, 405, { size: 13, font: c.heavy });
  line(c, 22, 414, 283, 414, 1.5);
  text(c, String(record.deliverVia || ""), 40, 440, { size: 15.5, font: c.bold, maxWidth: 235 });
  text(c, String(record.deliverPhone || ""), 40, 477, { size: 15.5, maxWidth: 235 });
  text(c, String(record.deliverPhone2 || ""), 33, 504, { size: 15.5, font: c.bold, maxWidth: 240 });
  line(c, 22, 515, 283, 515, 1.5);
  text(c, "RESOURCE", 28, 533, { size: 12.5, font: c.heavy });
  text(c, String(record.resource || ""), 277, 533, { size: 15.5, align: "right", maxWidth: 170 });
  line(c, 22, 543, 283, 543, 1.5);
  text(c, "TRACKING", 28, 561, { size: 12.5, font: c.heavy });
  text(c, String(record.tracking || ""), 277, 561, { size: 15.5, align: "right", maxWidth: 170 });

  // ---- voucher note
  rrect(c, 22, 582, 261, 192, 10, { stroke: 2 });
  text(c, "VOUCHER NOTE", 28, 601, { size: 13, font: c.heavy });
  line(c, 22, 610, 283, 610, 1.5, GRAY);
  paragraph(c, String(record.voucherNote || ""), 30, 630, 246, { size: 13, gap: 17, maxLines: 9 });

  // ---- terms of trade
  rrect(c, 22, 786, 261, 290, 10, { stroke: 2 });
  text(c, "TERMS OF TRADE", 28, 806, { size: 13, font: c.heavy });
  line(c, 22, 815, 283, 815, 1.5, GRAY);
  paragraph(c, String(record.terms || ""), 28, 834, 250, { size: 11.5, gap: 15, align: "center", maxLines: 14 });
  line(c, 31, 1049, 273, 1049, 1.5, GRAY);
  text(c, "Signatory", 31, 1067, { size: 13, font: c.heavy });

  // ---- footer
  text(c, L.footerName, 30, 1106, { size: 29, font: c.heavy, maxWidth: 245 });
  text(c, L.footerAddress, 586, 1104, { size: 22, align: "center", maxWidth: 520 });

  // ---- right panel
  rrect(c, 304, 45, 564, 1031, 12, { stroke: 2 });
  // letterhead
  L.lines.forEach((l, i) => text(c, l, 341, 66 + i * 16.5, { size: 11.5, font: c.bold, color: BLUE }));
  for (let i = 0; i < 3; i += 1) {
    const bl = 452 + 40 * i;
    const poly = `M ${bl},132 L ${bl + 24},132 L ${bl + 82},48 L ${bl + 58},48 Z`;
    c.page.drawSvgPath(poly, { x: 0, y: PAGE_H, scale: S, color: RED });
  }
  text(c, L.company, 842, 100, { size: 39, font: c.bold, color: BLUE, align: "right", skew: 11 });
  text(c, L.tagline, 842, 123, { size: 13, font: c.bold, color: RED, align: "right", skew: 11, maxWidth: 250 });
  line(c, 304, 135, 868, 135, 4.5, NAVY);
  line(c, 585, 135, 585, 313, 3, INK);

  // vendor account
  text(c, "VENDOR ACCOUNT", 311, 174, { size: 17, font: c.heavy });
  text(c, String(record.vendorCode || ""), 578, 174, { size: 12, align: "right", maxWidth: 130 });
  line(c, 304, 181, 585, 181, 1.2);
  const vendor = wrap(c.regular, String(record.vendorAccount || ""), 15.5, 268).slice(0, 5);
  vendor.forEach((l, i) => text(c, l, 311, 205 + i * 24, { size: 15.5 }));
  // operated by
  text(c, "OPERATED BY", 593, 174, { size: 17, font: c.heavy });
  line(c, 585, 181, 868, 181, 1.2);
  text(c, String(record.operatorCode || ""), 593, 203, { size: 14, maxWidth: 64 });
  line(c, 661, 181, 661, 278, 1.2);
  const operator = wrap(c.regular, String(record.operatedBy || ""), 14.5, 190).slice(0, 5);
  operator.forEach((l, i) => text(c, l, 668, 202 + i * 21, { size: 14.5 }));
  line(c, 304, 278, 868, 278, 1.5);
  text(c, String(record.contractNo || ""), 311, 303, { size: 20, font: c.heavy, maxWidth: 265 });
  text(c, String(record.contractNo || ""), 593, 303, { size: 20, font: c.heavy, maxWidth: 265 });
  line(c, 304, 313, 868, 313, 2);

  // manifest bar
  rrect(c, 314, 327, 546, 21, 10.5, { fill: NAVY });
  text(c, "MANIFEST OF ORDER", 587, 342, { size: 12.5, font: c.heavy, color: WHITE, align: "center" });
}

/** The document, as bytes. */
export async function generateVoucherPdf(record: RecordRow, opts: { origin: string; now?: Date }): Promise<Uint8Array> {
  const fonts = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });
  const heavy = await doc.embedFont(fonts.heavy, { subset: true });
  const number = voucherNumber(record) || "Voucher";
  doc.setTitle(`${number} (generated)`);
  doc.setProducer("BOSS");
  doc.setCreator("BOSS voucher generator");
  doc.setSubject("Voucher generated from saved data. Not an original uploaded document.");

  const qr = await doc.embedPng(await qrPng(`${opts.origin}/vouchers?record=${encodeURIComponent(record.id)}`));
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const c: Ctx = { doc, page, regular, bold, heavy };
  drawFrame(c, record, qr);

  const manifestRows = parseRows(record.manifestLines, MANIFEST_COLUMNS.length);
  const packRows = parseRows(record.packLines, PACK_COLUMNS.length);
  const m = table(c, { columns: MANIFEST_COLUMNS, edges: [314, 366, 530, 711, 777, 860], rows: manifestRows, top: 358, limit: 622, size: 12 });
  const p = table(c, { columns: PACK_COLUMNS, edges: [314, 366, 452, 606, 658, 699, 858], rows: packRows, top: 642, limit: 1062, size: 12, multi: 5 });

  const stamp = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const note = (pg: PDFPage) =>
    pg.drawText(safe(`Generated by BOSS from saved voucher data on ${stamp}. This is not an original uploaded document.`), { x: X(304), y: Y(1138), size: 8.5, font: regular, color: GRAY });
  note(page);

  // Rows that did not fit continue on extra pages, so nothing is cut off.
  let restManifest = m.rest;
  let restPack = p.rest;
  let n = 2;
  while (restManifest.length > 0 || restPack.length > 0) {
    const pg = doc.addPage([PAGE_W, PAGE_H]);
    const cc: Ctx = { ...c, page: pg };
    rrect(cc, 22, 45, 846, 1031, 12, { stroke: 2 });
    text(cc, `${number} (continued, page ${n})`, 40, 85, { size: 24, font: heavy });
    let top = 110;
    if (restManifest.length > 0) {
      const r = table(cc, { columns: MANIFEST_COLUMNS, edges: [40, 100, 280, 560, 680, 850], rows: restManifest, top, limit: restPack.length > 0 ? 560 : 1050, size: 12 });
      restManifest = r.rest;
      top = r.bottom + 40;
    }
    if (restPack.length > 0 && restManifest.length === 0) {
      const r = table(cc, { columns: PACK_COLUMNS, edges: [40, 100, 220, 420, 480, 540, 850], rows: restPack, top: Math.max(top, 110), limit: 1050, size: 12, multi: 5 });
      restPack = r.rest;
    }
    note(pg);
    n += 1;
    if (n > 30) break; // a safety stop: 30 pages of rows is far beyond any real voucher
  }

  return doc.save();
}
