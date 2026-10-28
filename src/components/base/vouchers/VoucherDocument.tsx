"use client";

import { useEffect, useState } from "react";
import { readAttachments } from "@/lib/base/fields";
import type { RecordRow } from "@/lib/base/types";
import { formatDate } from "@/lib/dates";
import s from "../base.module.css";
import { qrDataUrl, voucherLink } from "./qr";
import { VOUCHER_LETTERHEAD, voucherNumber } from "./voucherConfig";

const text = (v: unknown) => (typeof v === "string" ? v : "");
const lines = (v: unknown) => text(v).split("\n").map((l) => l.trim()).filter(Boolean);

/** The printable Bill of Lading for one voucher record, laid out like the reference screenshot. */
export function VoucherDocument({ record }: { record: RecordRow }) {
  const stored = readAttachments(record.qr)[0]?.url;
  const [generated, setGenerated] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!stored) qrDataUrl(voucherLink(window.location.origin, record.id)).then((u) => alive && setGenerated(u)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [stored, record.id]);
  const qr = stored ?? generated;
  const no = voucherNumber(record.i);
  const manifest = lines(record.manifest);
  const L = VOUCHER_LETTERHEAD;

  return (
    <article className={s.bol} data-print-area aria-label={`Bill of Lading ${no}`}>
      <div className={s.bolTop}>
        <section className={s.bolBox}>
          <p className={s.bolSmall}>Original | Non Negotiable</p>
          <h3 className={s.bolTitle}>BILL OF LADING</h3>
          <div className={s.bolNoRow}>
            <div><small>VOUCHER NO.</small><strong>{no || "—"}</strong></div>
            <div className={s.bolRight}><small>ACCRUAL DATE</small><strong>{text(record.accrualDate) ? formatDate(text(record.accrualDate)) : "—"}</strong></div>
          </div>
          <div className={s.bolQrRow}>
            <span className={s.bolMarks}><b>R</b><b>BL</b></span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={`QR code for ${no}`} className={s.bolQr} /> : <span className={s.bolQr} />}
          </div>
        </section>
        <section className={s.bolBox}>
          <div className={s.bolLetterhead}>
            <address>{L.address.map((l) => <span key={l}>{l}</span>)}</address>
            <div className={s.bolBrand}><strong>{L.company}</strong><em>{L.tagline}</em></div>
          </div>
          <div className={s.bolParties}>
            <div><small>CONSIGNEE</small>{lines(record.consignee).map((l, i) => <span key={i}>{l}</span>)}</div>
            <div><small>SHIP TO</small>{lines(record.shipTo).map((l, i) => <span key={i}>{l}</span>)}</div>
          </div>
        </section>
      </div>

      <div className={s.bolMid}>
        <section className={s.bolBox}>
          <small>DELIVER VIA</small>
          <strong>{text(record.deliverVia) || "—"}</strong>
          {text(record.deliverPhone) && <span>{text(record.deliverPhone)}</span>}
          <div className={s.bolKv}><span>RESOURCE</span><span>{text(record.resource) || "—"}</span></div>
          <div className={s.bolKv}><span>TRACKING</span><span>{text(record.tracking) || "—"}</span></div>
        </section>
        <section className={s.bolBox}>
          <h4 className={s.bolBar}>MANIFEST OF ORDER</h4>
          <table className={s.bolTable}>
            <thead><tr><th>CLIN</th><th>Title</th><th>Delivery</th><th>Freight #</th></tr></thead>
            <tbody>
              {manifest.length === 0 ? (
                <tr><td colSpan={4} className={s.bolEmpty}>No manifest lines. Add them in the Manifest field.</td></tr>
              ) : (
                manifest.map((l, i) => (
                  <tr key={i}><td>{String(i + 1).padStart(2, "0")}</td><td>{l}</td><td>{text(record.accrualDate) ? formatDate(text(record.accrualDate)) : ""}</td><td>{text(record.tracking)}</td></tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      <div className={s.bolMid}>
        <section className={s.bolBox}>
          <small>VOUCHER NOTE</small>
          {lines(record.voucherNote).length ? lines(record.voucherNote).map((l, i) => <span key={i}>{l}</span>) : <span className={s.bolEmpty}>—</span>}
        </section>
        <section className={s.bolBox}>
          <small>TERMS OF TRADE</small>
          {lines(record.terms).length ? lines(record.terms).map((l, i) => <span key={i}>{l}</span>) : <span className={s.bolEmpty}>—</span>}
        </section>
      </div>
    </article>
  );
}
