import { z } from "zod";

/** 流水號 — a voucher serial number: exactly 5 digits, no encoding. */
export const serialNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{5}$/, "流水號須為 5 位數字");

export type SerialNumber = z.infer<typeof serialNumberSchema>;
