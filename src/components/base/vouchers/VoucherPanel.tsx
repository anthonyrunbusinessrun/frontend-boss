"use client";

import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Play, QrCode, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { fileStatus } from "@/lib/base/compute";
import { readAttachments } from "@/lib/base/fields";
import { VOUCHER_TYPES, docTypeOf, voucherNumber } from "@/lib/base/voucher";
import type { AttachmentValue, RecordRow } from "@/lib/base/types";
import { api, ClientError } from "../client";
import { messageOf, useTable } from "../TableProvider";
import s from "../base.module.css";
import { Chip } from "../ui";
import { PdfPreview } from "./PdfPreview";
import { qrBlob, voucherLink } from "./qr";

const kb = (n?: number) => (n === undefined ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const STATUS_COLOR = { "Original uploaded": "green", "Generated only": "orange", "No PDF": "gray" } as const;

function DocRow({ title, note, file, actions }: { title: string; note: string; file: AttachmentValue; actions: React.ReactNode }) {
  return (
    <div className={s.docRow}>
      <FileText size={18} aria-hidden className={s.docIcon} />
      <div className={s.docMain}>
        <strong>{title}</strong>
        <span className={s.docName} title={file.name}>{file.name}{file.size ? ` · ${kb(file.size)}` : ""}</span>
        <span className={s.docNote}>{note}</span>
      </div>
      <div className={s.docActions}>{actions}</div>
    </div>
  );
}

/** Side panel of the Vouchers table: the voucher's PDF documents, and the QR generator. */
export function VoucherPanel({ onClose, focusId }: { onClose: () => void; focusId?: string | null }) {
  const t = useTable();
  const toast = useToast();
  const vouchers = useMemo(() => [...t.records].filter((r) => typeof r.i === "number").sort((a, b) => (a.i as number) - (b.i as number)), [t.records]);
  const [pick, setPick] = useState<string | null>(null);
  const [tab, setTab] = useState<"original" | "generated" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceMode = useRef(false);

  const currentId = pick ?? focusId ?? vouchers[0]?.id;
  const idx = vouchers.findIndex((r) => r.id === currentId);
  const current: RecordRow | undefined = idx >= 0 ? vouchers[idx] : undefined;
  const original = current ? readAttachments(current.pdf)[0] : undefined;
  const generated = current ? readAttachments(current.generatedPdf)[0] : undefined;
  const status = current ? fileStatus(current.pdf, current.generatedPdf) : "No PDF";
  const shown = tab === "generated" && generated ? "generated" : tab === "original" && original ? "original" : original ? "original" : generated ? "generated" : null;
  const shownFile = shown === "original" ? original : shown === "generated" ? generated : undefined;
  const missingQr = vouchers.filter((r) => readAttachments(r.qr).length === 0);

  const run = async (label: string, job: () => Promise<RecordRow>, success: string) => {
    setBusy(label);
    try {
      const rec = await job();
      t.applyRecord(rec);
      toast.success(success);
    } catch (e) {
      if (e instanceof ClientError && e.code === "original-exists") {
        replaceMode.current = true;
        setConfirmReplace(true);
      } else toast.error(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !current) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return toast.error("Choose a PDF file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("PDF files can be up to 5 MB.");
    const replace = replaceMode.current;
    replaceMode.current = false;
    await run("upload", () => api.uploadOriginalPdf(t.slug, current.id, "pdf", file, replace), replace ? "Original PDF replaced." : "Original PDF uploaded.");
    setTab("original");
  };

  const generate = async () => {
    if (!current) return;
    await run("generate", () => api.generatePdf(current.id), generated ? "PDF regenerated from the saved data." : "PDF generated from the saved data.");
    setTab(original ? tab : "generated");
  };

  const removeGenerated = async () => {
    if (!current) return;
    await run("remove", () => api.removeGeneratedPdf(current.id), "Generated PDF removed. The original was not touched.");
    setTab(null);
  };

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

  const dl = (a: AttachmentValue) => `${a.url}?download=1`;

  return (
    <aside className={s.sidePanel} aria-label="Voucher tools">
      <header className={s.sidePanelHead}>
        <h2>Voucher documents</h2>
        <button type="button" className={s.iconBtn} aria-label="Close voucher tools" onClick={onClose}><X size={16} /></button>
      </header>

      {vouchers.length === 0 || !current ? (
        <p className={s.muted}>Create a voucher to attach or generate its PDF.</p>
      ) : (
        <section className={s.toolBox} aria-label="Voucher PDF">
          <div className={s.previewBar}>
            <select className={s.miniSelect} aria-label="Voucher" value={current.id} onChange={(e) => { setPick(e.target.value); setTab(null); }}>
              {vouchers.map((r) => <option key={r.id} value={r.id}>{voucherNumber(r)}</option>)}
            </select>
            <button type="button" className={s.iconBtn} aria-label="Previous voucher" disabled={idx <= 0} onClick={() => { setPick(vouchers[idx - 1].id); setTab(null); }}><ChevronLeft size={16} /></button>
            <button type="button" className={s.iconBtn} aria-label="Next voucher" disabled={idx >= vouchers.length - 1} onClick={() => { setPick(vouchers[idx + 1].id); setTab(null); }}><ChevronRight size={16} /></button>
          </div>
          <p className={s.docSummary}>
            <strong>{[VOUCHER_TYPES[docTypeOf(current)].label, current.headline ? String(current.headline) : "", current.tracking ? `tracking ${String(current.tracking)}` : ""].filter(Boolean).join(" · ")}</strong>
            <Chip color={STATUS_COLOR[status]}>{status}</Chip>
          </p>

          {original ? (
            <DocRow
              title="Original PDF"
              note="Uploaded document. The app never edits it."
              file={original}
              actions={
                <>
                  <a className={s.iconBtn} href={original.url} target="_blank" rel="noopener noreferrer" aria-label="Open original PDF in a new tab"><ExternalLink size={15} /></a>
                  <a className={s.iconBtn} href={dl(original)} download aria-label="Download original PDF"><Download size={15} /></a>
                  <Button variant="secondary" size="sm" icon={<Upload size={13} />} disabled={!!busy} onClick={() => setConfirmReplace(true)}>Replace…</Button>
                </>
              }
            />
          ) : (
            <div className={s.docRow}>
              <FileText size={18} aria-hidden className={s.docIcon} />
              <div className={s.docMain}>
                <strong>Original PDF</strong>
                <span className={s.docNote}>None attached. Upload the voucher PDF you received.</span>
              </div>
              <Button size="sm" icon={<Upload size={13} />} disabled={!!busy} onClick={() => { replaceMode.current = false; fileInput.current?.click(); }}>{busy === "upload" ? "Uploading…" : "Upload PDF"}</Button>
            </div>
          )}

          {generated ? (
            <DocRow
              title="Generated PDF"
              note="Made by BOSS from the saved fields. Not an original document."
              file={generated}
              actions={
                <>
                  <a className={s.iconBtn} href={generated.url} target="_blank" rel="noopener noreferrer" aria-label="Open generated PDF in a new tab"><ExternalLink size={15} /></a>
                  <a className={s.iconBtn} href={dl(generated)} download aria-label="Download generated PDF"><Download size={15} /></a>
                  <button type="button" className={s.iconBtn} aria-label="Regenerate PDF" disabled={!!busy} onClick={() => void generate()}><RefreshCw size={15} /></button>
                  <button type="button" className={s.iconBtn} aria-label="Remove generated PDF" disabled={!!busy} onClick={() => void removeGenerated()}><Trash2 size={15} /></button>
                </>
              }
            />
          ) : (
            <div className={s.docRow}>
              <FileText size={18} aria-hidden className={s.docIcon} />
              <div className={s.docMain}>
                <strong>Generated PDF</strong>
                <span className={s.docNote}>Build a PDF from this voucher&apos;s saved fields.</span>
              </div>
              <Button variant="secondary" size="sm" icon={<Play size={13} />} disabled={!!busy} onClick={() => void generate()}>{busy === "generate" ? "Generating…" : "Generate PDF"}</Button>
            </div>
          )}

          {shownFile && (
            <>
              {original && generated && (
                <div className={s.segmented} role="tablist" aria-label="Preview">
                  <button type="button" role="tab" aria-selected={shown === "original"} className={`${s.segBtn} ${shown === "original" ? s.segBtnOn : ""}`} onClick={() => setTab("original")}>Original</button>
                  <button type="button" role="tab" aria-selected={shown === "generated"} className={`${s.segBtn} ${shown === "generated" ? s.segBtnOn : ""}`} onClick={() => setTab("generated")}>Generated</button>
                </div>
              )}
              <PdfPreview key={shownFile.url} url={shownFile.url} title={`${shown === "original" ? "Original" : "Generated"} PDF of ${voucherNumber(current)}`} />
            </>
          )}
        </section>
      )}

      <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      <ConfirmDialog
        open={confirmReplace}
        destructive
        title="Replace the original PDF?"
        message={<>This voucher already has the original <strong>{original?.name ?? "PDF"}</strong>. The file you choose will become its original instead. The previous file will no longer be attached to the voucher.</>}
        confirmLabel="Choose a PDF…"
        onCancel={() => { setConfirmReplace(false); replaceMode.current = false; }}
        onConfirm={() => { setConfirmReplace(false); replaceMode.current = true; fileInput.current?.click(); }}
      />

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
