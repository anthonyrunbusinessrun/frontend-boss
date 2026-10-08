/** ISO calendar dates ("2026-09-30") handled in UTC so server and browser always agree. */
const MS_DAY = 86_400_000;

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && fromUtc(toUtc(v)) === v;
export const addDays = (iso: string, days: number) => fromUtc(toUtc(iso) + days * MS_DAY);
export const diffDays = (later: string, earlier: string) => Math.round((toUtc(later) - toUtc(earlier)) / MS_DAY);
export const monthKey = (iso: string) => iso.slice(0, 7);
export const startOfMonth = (iso: string) => `${iso.slice(0, 7)}-01`;
export const endOfMonth = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return fromUtc(Date.UTC(y, m, 0));
};
export const addMonths = (iso: string, n: number) => {
  const [y, m] = iso.split("-").map(Number);
  return fromUtc(Date.UTC(y, m - 1 + n, 1));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthShort = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthLong = (key: string) => `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

/** "Sep 30, 2026" */
export function formatDate(iso: string): string {
  if (!iso || !isIsoDate(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
