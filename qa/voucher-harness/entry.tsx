// Bundled by qa/voucher-harness/run.sh: draws the real VoucherDocument component in a bare page so the layout can be
// checked against the template and the sample PDFs without signing in to the app.
import QRCode from "qrcode";
import { createRoot } from "react-dom/client";
import { VoucherDocument } from "@/components/base/vouchers/VoucherDocument";
import { FEMA_VOUCHERS } from "@/data/femaVouchers";
import { buildVoucherDocument } from "@/lib/base/voucherDocument";
import type { RecordRow } from "@/lib/base/types";

declare global {
  interface Window {
    showVoucher: (spec: { i?: number; selfTest?: boolean; record?: Record<string, unknown>; qr?: string | boolean | null }) => void;
    FEMA: unknown;
  }
}

const root = createRoot(document.getElementById("root")!);
window.FEMA = FEMA_VOUCHERS;
window.showVoucher = async ({ i, selfTest, record, qr }) => {
  let rec: RecordRow;
  if (selfTest) rec = { id: "t", i: 11597, docType: "IN", headline: "INVOICE" } as RecordRow;
  else if (record) rec = record as RecordRow;
  else rec = { ...FEMA_VOUCHERS.find((v) => v.i === i)! } as unknown as RecordRow;
  const doc = buildVoucherDocument(rec);
  if (selfTest) Object.assign(doc, { terms: [], status: null, note: [], via: [], manifest: [], pack: [] });
  const qrSrc = qr === true ? await QRCode.toDataURL(`https://boss.example/vouchers?record=${rec.id}`, { margin: 0, width: 400 }) : typeof qr === "string" ? qr : null;
  root.render(<VoucherDocument doc={doc} qrSrc={qrSrc} templateUrl="file:///home/claude/frontend-boss/public/vouchers/template/Voucher_Template.png" />);
};
