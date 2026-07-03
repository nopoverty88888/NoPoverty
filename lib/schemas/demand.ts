import { z } from "zod";

/** A single store's requested voucher count for a month (張數). Empty → 0. */
export const demandQuantitySchema = z.coerce
  .number()
  .int("請輸入整數")
  .min(0, "不能為負數")
  .max(100000, "數量過大");

export type DemandQuantity = z.infer<typeof demandQuantitySchema>;

/** Validates a 'YYYY-MM' string. */
export function isYearMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

/** The month after a 'YYYY-MM' string, e.g. "2026-12" → "2027-01". */
export function nextYearMonth(value: string): string {
  const [y, m] = value.split("-").map(Number);
  // Date month is 0-based, so passing `m` (1-based) lands on the next month.
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Current month as 'YYYY-MM', computed in **Asia/Taipei** regardless of the
 * server's timezone. (Taiwan-only app; a UTC server would otherwise flip the
 * month 8h late and misfile month-scoped voucher data at each cycle boundary.)
 */
export function currentYearMonth(now: Date): string {
  // en-CA formats as YYYY-MM-DD; slice off the day.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .slice(0, 7);
}
