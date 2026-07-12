import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "./turnstile";

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("Turnstile verification", () => {
  it("accepts only a successful response with the admission action", async () => {
    const fetcher = vi.fn(async () => response({ success: true, action: "admission_submit", hostname: "portal.example" }));
    await expect(verifyTurnstile({ secret: "secret", token: "token", idempotencyKey: "key", expectedAction: "admission_submit" }, fetcher)).resolves.toEqual({ hostname: "portal.example" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects failed and wrong-action challenges", async () => {
    const failed = vi.fn(async () => response({ success: false, "error-codes": ["timeout-or-duplicate"] }));
    await expect(verifyTurnstile({ secret: "secret", token: "token", idempotencyKey: "key" }, failed)).rejects.toThrow("Invalid or expired");
    const wrongAction = vi.fn(async () => response({ success: true, action: "other" }));
    await expect(verifyTurnstile({ secret: "secret", token: "token", idempotencyKey: "key", expectedAction: "admission_submit" }, wrongAction)).rejects.toThrow("action");
  });
});
