import { describe, expect, it, vi } from "vitest";
import { getBulkSmsBdBalance, sendBulkSmsBd } from "./bulkSmsBd";

function response(body: string, status = 200) {
  return new Response(body, { status });
}

describe("BulkSMSBD adapter", () => {
  it("accepts provider code 202 without exposing credentials", async () => {
    const fetcher = vi.fn(async () => response("202"));
    const result = await sendBulkSmsBd({ apiKey: "secret", senderId: "sender", recipient: "8801712345678", body: "Dhrubok test" }, fetcher);
    expect(result).toEqual({ responseCode: "202", providerStatus: "SMS submitted successfully" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("classifies network and internal failures as retryable", async () => {
    const network = vi.fn(async () => { throw new Error("timeout"); });
    await expect(sendBulkSmsBd({ apiKey: "secret", senderId: "sender", recipient: "8801712345678", body: "Dhrubok" }, network)).rejects.toMatchObject({ code: "network_error", retryable: true });
    const internal = vi.fn(async () => response("1005"));
    await expect(sendBulkSmsBd({ apiKey: "secret", senderId: "sender", recipient: "8801712345678", body: "Dhrubok" }, internal)).rejects.toMatchObject({ code: "1005", retryable: true });
  });

  it("treats invalid numbers and insufficient balance as permanent", async () => {
    for (const code of ["1001", "1007"]) {
      const fetcher = vi.fn(async () => response(code));
      await expect(sendBulkSmsBd({ apiKey: "secret", senderId: "sender", recipient: "bad", body: "Dhrubok" }, fetcher)).rejects.toMatchObject({ code, retryable: false });
    }
  });

  it("parses the balance into minor units", async () => {
    const fetcher = vi.fn(async () => response("12.34"));
    await expect(getBulkSmsBdBalance("secret", fetcher)).resolves.toBe(1234);
  });
});
