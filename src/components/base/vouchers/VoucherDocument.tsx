"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { VoucherDocument as Doc } from "@/lib/base/voucherDocument";
import {
  CAPTION, COND, DELIVER, EXTRA, FONT_FACES, INK, K, LEFT, MANIFEST, MASKS, NAVY, NORMAL, NOTE, PACK, RIGHT, SEMI, TEMPLATE, TERMS, WHITE,
  type FontFamily,
} from "./voucherLayout";

/**
 * The voucher document: the supplied template image with the selected voucher's text drawn on it. It draws what
 * `buildVoucherDocument` returns and nothing else, so it updates the moment a different voucher is chosen.
 * The fonts (Saira Condensed, Extra Condensed, Semi Condensed and Saira) must be loaded by the page that shows it.
 */

let canvasCtx: CanvasRenderingContext2D | null | undefined;
type Measure = (text: string, family: FontFamily | string, weight: number, size: number) => number;

/** A fixed estimate. Server rendering and the first browser render both use it, so they produce identical markup. */
const estimate: Measure = (text, _family, _weight, size) => text.length * size * 0.42;

/** Real text width in template pixels, once the fonts are loaded. */
const measure: Measure = (text, family, weight, size) => {
  if (canvasCtx === undefined) canvasCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!canvasCtx) return estimate(text, family, weight, size);
  canvasCtx.font = `${weight} ${size}px "${family}"`;
  return canvasCtx.measureText(text).width;
};

const MeasureContext = createContext<Measure>(estimate);

/** True once every face the document uses has been loaded, so measurements and drawing agree. */
export function useVoucherFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    if (typeof document === "undefined" || !document.fonts) {
      setReady(true);
      return;
    }
    Promise.all(FONT_FACES.map(([family, weight]) => document.fonts.load(`${weight} 40px "${family}"`)))
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

interface TxtProps {
  x: number;
  y: number;
  size: number;
  family?: FontFamily | string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  /** shrink horizontally when wider than this */
  max?: number;
  field?: string;
  /** vertical stretch when it differs from the template's usual one */
  k?: number;
  children: string;
}

function Txt({ x, y, size, family = COND, weight = 400, anchor = "start", fill = INK, max, field, k = K, children }: TxtProps) {
  const m = useContext(MeasureContext);
  if (!children) return null;
  const w = max ? m(children, family, weight, size) : 0;
  const sx = max && w > max ? max / w : 1;
  return (
    <text data-field={field} transform={`translate(${x} ${y}) scale(${sx} ${k})`} fontFamily={family} fontWeight={weight} fontSize={size} textAnchor={anchor} fill={fill}>
      {children}
    </text>
  );
}

/** Greedy word wrap to a width in template pixels; a word wider than the width stays on its own line. */
function wrapText(m: Measure, text: string, maxWidth: number, family: string, weight: number, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && m(next, family, weight, size) > maxWidth) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

interface GridProps {
  m: Measure;
  edges: number[];
  top: number;
  rows: string[][];
  limit: number;
  rowMin: number;
  pitch: number;
  firstBaseline: number;
  padX: number;
  size: number;
  line: number;
  field: string;
  /** y where the header ends (the template's, or the redrawn one) */
  bodyTop: number;
}

/** Body rows of a table with ruled cells. Returns the drawing and the y where the table ends. */
function Rows({ m, edges, rows, limit, rowMin, pitch, firstBaseline, padX, size, line, field, bodyTop }: GridProps): { node: ReactNode; bottom: number } {
  const out: ReactNode[] = [];
  let y = bodyTop;
  let shown = 0;
  for (const [ri, row] of rows.entries()) {
    const wrapped = row.map((cell, ci) => (cell ? wrapText(m, cell, edges[ci + 1] - edges[ci] - padX * 2, EXTRA, 400, size) : []));
    const h = Math.max(rowMin, Math.max(...wrapped.map((l) => l.length), 1) * pitch + 34);
    if (y + h > limit && shown > 0) {
      // not enough room: say so in the last row instead of dropping lines silently
      const left = rows.length - ri;
      out.push(
        <Txt key="more" x={edges[0] + padX} y={y + firstBaseline} size={size} family={EXTRA} weight={400} field={`${field}-more`}>{`+ ${left} more line${left === 1 ? "" : "s"}`}</Txt>,
      );
      y += rowMin;
      out.push(<rect key="more-line" x={edges[0]} y={y - line} width={edges.at(-1)! - edges[0]} height={line} fill={INK} />);
      break;
    }
    wrapped.forEach((lines, ci) =>
      lines.forEach((l, li) => out.push(<Txt key={`${ri}-${ci}-${li}`} x={edges[ci] + padX} y={y + firstBaseline + li * pitch} size={size} family={EXTRA} weight={400} field={`${field}-${ri}-${ci}`}>{l}</Txt>)),
    );
    y += h;
    out.push(<rect key={`line-${ri}`} x={edges[0]} y={y - line} width={edges.at(-1)! - edges[0]} height={line} fill={INK} />);
    shown += 1;
  }
  if (shown > 0) {
    for (const [ei, e] of edges.entries()) out.push(<rect key={`v-${ei}`} x={e - line / 2} y={bodyTop} width={line} height={y - bodyTop} fill={INK} />);
  }
  return { node: <>{out}</>, bottom: y };
}

interface Props {
  doc: Doc;
  /** QR image: the one stored on the voucher, else a generated one */
  qrSrc?: string | null;
  templateUrl?: string;
  /** draw immediately (tests); by default drawing waits for the fonts */
  ready?: boolean;
  className?: string;
}

export function VoucherDocument({ doc, qrSrc, templateUrl = TEMPLATE.url, ready, className }: Props) {
  const fontsReady = useVoucherFontsReady();
  const show = ready ?? fontsReady;
  const m: Measure = show ? measure : estimate;

  const manifestEdges = useMemo(() => {
    const total = MANIFEST.right - MANIFEST.left;
    let x = MANIFEST.left;
    const edges = [x];
    for (const share of MANIFEST.columns) edges.push((x += total * share));
    edges[edges.length - 1] = MANIFEST.right;
    return edges;
  }, []);

  const L = LEFT;
  const R = RIGHT;
  const rightFits = doc.rightLines.length > 1 ? Math.min(R.rightPitch, (R.linesLimit - R.firstLineBaseline) / (doc.rightLines.length - 1)) : R.rightPitch;
  const leftPitch = doc.leftLines.length > 1 ? Math.min(R.leftPitch, (R.linesLimit - R.firstLineBaseline) / (doc.leftLines.length - 1)) : R.leftPitch;

  const manifest = Rows({ m, edges: manifestEdges, top: MANIFEST.top, rows: doc.manifest, limit: MANIFEST.bottomLimit, rowMin: MANIFEST.rowMin, pitch: MANIFEST.linePitch, firstBaseline: MANIFEST.firstBaseline, padX: MANIFEST.padX, size: MANIFEST.textSize, line: MANIFEST.line, field: "manifest", bodyTop: MANIFEST.headerBottom });
  const pack = Rows({ m, edges: PACK.edges, top: PACK.top, rows: doc.pack, limit: PACK.bottomLimit, rowMin: PACK.rowMin, pitch: PACK.linePitch, firstBaseline: PACK.firstBaseline, padX: PACK.padX, size: PACK.textSize, line: PACK.line, field: "pack", bodyTop: PACK.top + 127 });

  // voucher note: long lines wrap (the label stays on the first line); what does not fit ends with an ellipsis
  const noteLines: Array<{ label?: string; text: string; bold?: boolean }> = [];
  for (const n of doc.note) {
    const weight = n.bold ? 700 : 500;
    const labelW = n.label ? m(`${n.label} `, SEMI, 700, NOTE.size) : 0;
    const parts = wrapText(m, n.text, NOTE.max - labelW, SEMI, weight, NOTE.size);
    // a first line that is only a label and a long word keeps going; later lines use the full width
    const rest = parts.length > 1 ? wrapText(m, parts.slice(1).join(" "), NOTE.max, SEMI, weight, NOTE.size) : [];
    noteLines.push({ label: n.label, text: parts[0], bold: n.bold });
    for (const l of rest) noteLines.push({ text: l, bold: n.bold });
  }
  const noteCapacity = Math.floor((NOTE.limit - NOTE.firstBaseline) / NOTE.pitch) + 1;
  if (noteLines.length > noteCapacity) {
    noteLines.length = noteCapacity;
    noteLines[noteCapacity - 1] = { ...noteLines[noteCapacity - 1], text: `${noteLines[noteCapacity - 1].text} …` };
  }

  // pill
  const pillText = doc.status?.text ?? "";
  const pillW = pillText ? m(pillText, SEMI, 500, L.pill.size) + L.pill.padX * 2 : 0;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${TEMPLATE.width} ${TEMPLATE.height}`}
      role="img"
      aria-label={doc.number ? `Voucher ${doc.number}` : "Voucher"}
      data-testid="voucher-document"
      data-number={doc.number}
      data-ready={show ? "true" : "false"}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "auto", background: WHITE }}
    >
      <image href={templateUrl} x={0} y={0} width={TEMPLATE.width} height={TEMPLATE.height} />
      {MASKS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}

      <MeasureContext.Provider value={m}>
      <g style={{ opacity: show ? 1 : 0 }}>
        {/* ---------------------------------------------------------- left column */}
        <Txt x={L.center} y={L.titleBaseline} size={L.titleSize} family={SEMI} weight={500} anchor="middle" max={L.titleMax} field="topTitle">{doc.topTitle}</Txt>
        <Txt x={L.center} y={L.barBaseline} size={L.barSize} family={SEMI} weight={700} anchor="middle" fill={WHITE} max={L.barMax} field="barText">{doc.barText}</Txt>
        <Txt x={L.numberX} y={L.numberBaseline} size={L.numberSize} family={COND} weight={700} max={330} field="number">{doc.number}</Txt>
        <Txt x={L.accrualRight} y={L.accrualBaseline} size={L.accrualSize} family={EXTRA} weight={700} anchor="end" max={300} field="accrual">{doc.accrual}</Txt>

        {doc.mark && (
          <g data-field="mark">
            <rect x={L.markLetter.x + L.markLetter.stroke / 2} y={L.markLetter.y + L.markLetter.stroke / 2} width={L.markLetter.w - L.markLetter.stroke} height={L.markLetter.h - L.markLetter.stroke} rx={L.markLetter.radius - L.markLetter.stroke / 2} fill={WHITE} stroke={NAVY} strokeWidth={L.markLetter.stroke} />
            <Txt x={L.markLetter.x + L.markLetter.w / 2} y={L.markLetter.baseline} size={L.markLetter.size} family={SEMI} weight={800} anchor="middle" fill={INK} max={92} field="markLetter">{doc.mark.letter}</Txt>
            <rect x={L.markCode.x} y={L.markCode.y} width={L.markCode.w} height={L.markCode.h} rx={L.markCode.radius} fill={NAVY} />
            <Txt x={L.markCode.x + L.markCode.w / 2} y={L.markCode.baseline} size={L.markCode.size} family={EXTRA} weight={800} anchor="middle" fill={WHITE} max={100} k={L.markCode.k} field="markCode">{doc.mark.code}</Txt>
          </g>
        )}
        {qrSrc && <image data-field="qr" href={qrSrc} x={L.qr.x} y={L.qr.y} width={L.qr.size} height={L.qr.size} preserveAspectRatio="xMidYMid meet" />}
        {doc.status && (
          <g data-field="status">
            <rect x={L.pill.x} y={L.pill.y} width={pillW} height={L.pill.h} rx={L.pill.h / 2} fill={doc.status.fill} />
            <Txt x={L.pill.x + pillW / 2} y={L.pill.baseline} size={L.pill.size} family={SEMI} weight={500} anchor="middle" fill={doc.status.color}>{doc.status.text}</Txt>
          </g>
        )}

        {/* ---------------------------------------------------- parties and references */}
        <Txt x={R.leftX} y={R.labelBaseline} size={R.labelSize} family={EXTRA} weight={600} field="leftLabel">{doc.leftLabel}</Txt>
        <Txt x={R.rightX} y={R.labelBaseline} size={R.labelSize} family={EXTRA} weight={600} field="rightLabel">{doc.rightLabel}</Txt>
        <Txt x={R.codeRight} y={R.codeBaseline} size={R.codeSize} family={COND} weight={400} anchor="end" max={300} field="issuedCode">{doc.issuedCode}</Txt>
        {doc.leftLines.map((l, i) => (
          <Txt key={i} x={R.leftLinesX} y={R.firstLineBaseline + i * leftPitch} size={R.leftLinesSize} family={COND} weight={400} max={R.leftLinesMax} field={`leftLine-${i}`}>{l}</Txt>
        ))}
        <Txt x={R.performCodeX} y={R.firstLineBaseline} size={R.performCodeSize} family={NORMAL} weight={400} max={170} field="performCode">{doc.performCode}</Txt>
        {doc.rightLines.length > 0 && <rect x={R.ruleX} y={R.ruleTop} width={3} height={R.ruleBottom - R.ruleTop} fill={INK} />}
        {doc.rightLines.map((l, i) => (
          <Txt key={i} x={R.rightLinesX} y={R.firstLineBaseline + i * rightFits} size={R.rightLinesSize} family={NORMAL} weight={400} max={R.rightLinesMax} field={`rightLine-${i}`}>{l}</Txt>
        ))}
        <Txt x={R.leftX + 4} y={R.refBaseline} size={R.ref1Size} family={SEMI} weight={600} max={R.ref1Max} field="ref1">{doc.ref1}</Txt>
        <Txt x={R.rightX + 4} y={R.refBaseline} size={R.ref2Size} family={SEMI} weight={600} max={R.ref2Max} field="ref2">{doc.ref2}</Txt>

        {/* ------------------------------------------------------------ manifest table */}
        <rect x={MANIFEST.left} y={MANIFEST.top} width={MANIFEST.right - MANIFEST.left} height={10} fill={INK} />
        <rect x={MANIFEST.left} y={MANIFEST.headerBottom - 4} width={MANIFEST.right - MANIFEST.left} height={4} fill={INK} />
        {manifestEdges.map((e, i) => (
          <rect key={i} x={e - 1.5} y={MANIFEST.top} width={3} height={MANIFEST.headerBottom - MANIFEST.top} fill={INK} />
        ))}
        {MANIFEST.headers.map((h, i) => (
          <Txt key={h} x={manifestEdges[i] + MANIFEST.padX} y={MANIFEST.headerBaseline} size={MANIFEST.headerSize} family={EXTRA} weight={700}>{h}</Txt>
        ))}
        {manifest.node}

        {/* ------------------------------------------------------------- pack table */}
        <Txt x={CAPTION.x} y={CAPTION.baseline} size={CAPTION.size} family={CAPTION.family} weight={400} field="caption">{doc.caption}</Txt>
        {pack.node}

        {/* --------------------------------------------------------- deliver via, resource */}
        {doc.via.map((l, i) => {
          const pitch = doc.via.length > 1 ? Math.min(DELIVER.pitch, (DELIVER.limit - DELIVER.firstBaseline) / (doc.via.length - 1)) : DELIVER.pitch;
          const first = i === 0 && l.bold;
          return (
            <Txt key={i} x={DELIVER.x} y={DELIVER.firstBaseline + i * pitch} size={first ? DELIVER.nameSize : l.bold ? DELIVER.phone2Size : DELIVER.phoneSize} family={first ? COND : SEMI} weight={first ? 600 : l.bold ? 600 : 500} max={DELIVER.right - DELIVER.x} field={`via-${i}`}>{l.text}</Txt>
          );
        })}
        <Txt x={DELIVER.right} y={DELIVER.resourceBaseline} size={DELIVER.valueSize} family={COND} weight={400} anchor="end" max={DELIVER.valueMax} field="resource">{doc.resource}</Txt>
        <Txt x={DELIVER.right} y={DELIVER.trackingBaseline} size={DELIVER.valueSize} family={COND} weight={400} anchor="end" max={DELIVER.valueMax} field="tracking">{doc.tracking}</Txt>

        {/* ------------------------------------------------------------ voucher note, terms */}
        {noteLines.map((n, i) => (
          <text key={i} data-field={`note-${i}`} transform={`translate(${NOTE.x} ${NOTE.firstBaseline + i * NOTE.pitch}) scale(1 ${K})`} fontFamily={SEMI} fontSize={NOTE.size} fill={INK}>
            {n.label && <tspan fontWeight={700}>{`${n.label} `}</tspan>}
            <tspan fontWeight={n.bold ? 700 : 500}>{n.text}</tspan>
          </text>
        ))}
        {doc.terms.map((t, i) => {
          const y = TERMS.firstBaseline + i * TERMS.pitch;
          return y > TERMS.limit ? null : (
            <Txt key={i} x={TERMS.center} y={y} size={TERMS.size} family={COND} weight={600} anchor="middle" max={TERMS.max} field={`terms-${i}`}>{t}</Txt>
          );
        })}
      </g>
      </MeasureContext.Provider>
    </svg>
  );
}
