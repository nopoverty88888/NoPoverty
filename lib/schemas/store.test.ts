import { describe, it, expect } from "vitest";

import { storeInputSchema } from "./store";

describe("storeInputSchema", () => {
  it("accepts a full store (happy path)", () => {
    const result = storeInputSchema.safeParse({
      name: "阿明便當",
      address: "萬華區和平西路三段 100 號",
      contact: "02-1234-5678",
    });
    expect(result.success).toBe(true);
  });

  it("accepts name only (address/contact optional)", () => {
    expect(storeInputSchema.safeParse({ name: "阿明便當" }).success).toBe(true);
  });

  it("trims and rejects an empty name", () => {
    expect(storeInputSchema.safeParse({ name: "   " }).success).toBe(false);
  });
});
