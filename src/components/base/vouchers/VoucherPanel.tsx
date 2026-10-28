"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Play, QrCode, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { readAttachments } from "@/lib/base/fields";
import { VOUCHER_DOCUMENT, VOUCHER_TYPES, docTypeOf, voucherNumber } from "@/lib/base/voucher";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";
import { PdfPreview } from "./PdfPreview";
import { qrBlob, voucherLink } from "./qr";

/**
 * Side panel of the Vouchers table. It always shows the supplied voucher PDF (Voucher.pdf), whichever voucher is
 * selected: the app does not generate or upload voucher PDFs. The panel also has the QR generator.
 */
export function VoucherPanel({ onClose, focusId }: { onClose: () => void; focusId?: string | null }) {
  const t = useTable();
  const toast = useToast();
  const vouchers = useMemo(() => [...t.records].filter((r) => typeof r.i === "number").sort((a, b) => (a.i as number) - (b.i as number)), [t.records]);
  const [pick, setPick] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const currentId = pick ?? focusId ?? vouchers[0]?.id;
  const idx = vouchers.findIndex((r) => r.id === currentId);
  const current = idx >= 0 ? vouchers[idx] : undefined;
  const missingQr = vouchers.filter((r) => readAttachments(r.qr).length === 0);

  const runQr = async () => {
    if (missingQr.length === 0) return toast.info("Every voucher already has a QR code.");
    setProgress({ done: 0, total: missingQr.length });
    let failed = 0;
    for (const [n, r] of missingQr.entries()) {
      try {
        const blob = await qrBlob(voucherLink(window.location.origin, r.id));
        const file = await t.upload(blob, `${voucherNumber(r) || r.id}-qr.png`);
        await t.updateRecord(r.id, { qr: [file] });
      } catch (e) {
        failed += 1;
        if (failed === 1) toast.error(`QR generation failed for ${voucherNumber(r) || r.id}. ${messageOf(e)}`);
      }
      setProgress({ done: n + 1, total: missingQr.length });
    }
    setProgress(null);
    if (failed < missingQr.length) toast.success(`Generated ${missingQr.length - failed} QR code${missingQr.length - failed === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`);
  };

  return (
    <aside className={s.sidePanel} aria-label="Voucher tools">
      <header className={s.sidePanelHead}>
        <h2>Voucher document</h2>
        <button type="button" className={s.iconBtn} aria-label="Close voucher tools" onClick={onClose}><X size={16} /></button>
      </header>

      <section className={s.toolBox} aria-label="Voucher PDF">
        {current && (
          <>
            <div className={s.previewBar}>
              <select className={s.miniSelect} aria-label="Voucher" value={current.id} onChange={(e) => setPick(e.target.value)}>
                {vouchers.map((r) => <option key={r.id} value={r.id}>{voucherNumber(r)}</option>)}
              </select>
              <button type="button" className={s.iconBtn} aria-label="Previous voucher" disabled={idx <= 0} onClick={() => setPick(vouchers[idx - 1].id)}><ChevronLeft size={16} /></button>
              <button type="button" className={s.iconBtn} aria-label="Next voucher" disabled={idx >= vouchers.length - 1} onClick={() => setPick(vouchers[idx + 1].id)}><ChevronRight size={16} /></button>
            </div>
            <p className={s.docSummary}>
              <strong>{[VOUCHER_TYPES[docTypeOf(current)].label, current.headline ? String(current.headline) : "", current.tracking ? `tracking ${String(current.tracking)}` : ""].filter(Boolean).join(" · ")}</strong>
            </p>
          </>
        )}
        <div className={s.docRow}>
          <FileText size={18} aria-hidden className={s.docIcon} />
          <div className={s.docMain}>
            <strong>{VOUCHER_DOCUMENT.name}</strong>
            <span className={s.docNote}>The supplied voucher PDF. The same document is shown for every voucher.</span>
          </div>
          <div className={s.docActions}>
            <a className={s.iconBtn} href={VOUCHER_DOCUMENT.url} target="_blank" rel="noopener noreferrer" aria-label="Open voucher PDF in a new tab"><ExternalLink size={15} /></a>
            <a className={s.iconBtn} href={VOUCHER_DOCUMENT.url} download={VOUCHER_DOCUMENT.name} aria-label="Download voucher PDF"><Download size={15} /></a>
          </div>
        </div>
        <PdfPreview url={VOUCHER_DOCUMENT.url} title="Voucher PDF" />
      </section>

      <section className={s.toolBox}>
        <h3 className={s.subTitle}><QrCode size={14} aria-hidden /> Voucher QR Generator</h3>
        <p className={s.muted}>Creates a QR code for each voucher that does not have one. Scanning it opens the voucher in this app.</p>
        <Button size="md" icon={<Play size={14} />} onClick={() => void runQr()} disabled={!!progress}>
          {progress ? `Generating ${progress.done} / ${progress.total}…` : missingQr.length === 0 ? "Run (all up to date)" : `Run (${missingQr.length} to generate)`}
        </Button>
      </section>
    </aside>
  );
}
