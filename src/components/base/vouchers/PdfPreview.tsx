"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "../ui";
import s from "../base.module.css";

/**
 * Renders a PDF inside the page with pdf.js, one canvas per page. This works the same in every browser (some phones
 * cannot show a PDF in a frame at all) and never changes the file: it only reads it.
 */
export function PdfPreview({ url, title, maxPages = 8 }: { url: string; title: string; maxPages?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let doc: import("pdfjs-dist").PDFDocumentProxy | null = null;
    const el = host.current;
    if (!el) return;
    el.replaceChildren();
    setState("loading");
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (cancelled) return;
        const count = Math.min(doc.numPages, maxPages);
        setPages(doc.numPages);
        const width = Math.max(240, el.clientWidth || 360);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= count; n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = s.pdfPage;
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${title}, page ${n} of ${doc.numPages}`);
          el.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [url, title, maxPages]);

  return (
    <div className={s.pdfWrap} data-testid="pdf-preview" data-state={state}>
      {state === "loading" && (
        <p className={s.pdfStatus}>
          <Spinner /> Loading preview…
        </p>
      )}
      {state === "error" && (
        <p className={s.pdfStatus} role="alert">
          The preview could not be shown. <a className={s.link} href={url} target="_blank" rel="noopener noreferrer">Open the PDF in a new tab</a>.
        </p>
      )}
      <div ref={host} className={s.pdfPages} />
      {state === "ready" && pages > maxPages && <p className={s.muted}>Showing the first {maxPages} of {pages} pages. Open the PDF to see the rest.</p>}
    </div>
  );
}
