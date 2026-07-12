import { describe, expect, it } from "vitest";
import { assertLocalDate, dueDateForMonth, isOverdue } from "./dates";
import { assertMinorUnits, percentageDiscount } from "./money";
import { normalizeBangladeshPhone, normalizeEmail } from "./normalization";

describe("domain primitives", () => {
  it("normalizes approved emails", () => {
    expect(normalizeEmail(" Student@Example.COM ")).toBe("student@example.com");
    expect(() => normalizeEmail("not-an-email")).toThrow("Invalid email");
  });

  it("normalizes Bangladesh mobile numbers", () => {
    expect(normalizeBangladeshPhone("01712-345678")).toBe("8801712345678");
    expect(normalizeBangladeshPhone("+880 1712 345678")).toBe("8801712345678");
    expect(() => normalizeBangladeshPhone("1234")).toThrow("Invalid Bangladesh");
  });

  it("enforces integer money and deterministic discounts", () => {
    expect(assertMinorUnits(150000)).toBe(150000);
    expect(percentageDiscount(150000, 1250)).toBe(18750);
    expect(() => assertMinorUnits(1.5)).toThrow("minor units");
  });

  it("uses due day 15 and becomes overdue on day 16", () => {
    const due = dueDateForMonth("2026-07", 15);
    expect(due).toBe("2026-07-15");
    expect(isOverdue("2026-07-15", due)).toBe(false);
    expect(isOverdue("2026-07-16", due)).toBe(true);
    expect(() => assertLocalDate("2026-02-30")).toThrow("Invalid calendar date");
  });
});
