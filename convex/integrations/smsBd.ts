export type SmsProviderResult = { requestId: string; providerStatus: string };
export type SmsReportResult = { status: "sent" | "delivered" | "failed" | "pending"; providerStatus: string; chargeMinor?: number };

export class SmsProviderError extends Error {
  constructor(message: string, public readonly code: string, public readonly retryable: boolean) {
    super(message);
  }
}

type FetchLike = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SmsProviderError("Invalid SMS provider response", "invalid_response", true);
  return value as Record<string, unknown>;
}

function providerError(payload: Record<string, unknown>, status: number) {
  const message = typeof payload.msg === "string" ? payload.msg : `SMS provider returned HTTP ${status}`;
  const normalized = message.toLowerCase();
  const permanent = normalized.includes("invalid") || normalized.includes("number") || normalized.includes("blocked") || normalized.includes("content") || normalized.includes("balance");
  return new SmsProviderError(message, permanent ? "provider_rejected" : "provider_unavailable", !permanent);
}

async function parseJson(response: Response) {
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new SmsProviderError("SMS provider returned invalid JSON", "invalid_json", response.status >= 500); }
  return asRecord(payload);
}

export async function sendSmsBd(input: { apiKey: string; recipient: string; body: string; senderId?: string }, fetcher: FetchLike = fetch): Promise<SmsProviderResult> {
  const form = new URLSearchParams({ api_key: input.apiKey, msg: input.body, to: input.recipient });
  if (input.senderId) form.set("sender_id", input.senderId);
  let response: Response;
  try {
    response = await fetcher("https://api.sms.net.bd/sendsms", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  } catch { throw new SmsProviderError("SMS provider request failed", "network_error", true); }
  const payload = await parseJson(response);
  if (!response.ok || String(payload.error) !== "0") throw providerError(payload, response.status);
  const data = asRecord(payload.data);
  if (typeof data.request_id !== "string" && typeof data.request_id !== "number") throw new SmsProviderError("SMS provider response is missing request_id", "invalid_response", true);
  return { requestId: String(data.request_id), providerStatus: typeof payload.msg === "string" ? payload.msg : "Accepted" };
}

export async function getSmsBdReport(input: { apiKey: string; requestId: string }, fetcher: FetchLike = fetch): Promise<SmsReportResult> {
  const url = new URL(`https://api.sms.net.bd/report/request/${encodeURIComponent(input.requestId)}/`);
  url.searchParams.set("api_key", input.apiKey);
  let response: Response;
  try { response = await fetcher(url, { method: "GET" }); } catch { throw new SmsProviderError("SMS report request failed", "network_error", true); }
  const payload = await parseJson(response);
  if (!response.ok || String(payload.error) !== "0") throw providerError(payload, response.status);
  const data = asRecord(payload.data);
  const recipients = Array.isArray(data.recipients) ? data.recipients : [];
  const recipient = recipients.length > 0 ? asRecord(recipients[0]) : {};
  const raw = String(recipient.status ?? data.request_status ?? "pending");
  const normalized = raw.toLowerCase();
  const status = normalized.includes("deliver") ? "delivered" : normalized === "sent" || normalized.includes("complete") ? "sent" : normalized.includes("fail") || normalized.includes("reject") ? "failed" : "pending";
  const chargeText = recipient.charge ?? data.request_charge;
  const charge = typeof chargeText === "string" || typeof chargeText === "number" ? Number(chargeText) : Number.NaN;
  return { status, providerStatus: raw, ...(Number.isFinite(charge) ? { chargeMinor: Math.round(charge * 100) } : {}) };
}

export async function getSmsBdBalance(apiKey: string, fetcher: FetchLike = fetch) {
  const url = new URL("https://api.sms.net.bd/user/balance/");
  url.searchParams.set("api_key", apiKey);
  let response: Response;
  try { response = await fetcher(url, { method: "GET" }); } catch { throw new SmsProviderError("SMS balance request failed", "network_error", true); }
  const payload = await parseJson(response);
  if (!response.ok || String(payload.error) !== "0") throw providerError(payload, response.status);
  const data = asRecord(payload.data);
  const balance = Number(data.balance);
  if (!Number.isFinite(balance) || balance < 0) throw new SmsProviderError("SMS provider returned invalid balance", "invalid_response", true);
  return Math.round(balance * 100);
}
