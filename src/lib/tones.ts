import type { CSSProperties } from "react";

/**
 * Badge / pill / tag palette. Backgrounds and text colours were sampled
 * directly from the supplied screens.
 */
export interface Tone {
  bg: string;
  fg: string;
  border?: string;
}

export const TONES = {
  // Profile type, action status
  agent: { bg: "#7b5ea7", fg: "#f2f5fa" },
  rep: { bg: "#cf0e38", fg: "#ffffff" },
  ongoing: { bg: "#cf0e38", fg: "#ffffff" },
  queue: { bg: "#7b5ea7", fg: "#f2f5fa" },
  scheduled: { bg: "#7b5ea7", fg: "#f2f5fa" },
  // Action type
  tasking: { bg: "#172554", fg: "#60a5fa" },
  training: { bg: "#431407", fg: "#fb923c" },
  notice: { bg: "#3b2000", fg: "#fcd34d" },
  // Multi-value chips (folios, key features, attachments)
  chip: { bg: "#7b5ea7", fg: "#f2f5fa" },
  // Form tags
  work: { bg: "#1b5e20", fg: "#c8e6c9" },
  buy: { bg: "#1b5e20", fg: "#c8e6c9" },
  blanket: { bg: "#004d40", fg: "#b2dfdb" },
  // Group-header count badges
  countRed: { bg: "#cf0e38", fg: "#ffffff" },
  countGreen: { bg: "#0a7d5f", fg: "#6ee7b7" },
  countPurple: { bg: "#1e1b4b", fg: "#c4b5fd" },
  countBlue: { bg: "#1a3a7a", fg: "#5a9fca" },
  countMuted: { bg: "rgba(207, 14, 56, 0.22)", fg: "#ff4d6a" },
  // Vouchers
  voucherLabel: { bg: "#a5274d", fg: "#ffd1db" },
  // Transactions account
  acct: { bg: "#1e1b4b", fg: "#c4b5fd" },
  // Items
  purchased: { bg: "#064030", fg: "#2ecc8e" },
  kitAlpha: { bg: "#162040", fg: "#60a5fa" },
  kitBeta: { bg: "#162040", fg: "#60a5fa" },
  kitGamma: { bg: "#2d1a6e", fg: "#a78bfa" },
  kitDelta: { bg: "#0c3a50", fg: "#67e8f9" },
  // Concepts
  course: { bg: "#064e3b", fg: "#34d399" },
  xmind: { bg: "#0d2a6b", fg: "#7eb3e0" },
  workRef: { bg: "#0d1b2e", fg: "#5a9fca", border: "#1e3a5f" },
  // Leads (outlined)
  solicitation: { bg: "#0b213c", fg: "#90caf9", border: "#3b82c4" },
  sourcesSought: { bg: "#251b1a", fg: "#ffb74d", border: "#c2410c" },
  combined: { bg: "#0f2429", fg: "#81c784", border: "#2e7d32" },
  rfi: { bg: "#161030", fg: "#e1bee7", border: "#7b1fa2" },
  // Registries
  comingDue: { bg: "#3d2b1e", fg: "#f59e0b" },
  current: { bg: "#1b3b2b", fg: "#52d18d" },
  // Billing text on near-transparent pill
  billing: { bg: "rgba(255, 255, 255, 0.03)", fg: "#cf0e38" },
} as const satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

export function toneStyle(name: ToneName): CSSProperties {
  const t: Tone = TONES[name];
  return {
    background: t.bg,
    color: t.fg,
    ...(t.border ? { borderColor: t.border } : {}),
  };
}
