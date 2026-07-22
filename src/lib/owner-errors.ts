export type OwnerErrorLocale = "bn" | "en";
export type OwnerUserError = { code: string; field?: string; details?: Record<string, string | number | boolean> };
export type ParsedOwnerError = { summary: string; fieldErrors: Record<string, string>; isKnown: boolean };

type Message = { bn: string; en: string };
const messages: Record<string, Message> = {
  DUPLICATE_EMAIL: { bn: "এই ইমেইলটি ইতিমধ্যে অন্য একটি অ্যাকাউন্টে ব্যবহৃত হচ্ছে।", en: "This email is already used by another account." },
  INVALID_EMAIL: { bn: "একটি বৈধ ইমেইল ঠিকানা দিন।", en: "Enter a valid email address." },
  REQUIRED_FIELD: { bn: "এই তথ্যটি প্রয়োজন।", en: "This field is required." },
  INVALID_CODE: { bn: "কোডটি সঠিক নয়।", en: "The code is invalid." },
  SCHEDULE_CONFLICT: { bn: "নির্বাচিত সময়সূচির সঙ্গে একটি সংঘর্ষ আছে।", en: "The selected schedule conflicts with an existing schedule." },
  RECORD_NOT_EDITABLE: { bn: "এই রেকর্ডটি আর পরিবর্তন করা যাবে না।", en: "This record can no longer be changed." },
  LAST_ACTIVE_OWNER: { bn: "সর্বশেষ সক্রিয় মালিকের অ্যাকাউন্ট পরিবর্তন করা যাবে না।", en: "The last active owner account cannot be changed." },
  INVALID_VALUE: { bn: "তথ্যটি সঠিক নয়।", en: "The value is invalid." },
};
const fallback: Message = { bn: "কাজটি সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।", en: "The operation could not be completed. Please try again." };

function isDetails(value: unknown): value is Record<string, string | number | boolean> {
  return Boolean(value) && typeof value === "object" && Object.values(value as Record<string, unknown>).every((item) => ["string", "number", "boolean"].includes(typeof item));
}

export function parseOwnerUserError(cause: unknown): OwnerUserError | null {
  const candidates: unknown[] = [];
  if (cause && typeof cause === "object") {
    candidates.push(cause);
    if ("data" in cause) candidates.push((cause as { data?: unknown }).data);
  }
  const message = cause instanceof Error ? cause.message : "";
  for (const match of message.matchAll(/\{\s*"code"\s*:\s*"[A-Z0-9_]+"[\s\S]*?\}/g)) {
    try { candidates.push(JSON.parse(match[0])); } catch { /* malformed payload */ }
  }
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const value = candidate as { code?: unknown; field?: unknown; details?: unknown };
    if (typeof value.code !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(value.code)) continue;
    if (value.field !== undefined && typeof value.field !== "string") continue;
    if (value.details !== undefined && !isDetails(value.details)) continue;
    return { code: value.code, ...(value.field ? { field: value.field } : {}), ...(value.details ? { details: value.details } : {}) };
  }
  return null;
}

export function ownerErrorResult(cause: unknown, locale: OwnerErrorLocale): ParsedOwnerError {
  const parsed = parseOwnerUserError(cause);
  const message = parsed ? messages[parsed.code] : undefined;
  if (!parsed || !message) {
    console.error("Unexpected owner mutation failure", cause);
    return { summary: fallback[locale], fieldErrors: {}, isKnown: false };
  }
  const text = message[locale];
  return { summary: text, fieldErrors: parsed.field ? { [parsed.field]: text } : {}, isKnown: true };
}
