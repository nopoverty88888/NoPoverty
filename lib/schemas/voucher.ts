import { z } from "zod";

/** 流水號 — a voucher serial number: exactly 5 digits, no encoding. */
export const serialNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "流水號須為 5 位數字");

export type SerialNumber = z.infer<typeof serialNumberSchema>;

/**
 * 回收券張數 — how many NT$100 units a single physical voucher stands for. 1 for
 * an ordinary voucher; > 1 only when an NGO uses its own vouchers in bulk and
 * writes a count on one paper voucher (e.g. "20" = NT$2,000). Coerced so a form
 * <input> string ("20") validates; capped to catch obvious typos.
 */
export const collectionQuantitySchema = z.coerce
  .number()
  .int("張數須為整數")
  .min(1, "張數至少為 1")
  .max(999, "張數過大");
