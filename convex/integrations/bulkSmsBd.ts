export type BulkSmsBdResult = {
  providerStatus: string;
  responseCode: string;
};

export class BulkSmsBdError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

const ERROR_MESSAGES: Record<string, string> = {
  "1001": "Invalid number",
  "1002": "Sender ID is invalid or disabled",
  "1003": "Required SMS fields are missing",
  "1005": "BulkSMSBD internal error",
  "1006": "Balance validity is unavailable",
  "1007": "BulkSMSBD balance is insufficient",
  "1011": "BulkSMSBD user was not found",
  "1012": "Masking SMS must be sent in Bengali",
  "1013": "No gateway is configured for this sender ID",
  "1014": "Sender type is unavailable for this API key",
  "1015": "No valid gateway is configured for this sender ID",
  "1016": "Sender price information is unavailable",
  "1017": "Sender price information was not found",
  "1018": "BulkSMSBD account is disabled",
  "1019": "BulkSMSBD sender pricing is disabled",
  "1020": "BulkSMSBD parent account was not found",
  "1021": "BulkSMSBD parent pricing is unavailable",
  "1031": "BulkSMSBD account is not verified",
  "1032": "Server IP is not whitelisted",
};

function responseCode(text: string) {
  const trimmed = text.trim();
  if (/^\d{3,4}$/.test(trimmed)) return trimmed;
  try {
    const payload = JSON.parse(trimmed) as unknown;
    if (typeof payload === "number" || typeof payload === "string")
      return String(payload);
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const value = record.code ?? record.status ?? record.response_code;
      if (typeof value === "number" || typeof value === "string")
        return String(value);
    }
  } catch {
    // BulkSMSBD commonly returns a plain numeric response code.
  }
  const match = trimmed.match(/(?:^|\D)(202|10\d{2})(?:\D|$)/);
  return match?.[1] ?? "invalid_response";
}

function permanent(code: string) {
  return code !== "1005";
}

export async function sendBulkSmsBd(
  input: {
    apiKey: string;
    senderId: string;
    recipient: string;
    body: string;
  },
  fetcher: FetchLike = fetch,
): Promise<BulkSmsBdResult> {
  const form = new URLSearchParams({
    api_key: input.apiKey,
    senderid: input.senderId,
    number: input.recipient,
    message: input.body,
  });
  let response: Response;
  try {
    response = await fetcher("https://bulksmsbd.net/api/smsapi", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  } catch {
    throw new BulkSmsBdError(
      "BulkSMSBD request failed",
      "network_error",
      true,
    );
  }
  const text = await response.text();
  const code = responseCode(text);
  if (response.ok && code === "202")
    return { responseCode: code, providerStatus: "SMS submitted successfully" };
  if (code === "invalid_response")
    throw new BulkSmsBdError(
      `BulkSMSBD returned an invalid response (HTTP ${response.status})`,
      code,
      response.status >= 500,
    );
  throw new BulkSmsBdError(
    ERROR_MESSAGES[code] ?? `BulkSMSBD rejected the request with code ${code}`,
    code,
    !permanent(code),
  );
}

export async function getBulkSmsBdBalance(
  apiKey: string,
  fetcher: FetchLike = fetch,
) {
  const form = new URLSearchParams({ api_key: apiKey });
  let response: Response;
  try {
    response = await fetcher("https://bulksmsbd.net/api/getBalanceApi", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
  } catch {
    throw new BulkSmsBdError(
      "BulkSMSBD balance request failed",
      "network_error",
      true,
    );
  }
  const text = (await response.text()).trim();
  const balance = Number(text);
  if (!response.ok || !Number.isFinite(balance) || balance < 0)
    throw new BulkSmsBdError(
      "BulkSMSBD returned an invalid balance",
      "invalid_balance",
      response.status >= 500,
    );
  return Math.round(balance * 100);
}
