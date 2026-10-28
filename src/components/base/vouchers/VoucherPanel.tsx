"use client";

import { ChevronLeft, ChevronRight, Play, Printer, QrCode, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { readAttachments } from "@/lib/base/fields";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";
import { qrBlob, voucherLink } from "./qr";
import { VoucherDocument } from "./VoucherDocument";
import { voucherNumber } from "./voucherConfig";

/** Side panel for the Vouchers table: generate QR codes, preview and print the Bill of Lading. */
export function VoucherPanel({ onClose, focusId }: { onClose: () => void; focusId?: string | null }) {
  const t = useTable();
  const toast = useToast();
  const vouchers = useMemo(() => [...t.records].filter((r) => typeof r.i === "number").sort((a, b) => (a.i as number) - (b.i as number)), [t.records]);
  const [pick, setPick] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const currentId = pick ?? focusId ?? vouchers[0]?.id;
  const idx = vouchers.findIndex((r) => r.id === currentId);
  const current = idx >= 0 ? vouchers[idx] : undefined;
  const missing = vouchers.filter((r) => readAttachments(r.qr).length === 0);

  const run = async () => {
    if (missing.length === 0) return toast.info("Every voucher already has a QR code.");
    setProgress({ done: 0, total: missing.length });
    let failed = 0;
    for (const [n, r] of missing.entries()) {
      try {
        const blob = await qrBlob(voucherLink(window.location.origin, r.id));
        const file = await t.upload(blob, `${voucherNumber(r.i) || r.id}-qr.png`);
        await t.updateRecord(r.id, { qr: [file] });
      } catch (e) {
        failed += 1;
        if (failed === 1) toast.error(`QR generation failed for ${voucherNumber(r.i) || r.id}. ${messageOf(e)}`);
      }
      setProgress({ done: n + 1, total: missing.length });
    }
    setProgress(null);
    if (failed < missing.length) toast.success(`Generated ${missing.length - failed} QR code${missing.length - failed === 1 ? "" : "s"}${failed ? ` (${failed} failed)` : ""}.`);
  };

  return (
    <aside className={s.sidePanel} aria-label="Voucher tools">
      <header className={s.sidePanelHead}>
        <h2>Voucher tools</h2>
        <button type="button" className={s.iconBtn} aria-label="Close voucher tools" onClick={onClose}><X size={16} /></button>
      </header>

      <section className={s.toolBox}>
        <h3 className={s.subTitle}><QrCode size={14} aria-hidden /> Voucher QR Generator</h3>
        <p className={s.muted}>Creates a QR code for each voucher that does not have one. Scanning it opens the voucher in this app.</p>
        <Button size="md" icon={<Play size={14} />} onClick={() => void run()} disabled={!!progress}>
          {progress ? `Generating ${progress.done} / ${progress.total}…` : missing.length === 0 ? "Run (all up to date)" : `Run (${missing.length} to generate)`}
        </Button>
      </section>

      <section className={s.toolBox}>
        <h3 className={s.subTitle}>Voucher preview</h3>
        {vouchers.length === 0 ? (
          <p className={s.muted}>Create a voucher to preview its Bill of Lading.</p>
        ) : (
          <>
            <div className={s.previewBar}>
              <select className={s.miniSelect} aria-label="Voucher" value={currentId ?? ""} onChange={(e) => setPick(e.target.value)}>
                {vouchers.map((r) => <option key={r.id} value={r.id}>{voucherNumber(r.i)}</option>)}
              </select>
              <button type="button" className={s.iconBtn} aria-label="Previous voucher" disabled={idx <= 0} onClick={() => setPick(vouchers[idx - 1].id)}><ChevronLeft size={16} /></button>
              <button type="button" className={s.iconBtn} aria-label="Next voucher" disabled={idx < 0 || idx >= vouchers.length - 1} onClick={() => setPick(vouchers[idx + 1].id)}><ChevronRight size={16} /></button>
              <Button variant="secondary" size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>Print</Button>
            </div>
            {current && <div className={s.previewScroll}><VoucherDocument record={current} /></div>}
          </>
        )}
      </section>
    </aside>
  );
}
