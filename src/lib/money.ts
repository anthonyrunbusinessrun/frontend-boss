/**
 * Money is stored as integer cents everywhere in the accounting module so that
 * sums and the debit = credit check are exact (no floating point drift).
 */
export const toCents = (dollars: number): number => Math.round(dollars * 100);

/** Parse user input ("1,234.5", "$99") into cents. Returns null when it is not a valid amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(cents: number): string {
  return usdFormat.format(cents / 100);
}

/** $482,340 (no cents) for dashboard figures. */
export function formatMoneyWhole(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(cents / 100));
}

/** $482.3K / $1.2M for dashboard tiles. */
export function formatMoneyCompact(cents: number): string {
  const abs = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** "1234.50" for inputs and CSV files (no symbol, no grouping). */
export function formatPlain(cents: number): string {
  return (cents / 100).toFixed(2);
}
