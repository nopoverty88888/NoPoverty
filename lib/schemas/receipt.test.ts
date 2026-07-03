import { describe, it, expect } from "vitest";

import { receiptInputSchema } from "./receipt";

describe("receiptInputSchema", () => {
  it("accepts a valid receipt (happy path)", () => {
    expect(
      receiptInputSchema.safeParse({ received_date: "2026-06-29", amount: "1500" })
        .success,
    ).toBe(true);
  });
  it("coerces the amount to a number", () => {
    expect(
      receiptInputSchema.parse({ received_date: "2026-06-29", amount: "1500" })
        .amount,
    ).toBe(1500);
  });
  it("rejects a bad date", () => {
    expect(
      receiptInputSchema.safeParse({ received_date: "2026/6/29", amount: "100" })
        .success,
    ).toBe(false);
  });
  it("rejects amount <= 0", () => {
    expect(
      receiptInputSchema.safeParse({ received_date: "2026-06-29", amount: "0" })
        .success,
    ).toBe(false);
  });
});
