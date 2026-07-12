export function normalizeEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid email address");
  }
  return normalized;
}

export function normalizeBangladeshPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("880") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^1[3-9]\d{8}$/.test(local)) {
    throw new Error("Invalid Bangladesh mobile number");
  }
  return `880${local}`;
}
