import { z } from "zod";

/**
 * 個案 (case) input shapes.
 * - case_type: `individual` is a real person and needs a 身分證字號; `event`
 *   (活動採購) and `meal_delivery` (便當外送) are bulk purchases not tied to a
 *   person, so id_number is optional for them (2026-07-03 立心 meeting).
 * - id_number = 身分證字號. Lenient (alphanumeric, up to 20) rather than a strict
 *   Taiwan-ID regex, since vulnerable individuals may hold ARC/居留證 numbers.
 *   Stored plaintext in v1; only the owning NGO can ever read it back, and the
 *   UI only ever shows the last 4 (see the `my_cases` view + column REVOKE).
 * - id_number is set at creation only (not editable) — it is never read back to
 *   the client, so the edit form covers name + note.
 */
const name = z.string().trim().min(1, "請輸入姓名").max(50, "姓名過長");
const note = z.string().trim().max(500, "備註過長").optional();

export const caseTypeSchema = z.enum(["individual", "event", "meal_delivery"]);
export type CaseType = z.infer<typeof caseTypeSchema>;

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  individual: "個人個案",
  event: "活動採購",
  meal_delivery: "便當外送",
};

export const caseCreateSchema = z
  .object({
    name,
    // Optional (no default) so the zod input/output types stay identical, which
    // keeps react-hook-form typing simple. Omitted / individual → treated as a
    // real person (id required); the form always sends an explicit value.
    case_type: caseTypeSchema.optional(),
    id_number: z
      .string()
      .trim()
      .max(20, "身分證字號過長")
      .regex(/^[A-Za-z0-9]*$/, "身分證字號只能包含英文與數字")
      .optional(),
    note,
  })
  .superRefine((val, ctx) => {
    // 身分證字號 is required only for a real person (individual / unspecified).
    const nonIndividual =
      val.case_type === "event" || val.case_type === "meal_delivery";
    if (!nonIndividual && (val.id_number ?? "").trim().length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["id_number"],
        message: "個人個案請輸入身分證字號（至少 4 碼）",
      });
    }
  });

export const caseEditSchema = z.object({ name, note });

export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
export type CaseEditInput = z.infer<typeof caseEditSchema>;
