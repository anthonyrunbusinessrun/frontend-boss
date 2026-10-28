import type { FieldDef, FieldOptions } from "./types";

/**
 * Sequential codes such as "A-4702". The server hands them out; these pure helpers define the format and the
 * rule for "next": one more than the highest number ever issued or still present, never the record count.
 */
export type SequenceSpec = NonNullable<FieldOptions["sequence"]>;

export function formatCode(seq: SequenceSpec, n: number): string {
  const digits = String(n);
  return `${seq.prefix}${seq.pad && digits.length < seq.pad ? digits.padStart(seq.pad, "0") : digits}`;
}

/** The number inside a code, or null when the code does not follow this sequence (e.g. a legacy "FL-12" in a "A-" sequence). */
export function parseCode(seq: SequenceSpec, code: unknown): number | null {
  if (typeof code !== "string" || !code.startsWith(seq.prefix)) return null;
  const rest = code.slice(seq.prefix.length);
  if (!/^[0-9]+$/.test(rest)) return null;
  const n = Number(rest);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Next number = max(counter, highest existing + 1). The counter remembers the highest number ever issued, so a
 * deleted last record never has its code reused; gaps left by deletions are never refilled.
 */
export function nextNumber(seq: SequenceSpec, existingCodes: Iterable<unknown>, counter: number | null): number {
  let max = 0;
  for (const c of existingCodes) {
    const n = parseCode(seq, c);
    if (n !== null && n > max) max = n;
  }
  return nextFromMax(max, counter);
}

/** Same rule when the database has already found the highest existing number. */
export function nextFromMax(highestExisting: number | null, counter: number | null): number {
  return Math.max(counter ?? 0, (highestExisting ?? 0) + 1, 1);
}

export const sequenceOf = (f: FieldDef): SequenceSpec | undefined => f.options.sequence;

/** Characters allowed in a sequence prefix: keeps it safe to use inside patterns. */
export const isValidPrefix = (p: string) => /^[A-Za-z0-9_-]{0,12}$/.test(p);
