import { z } from "zod";

/**
 * Input for creating an NGO account (W3). One NGO = one account: this creates
 * the NGO entity + its single NGO 代表 login together. Handled server-side by
 * the Admin API (service role), since creating an auth user can't be done from
 * the browser.
 */
export const createNgoAccountSchema = z.object({
  ngoName: z.string().trim().min(1, "請輸入 NGO 名稱").max(100, "名稱過長"),
  repName: z.string().trim().min(1, "請輸入代表姓名").max(50, "姓名過長"),
  repEmail: z
    .string()
    .trim()
    .min(1, "請輸入 Email")
    .email("Email 格式不正確")
    .max(200, "Email 過長"),
  // Optional: 立心 may set a memorable password to hand over, or leave blank to
  // auto-generate a secure one. Supabase requires ≥6 chars (bcrypt ≤72 bytes).
  password: z
    .string()
    .max(72, "密碼過長")
    .refine((v) => v.length === 0 || v.length >= 6, "密碼至少 6 碼")
    .optional(),
});

export type CreateNgoAccountInput = z.infer<typeof createNgoAccountSchema>;
