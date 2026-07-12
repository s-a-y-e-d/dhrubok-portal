import { describe, expect, it, vi } from "vitest";
import { getSmsBdBalance, getSmsBdReport, sendSmsBd } from "./smsBd";

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }

describe("SMS.BD adapter", () => {
  it("stores an accepted request id without exposing the API key in results", async () => {
    const fetcher = vi.fn(async () => response({ error: 0, msg: "Request successfully submitted", data: { request_id: 1234 } }));
    const result = await sendSmsBd({ apiKey: "secret", recipient: "8801712345678", body: "Dhrubok test" }, fetcher);
    expect(result).toEqual({ requestId: "1234", providerStatus: "Request successfully submitted" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("classifies timeout/network failures as retryable", async () => {
    const fetcher = vi.fn(async () => { throw new Error("timeout"); });
    await expect(sendSmsBd({ apiKey: "secret", recipient: "8801712345678", body: "Dhrubok" }, fetcher)).rejects.toMatchObject({ code: "network_error", retryable: true });
  });

  it("maps final report and balance charge values to minor units", async () => {
    const reportFetch = vi.fn(async () => response({ error: 0, msg: "Success", data: { request_status: "Complete", request_charge: "0.50", recipients: [{ status: "Delivered", charge: "0.50" }] } }));
    await expect(getSmsBdReport({ apiKey: "secret", requestId: "1" }, reportFetch)).resolves.toEqual({ status: "delivered", providerStatus: "Delivered", chargeMinor: 50 });
    const balanceFetch = vi.fn(async () => response({ error: 0, data: { balance: "12.34" } }));
    await expect(getSmsBdBalance("secret", balanceFetch)).resolves.toBe(1234);
  });

  it("treats invalid-number rejection as permanent", async () => {
    const fetcher = vi.fn(async () => response({ error: 1, msg: "Invalid number" }, 400));
    await expect(sendSmsBd({ apiKey: "secret", recipient: "bad", body: "Dhrubok" }, fetcher)).rejects.toEqual(expect.objectContaining({ retryable: false }));
  });
});
