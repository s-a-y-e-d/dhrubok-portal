export function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid email address");
  }
  return normalized;
}

const digitMap: Record<string, string> = {
  "\u09e6": "0",
  "\u09e7": "1",
  "\u09e8": "2",
  "\u09e9": "3",
  "\u09ea": "4",
  "\u09eb": "5",
  "\u09ec": "6",
  "\u09ed": "7",
  "\u09ee": "8",
  "\u09ef": "9",
  "\u0660": "0",
  "\u0661": "1",
  "\u0662": "2",
  "\u0663": "3",
  "\u0664": "4",
  "\u0665": "5",
  "\u0666": "6",
  "\u0667": "7",
  "\u0668": "8",
  "\u0669": "9",
  "\u06f0": "0",
  "\u06f1": "1",
  "\u06f2": "2",
  "\u06f3": "3",
  "\u06f4": "4",
  "\u06f5": "5",
  "\u06f6": "6",
  "\u06f7": "7",
  "\u06f8": "8",
  "\u06f9": "9",
};

function asciiDigits(value: string) {
  return value.replace(
    /[\u09e6-\u09ef\u0660-\u0669\u06f0-\u06f9]/g,
    (digit) => digitMap[digit] ?? digit,
  );
}

export function normalizeBangladeshPhone(value: string) {
  const digits = asciiDigits(value).replace(/\D/g, "");
  const withoutCountryCode = digits.startsWith("880") ? digits.slice(3) : digits;
  const local = withoutCountryCode.startsWith("0")
    ? withoutCountryCode.slice(1)
    : withoutCountryCode;
  if (!/^1[3-9]\d{8}$/.test(local)) {
    throw new Error("Invalid Bangladesh mobile number");
  }
  return `880${local}`;
}
