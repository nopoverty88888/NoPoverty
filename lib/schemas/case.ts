import { z } from "zod";

/**
 * 個案 (case) input shapes.
 * - id_number = 身分證字號. Lenient (alphanumeric, 4–20) rather than a strict
 *   Taiwan-ID regex, since vulnerable individuals may hold ARC/居留證 numbers.
 *   Stored plaintext in v1; only the owning NGO can ever read it back, and the
 *   UI only ever shows the last 4 (see the `my_cases` view + column REVOKE).
 * - id_number is set at creation only (not editable) — it is never read back to
 *   the client, so the edit form covers name + note.
 */
const name = z.string().trim().min(1, "請輸入姓名").max(50, "姓名過長");
const note = z.string().trim().max(500, "備註過長").optional();

export const caseCreateSchema = z.object({
  name,
  id_number: z
    .string()
    .trim()
    .min(4, "請輸入身分證字號")
    .max(20, "身分證字號過長")
    .regex(/^[A-Za-z0-9]+$/, "身分證字號只能包含英文與數字"),
  note,
});

export const caseEditSchema = z.object({ name, note });

export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
export type CaseEditInput = z.infer<typeof caseEditSchema>;
