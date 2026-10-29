"use client";

// The Saira faces the voucher document is drawn with (see voucherLayout.ts FONT_FACES).
import "@fontsource/saira-condensed/400.css";
import "@fontsource/saira-condensed/600.css";
import "@fontsource/saira-condensed/700.css";
import "@fontsource/saira-extra-condensed/400.css";
import "@fontsource/saira-extra-condensed/600.css";
import "@fontsource/saira-extra-condensed/700.css";
import "@fontsource/saira-extra-condensed/800.css";
import "@fontsource/saira-semi-condensed/500.css";
import "@fontsource/saira-semi-condensed/600.css";
import "@fontsource/saira-semi-condensed/700.css";
import "@fontsource/saira-semi-condensed/800.css";
import "@fontsource/saira/400.css";

import { ChevronLeft, ChevronRight, ExternalLink, FileText, Maximize2, Play, Printer, QrCode, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { readAttachments } from "@/lib/base/fields";
import { voucherNumber } from "@/lib/base/voucher";
import { buildVoucherDocument, voucherQrUrl } from "@/lib/base/voucherDocument";
import type { RecordRow } from "@/lib/base/types";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";
import { VoucherDocument } from "./VoucherDocument";
import { qrBlob, qrDataUrl, voucherLink } from "./qr";
import { TEMPLATE } from "./voucherLayout";

/** The QR image of a voucher: the one stored in its QR column, else one made from its link. */
function useQrSource(record: RecordRow | undefined): string | null {
  const stored = record ? voucherQrUrl(record) : null;
  const [generated, setGenerated] = useState<{ id: string; url: string } | null>(null);
  const id = record?.id;
  useEffect(() => {
    if (!id || stored) return;
    let alive = true;
    qrDataUrl(voucherLink(window.location.origin, id), 400)
      .then((url) => alive && setGenerated({ id, url }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [id, stored]);
  if (stored) return stored;
  return generated && generated.id === id ? generated.url : null;
}

/**
 * Side panel of the Vouchers table: the voucher document for the selected voucher, drawn on the template from the
 * voucher's own columns. Selecting another row (or another voucher in the list) redraws it. Also has the QR generator.
 */
export function VoucherPanel({ onClose, focusId }: { onClose: () => void; focusId?: string | null }) {
  const t = useTable();
  const toast = useToast();
  const vouchers = useMemo(() => [...t.records].filter((r) => typeof r.i === "number").sort((a, b) => (a.i as number) - (b.i as number)), [t.records]);
  const [pick, setPick] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // choosing a row in the table wins over an earlier choice in the list
  useEffect(() => setPick(null), [focusId]);

  const currentId = pick ?? focusId ?? vouchers[0]?.id;
  const idx = vouchers.findIndex((r) => r.id === currentId);
  const current = idx >= 0 ? vouchers[idx] : undefined;
  const doc = useMemo(() => (current ? buildVoucherDocument(current) : null), [current]);
  const qrSrc = useQrSource(current);
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
    <aside className={`${s.sidePanel} ${s.voucherPanel}`} aria-label="Voucher tools">
      <header className={s.sidePanelHead}>
        <h2>Voucher document</h2>
        <button type="button" className={s.iconBtn} aria-label="Close voucher tools" onClick={onClose}><X size={16} /></button>
      </header>

      <section className={s.toolBox} aria-label="Voucher document">
        {current && doc ? (
          <>
            <div className={s.previewBar}>
              <select className={s.miniSelect} aria-label="Voucher" value={current.id} onChange={(e) => setPick(e.target.value)}>
                {vouchers.map((r) => <option key={r.id} value={r.id}>{voucherNumber(r)}</option>)}
              </select>
              <button type="button" className={s.iconBtn} aria-label="Previous voucher" disabled={idx <= 0} onClick={() => setPick(vouchers[idx - 1].id)}><ChevronLeft size={16} /></button>
              <button type="button" className={s.iconBtn} aria-label="Next voucher" disabled={idx >= vouchers.length - 1} onClick={() => setPick(vouchers[idx + 1].id)}><ChevronRight size={16} /></button>
              <Button variant="secondary" size="sm" icon={<Maximize2 size={13} />} onClick={() => setFull(true)}>Full size</Button>
            </div>
            <div className={s.docFrame}>
              <VoucherDocument doc={doc} qrSrc={qrSrc} />
            </div>
            <p className={s.muted}>
              Drawn from the selected voucher&apos;s columns on the default template.{" "}
              <a className={s.link} href={TEMPLATE.pdfUrl} target="_blank" rel="noopener noreferrer"><FileText size={12} aria-hidden /> Template <ExternalLink size={11} aria-hidden /></a>
            </p>
          </>
        ) : (
          <p className={s.muted}>Create a voucher to see its document.</p>
        )}
      </section>

      <section className={s.toolBox}>
        <h3 className={s.subTitle}><QrCode size={14} aria-hidden /> Voucher QR Generator</h3>
        <p className={s.muted}>Creates a QR code for each voucher that does not have one. Scanning it opens the voucher in this app.</p>
        <Button size="md" icon={<Play size={14} />} onClick={() => void runQr()} disabled={!!progress}>
          {progress ? `Generating ${progress.done} / ${progress.total}…` : missingQr.length === 0 ? "Run (all up to date)" : `Run (${missingQr.length} to generate)`}
        </Button>
      </section>

      <Modal
        open={full && !!doc}
        onClose={() => setFull(false)}
        width={920}
        title={doc?.number || "Voucher"}
        subtitle="Voucher document"
        footer={<Button size="md" icon={<Printer size={14} />} onClick={() => window.print()}>Print</Button>}
      >
        {doc && (
          <div className={s.docFull} data-voucher-print>
            <VoucherDocument doc={doc} qrSrc={qrSrc} />
          </div>
        )}
      </Modal>
    </aside>
  );
}
