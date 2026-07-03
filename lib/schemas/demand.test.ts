import { describe, it, expect } from "vitest";

import {
  demandQuantitySchema,
  isYearMonth,
  currentYearMonth,
} from "./demand";

describe("demandQuantitySchema", () => {
  it("accepts a non-negative integer string", () => {
    expect(demandQuantitySchema.parse("5")).toBe(5);
  });
  it("treats empty as 0", () => {
    expect(demandQuantitySchema.parse("")).toBe(0);
  });
  it("rejects negatives", () => {
    expect(demandQuantitySchema.safeParse("-1").success).toBe(false);
  });
  it("rejects non-integers", () => {
    expect(demandQuantitySchema.safeParse("1.5").success).toBe(false);
  });
  it("rejects non-numeric text", () => {
    expect(demandQuantitySchema.safeParse("abc").success).toBe(false);
  });
});

describe("year-month helpers", () => {
  it("validates YYYY-MM", () => {
    expect(isYearMonth("2026-06")).toBe(true);
    expect(isYearMonth("2026-6")).toBe(false);
    expect(isYearMonth("June")).toBe(false);
  });
  it("formats the month in Asia/Taipei regardless of server TZ", () => {
    // unambiguous mid-day instant
    expect(currentYearMonth(new Date("2026-06-28T04:00:00Z"))).toBe("2026-06");
    // 2026-07-01 00:30 Taipei (UTC+8) = 2026-06-30 16:30 UTC → July
    expect(currentYearMonth(new Date("2026-06-30T16:30:00Z"))).toBe("2026-07");
    // 2026-06-30 23:30 Taipei = 2026-06-30 15:30 UTC → still June
    expect(currentYearMonth(new Date("2026-06-30T15:30:00Z"))).toBe("2026-06");
  });
});
