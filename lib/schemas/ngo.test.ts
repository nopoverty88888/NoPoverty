import { describe, it, expect } from "vitest";

import { createNgoAccountSchema } from "./ngo";

describe("createNgoAccountSchema", () => {
  it("accepts a valid NGO account (happy path)", () => {
    const result = createNgoAccountSchema.safeParse({
      ngoName: "勵馨基金會",
      repName: "陳代表",
      repEmail: "rep@example.org",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(
      createNgoAccountSchema.safeParse({
        ngoName: "勵馨基金會",
        repName: "陳代表",
        repEmail: "not-an-email",
      }).success,
    ).toBe(false);
  });

  it("rejects an empty NGO name", () => {
    expect(
      createNgoAccountSchema.safeParse({
        ngoName: "  ",
        repName: "陳代表",
        repEmail: "rep@example.org",
      }).success,
    ).toBe(false);
  });
});
