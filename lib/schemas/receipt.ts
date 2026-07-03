import { z } from "zod";

/** 收據 (receipt) form input — the photo file is handled separately. */
export const receiptInputSchema = z.object({
  received_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "請選擇收到日期"),
  amount: z.coerce
    .number()
    .int("金額須為整數")
    .min(1, "金額須大於 0")
    .max(10_000_000, "金額過大"),
});

export type ReceiptInput = z.infer<typeof receiptInputSchema>;
