/**
 * Where everything goes on the voucher template (public/vouchers/template/Voucher_Template.png).
 * All numbers are pixels of that 2550 x 3300 image. They were measured from the template itself; the type sizes come
 * from the sample voucher PDFs (their font size x 2.47 gives the size in template pixels, and the template draws its
 * glyphs about 1.2 times taller than wide, which `K` reproduces).
 */
export const TEMPLATE = { url: "/vouchers/template/Voucher_Template.png", pdfUrl: "/vouchers/template/Voucher_Template.pdf", width: 2550, height: 3300 } as const;

/** vertical stretch of every glyph, as drawn in the template */
export const K = 1.2;

export type FontFamily = "Saira Condensed" | "Saira Extra Condensed" | "Saira Semi Condensed" | "Saira";
export const COND: FontFamily = "Saira Condensed";
export const EXTRA: FontFamily = "Saira Extra Condensed";
export const SEMI: FontFamily = "Saira Semi Condensed";
export const NORMAL: FontFamily = "Saira";

/** Every (family, weight) the document draws with, so the fonts can be loaded before drawing. */
export const FONT_FACES: Array<[FontFamily, number]> = [
  [COND, 400], [COND, 600], [COND, 700],
  [EXTRA, 400], [EXTRA, 600], [EXTRA, 700], [EXTRA, 800],
  [SEMI, 500], [SEMI, 600], [SEMI, 700], [SEMI, 800],
  [NORMAL, 400],
];

export const INK = "#0d1117";
export const NAVY = "#202933";
export const WHITE = "#ffffff";

/** White rectangles that hide the placeholder text baked into the template (Invoice 15597). */
export const MASKS: Array<{ x: number; y: number; w: number; h: number; fill: string }> = [
  { x: 300, y: 68, w: 470, h: 74, fill: WHITE }, // small title above the dark bar
  { x: 300, y: 158, w: 450, h: 120, fill: NAVY }, // text in the dark bar
  { x: 204, y: 380, w: 500, h: 96, fill: WHITE }, // voucher number
  { x: 200, y: 508, w: 150, h: 350, fill: WHITE }, // the R and IN marks
  { x: 924, y: 402, w: 150, h: 56, fill: WHITE }, // BILL TO
  { x: 1650, y: 402, w: 210, h: 56, fill: WHITE }, // SHIPPED TO
  { x: 958, y: 2082, w: 160, h: 46, fill: WHITE }, // caption above the pack table
  { x: 930, y: 982, w: 1416, h: 134, fill: WHITE }, // header of the manifest table (redrawn with wider Title column)
];

export const LEFT = {
  center: 523.5,
  titleBaseline: 120,
  titleSize: 45,
  titleMax: 610,
  barBaseline: 249,
  barSize: 80,
  barMax: 640,
  numberX: 214,
  numberBaseline: 445,
  numberSize: 66.6,
  accrualRight: 845,
  accrualBaseline: 445,
  accrualSize: 74,
  // marks
  markLetter: { x: 211, y: 522, w: 124, h: 145, stroke: 13, radius: 30, baseline: 637, size: 102 },
  markCode: { x: 211, y: 697, w: 124, h: 144, radius: 30, baseline: 813, size: 98, k: 1.3 },
  qr: { x: 484, y: 522, size: 330 },
  pill: { x: 212, y: 893, h: 62, baseline: 938, size: 37, padX: 34 },
};

export const RIGHT = {
  leftX: 940,
  rightX: 1665,
  labelBaseline: 449,
  labelSize: 46.5,
  codeRight: 1612,
  codeBaseline: 440,
  codeSize: 32.2,
  leftLinesX: 944,
  leftLinesSize: 44.6,
  leftLinesMax: 660,
  firstLineBaseline: 516,
  leftPitch: 73,
  // right-hand block: code, a short vertical rule, then the lines
  performCodeX: 1670,
  performCodeSize: 36.8,
  rightLinesX: 1858,
  rightLinesSize: 36.8,
  rightLinesMax: 480,
  rightPitch: 62,
  ruleX: 1842,
  ruleTop: 482,
  ruleBottom: 748,
  linesLimit: 748,
  refBaseline: 832,
  ref1Size: 52,
  ref1Max: 650,
  ref2Size: 44.6,
  ref2Max: 640,
};

export const MANIFEST = {
  left: 936,
  right: 2312,
  top: 987,
  headerBottom: 1110,
  headerBaseline: 1066,
  headerSize: 39,
  /** share of the table width taken by CLIN, Title, Description, Delivery, Freight # */
  columns: [0.09, 0.4, 0.245, 0.12, 0.145],
  headers: ["CLIN", "Title", "Description", "Delivery", "Freight #"],
  padX: 20,
  rowMin: 86,
  textSize: 39.6,
  linePitch: 52,
  firstBaseline: 58,
  bottomLimit: 2052,
  line: 3,
};

export const PACK = {
  /** edges of the template's own header (it is not redrawn) */
  edges: [936, 1137, 1469, 1888, 2151, 2338],
  top: 2303,
  padX: 24,
  rowMin: 86,
  textSize: 39.6,
  linePitch: 52,
  firstBaseline: 58,
  bottomLimit: 3030,
  line: 3,
};

export const CAPTION = { x: 972, baseline: 2118, size: 25, family: "Arial, Helvetica, sans-serif" };

export const DELIVER = {
  x: 232,
  right: 840,
  firstBaseline: 1236,
  pitch: 78,
  nameSize: 39.6,
  phoneSize: 36.6,
  phone2Size: 42.4,
  limit: 1440,
  resourceBaseline: 1509,
  trackingBaseline: 1595,
  valueSize: 47.3,
  valueMax: 520,
};

export const NOTE = { x: 222, firstBaseline: 1816, pitch: 66, size: 39.6, max: 612, limit: 2215 };

export const TERMS = { center: 523.5, firstBaseline: 2412, pitch: 50, size: 34.1, max: 630, limit: 3040 };
