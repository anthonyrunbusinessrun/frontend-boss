import {
  FORMS_WITH_SECOND_PHONE,
  FQ_NO_VIA_LINES,
  NEUTRAL_STATUS_STYLE,
  UNKNOWN_FORM,
  VOUCHER_CARRIERS,
  VOUCHER_FORMS,
  VOUCHER_PARTIES,
  VOUCHER_STATUS_STYLES,
} from "@/data/voucherDirectory";
import { readAttachments } from "./fields";
import type { RecordRow } from "./types";
import { MANIFEST_COLUMNS, PACK_COLUMNS, formatVoucherDate, parseRows, voucherNumber } from "./voucher";

/**
 * Everything printed on a voucher, worked out from one row of the Vouchers table. The renderer
 * (components/base/vouchers/VoucherDocument.tsx) only draws this; it decides nothing.
 *
 * Where each column goes:
 *   Voucher / ID + Form  -> VOUCHER NO.        Accrue      -> ACCRUAL DATE      Form Title -> the dark bar and the small caption
 *   Form                 -> wording, marks     Status      -> the pill          Issued     -> code of the left party
 *   Perform              -> code of the right party         Reference 1 / 2     -> the bold references under the parties
 *   Via                  -> DELIVER VIA        Resource, Tracking # -> RESOURCE, TRACKING
 *   Notes                -> VOUCHER NOTE       Manifest    -> rows of MANIFEST OF ORDER      QR -> the QR code
 * Optional detail columns win when a voucher fills them in: Vendor Account / Consignee, Operated By / Ship To,
 * Deliver Via Phone (1, 2), Terms of Trade, Manifest of Order, Pack Details.
 */

export interface VoucherDocLine {
  text: string;
  bold?: boolean;
}

export interface VoucherNoteLine {
  /** "Phone Number:" in bold, followed by `text` */
  label?: string;
  text: string;
  bold?: boolean;
}

export interface VoucherDocument {
  number: string;
  accrual: string;
  topTitle: string;
  barText: string;
  /** the outlined letter and the filled form code; null when the voucher has no Form */
  mark: { letter: string; code: string } | null;
  status: { text: string; fill: string; color: string } | null;
  leftLabel: string;
  rightLabel: string;
  issuedCode: string;
  performCode: string;
  leftLines: string[];
  rightLines: string[];
  ref1: string;
  ref2: string;
  via: VoucherDocLine[];
  resource: string;
  tracking: string;
  note: VoucherNoteLine[];
  terms: string[];
  /** CLIN, Title, Description, Delivery, Freight # */
  manifest: string[][];
  /** CLIN, Pack Size, Pallet Config, Per Kit, Qty */
  pack: string[][];
  caption: string;
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const lines = (v: unknown) =>
  text(v)
    ? text(v)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
const firstFilled = (...candidates: string[][]) => candidates.find((c) => c.length > 0) ?? [];

/** The CLIN is the leading "I/T-015" of an item line. Lines such as "P/U - EMERALD PRODUCTS" have none. */
const CLIN = /^(I\/T-\d+)\b/;

export function buildVoucherDocument(r: RecordRow): VoucherDocument {
  const form = text(r.docType);
  const style = VOUCHER_FORMS[form] ?? UNKNOWN_FORM;
  const issuedCode = text(r.vendorCode);
  const performCode = text(r.operatorCode);
  const formTitle = text(r.headline);

  // parties: what the voucher says itself, else the reference text for the code
  const leftLines = firstFilled(lines(r.vendorAccount), lines(r.consignee), VOUCHER_PARTIES[issuedCode] ?? []);
  const rightLines = firstFilled(lines(r.operatedBy), lines(r.shipTo), VOUCHER_PARTIES[performCode] ?? []);

  // deliver via
  const via: VoucherDocLine[] = [];
  const viaCode = text(r.deliverVia);
  const carrier = VOUCHER_CARRIERS[viaCode];
  if (carrier) {
    via.push({ text: carrier.name, bold: true });
    const phone = text(r.deliverPhone) || carrier.phone;
    if (phone) via.push({ text: phone });
    const phone2 = text(r.deliverPhone2) || (FORMS_WITH_SECOND_PHONE.includes(form) ? carrier.phone2 : undefined);
    if (phone2) via.push({ text: phone2, bold: true });
  } else if (viaCode) {
    via.push({ text: viaCode, bold: true });
    if (text(r.deliverPhone)) via.push({ text: text(r.deliverPhone) });
    if (text(r.deliverPhone2)) via.push({ text: text(r.deliverPhone2), bold: true });
  } else if (form === "FQ") {
    for (const l of FQ_NO_VIA_LINES) via.push({ text: l });
  }

  // voucher note: "Label: value" keeps its label in bold, any other line is bold
  const note: VoucherNoteLine[] = lines(r.voucherNote).map((l) => {
    const m = /^([^:]{1,40}:)\s*(.*)$/.exec(l);
    return m ? { label: m[1], text: m[2] } : { text: l, bold: true };
  });

  // manifest: explicit rows if the voucher has them, else one row per line of the Manifest column
  const rows = parseRows(r.manifestLines, MANIFEST_COLUMNS.length);
  const manifest = rows.length
    ? rows
    : lines(r.manifest).map((l) => {
        const clin = CLIN.exec(l)?.[1] ?? "";
        return [clin, l, "", "", ""];
      });
  const pack = parseRows(r.packLines, PACK_COLUMNS.length);

  const status = text(r.docStatus);
  return {
    number: voucherNumber(r),
    accrual: formatVoucherDate(r.accrualDate),
    topTitle: style.topTitle,
    barText: formTitle,
    mark: form ? { letter: style.mark, code: form } : null,
    status: status ? { text: status, ...(VOUCHER_STATUS_STYLES[status] ?? NEUTRAL_STATUS_STYLE) } : null,
    leftLabel: style.leftLabel,
    rightLabel: style.rightLabel,
    issuedCode,
    performCode,
    leftLines,
    rightLines,
    ref1: text(r.contractNo),
    ref2: text(r.reference2),
    via,
    resource: text(r.resource),
    tracking: text(r.tracking),
    note,
    terms: lines(r.terms).length ? text(r.terms).split(/\r?\n/).map((l) => l.trim()) : style.terms,
    manifest,
    pack,
    caption: formTitle,
  };
}

/** The QR image already stored on the voucher (QR column), if there is one. */
export const voucherQrUrl = (r: RecordRow): string | null => readAttachments(r.qr)[0]?.url ?? null;
