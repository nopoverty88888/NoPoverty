import { describe, it, expect } from "vitest";

import { caseCreateSchema, caseEditSchema } from "./case";

describe("caseCreateSchema", () => {
  it("accepts a valid case (happy path)", () => {
    const result = caseCreateSchema.safeParse({
      name: "王小明",
      id_number: "A123456789",
      note: "獨居長者",
    });
    expect(result.success).toBe(true);
  });

  it("treats note as optional", () => {
    const result = caseCreateSchema.safeParse({
      name: "王小明",
      id_number: "A123456789",
    });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace", () => {
    const parsed = caseCreateSchema.parse({
      name: "  王小明  ",
      id_number: " A123456789 ",
    });
    expect(parsed.name).toBe("王小明");
    expect(parsed.id_number).toBe("A123456789");
  });

  it("rejects an empty name", () => {
    expect(
      caseCreateSchema.safeParse({ name: "", id_number: "A123456789" }).success,
    ).toBe(false);
  });

  it("rejects an id_number that is too short", () => {
    expect(
      caseCreateSchema.safeParse({ name: "王小明", id_number: "12" }).success,
    ).toBe(false);
  });

  it("rejects an id_number with symbols", () => {
    expect(
      caseCreateSchema.safeParse({ name: "王小明", id_number: "A12-456" })
        .success,
    ).toBe(false);
  });
});

describe("caseEditSchema", () => {
  it("accepts name + note without an id_number", () => {
    expect(
      caseEditSchema.safeParse({ name: "王小明", note: "更新備註" }).success,
    ).toBe(true);
  });
});
