import { describe, expect, it, vi } from "vitest";
import { ownerErrorResult, parseOwnerUserError } from "./owner-errors";

describe("owner error contract", () => {
  it("parses a structured Convex payload and maps its field", () => {
    expect(ownerErrorResult(new Error('Uncaught Error: {"code":"DUPLICATE_EMAIL","field":"email"} Called by client'), "en")).toEqual({ summary: "This email is already used by another account.", fieldErrors: { email: "This email is already used by another account." }, isKnown: true });
  });
  it("accepts nested field paths and uses the Bangla catalogue", () => {
    expect(ownerErrorResult({ data: { code: "REQUIRED_FIELD", field: "enrolments.0.firstBillingMonth" } }, "bn").fieldErrors["enrolments.0.firstBillingMonth"]).toBe("এই তথ্যটি প্রয়োজন।");
  });
  it("maps a same-batch validation error to actionable copy", () => {
    expect(ownerErrorResult({ data: { code: "SAME_BATCH" } }, "en").summary).toBe("Choose a batch different from the current one.");
  });
  it("rejects malformed or unknown payloads without exposing their message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(parseOwnerUserError(new Error('{"code":3}'))).toBeNull();
    expect(ownerErrorResult(new Error("Request ID abc: Server Error"), "en")).toEqual({ summary: "The operation could not be completed. Please try again.", fieldErrors: {}, isKnown: false });
    expect(log).toHaveBeenCalled();
  });
});
