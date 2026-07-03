import { describe, it, expect } from "vitest";

import { serialNumberSchema } from "./voucher";

describe("serialNumberSchema", () => {
  it("accepts a 5-digit serial (happy path)", () => {
    expect(serialNumberSchema.parse("27031")).toBe("27031");
  });
  it("trims surrounding whitespace", () => {
    expect(serialNumberSchema.parse("  27031  ")).toBe("27031");
  });
  it("rejects fewer than 5 digits", () => {
    expect(serialNumberSchema.safeParse("2703").success).toBe(false);
  });
  it("rejects more than 5 digits", () => {
    expect(serialNumberSchema.safeParse("270311").success).toBe(false);
  });
  it("rejects non-numeric characters", () => {
    expect(serialNumberSchema.safeParse("2703a").success).toBe(false);
  });
});
