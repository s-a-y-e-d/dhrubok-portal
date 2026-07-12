const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type Fetcher = typeof fetch;

type SiteverifyResponse = {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
  "error-codes"?: unknown;
};

export async function verifyTurnstile(
  input: { secret: string; token: string; idempotencyKey: string; expectedAction?: string },
  fetcher: Fetcher = fetch,
) {
  if (!input.secret) throw new Error("Turnstile is not configured");
  if (!input.token.trim() || input.token.length > 2048) throw new Error("Invalid anti-spam challenge");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: input.secret, response: input.token, idempotency_key: input.idempotencyKey }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Anti-spam verification is temporarily unavailable");
    const result = await response.json() as SiteverifyResponse;
    if (result.success !== true) throw new Error("Invalid or expired anti-spam challenge");
    if (input.expectedAction && result.action !== input.expectedAction) throw new Error("Invalid anti-spam challenge action");
    return { hostname: typeof result.hostname === "string" ? result.hostname : null };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid")) throw error;
    throw new Error("Anti-spam verification is temporarily unavailable");
  } finally {
    clearTimeout(timeout);
  }
}
