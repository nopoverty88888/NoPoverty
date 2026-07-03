import { z } from "zod";

/**
 * 店家 (store) input shape — used by both create and edit (stores have no
 * immutable field). A store is owned by one NGO 代表 (owner_ngo_rep_id).
 */
export const storeInputSchema = z.object({
  name: z.string().trim().min(1, "請輸入店家名稱").max(100, "名稱過長"),
  address: z.string().trim().max(200, "地址過長").optional(),
  contact: z.string().trim().max(100, "聯絡資訊過長").optional(),
});

export type StoreInput = z.infer<typeof storeInputSchema>;
