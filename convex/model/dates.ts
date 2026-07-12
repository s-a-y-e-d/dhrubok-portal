const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertLocalDate(value: string) {
  if (!DATE_RE.test(value)) throw new Error("Date must use YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Invalid calendar date");
  }
  return value;
}

export function dueDateForMonth(periodKey: string, dueDay: number) {
  if (!/^\d{4}-\d{2}$/.test(periodKey)) throw new Error("Period must use YYYY-MM");
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) throw new Error("Due day must be between 1 and 28");
  return `${periodKey}-${String(dueDay).padStart(2, "0")}`;
}

export function isOverdue(localDate: string, dueDate: string) {
  assertLocalDate(localDate);
  assertLocalDate(dueDate);
  return localDate > dueDate;
}

export function dhakaDate(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}
