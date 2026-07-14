export const courseViews = ["overview", "batches", "subjects-teachers", "schedule", "website"] as const;
export type CourseView = (typeof courseViews)[number];
export type CourseStatus = "active" | "draft" | "completed" | "archived";

export function validView(value: string | null): CourseView { return courseViews.includes(value as CourseView) ? value as CourseView : "overview"; }
export function validStatus(value: string | null): CourseStatus { return value === "draft" || value === "completed" || value === "archived" ? value : "active"; }
export function slugFrom(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); }
export function resolveSession<T extends { _id: string; startDate: string; endDate: string }>(sessions: T[], requested: string | null, remembered: string | null, today: string) {
  const byId = (id: string | null) => id ? sessions.find(row => row._id === id) : undefined;
  if (byId(requested)) return byId(requested)!;
  const current = sessions.filter(row => row.startDate <= today && row.endDate >= today);
  if (current.length > 1 && current.some(row => row._id === remembered)) return byId(remembered)!;
  if (current.length) return current[0];
  const rememberedRow = byId(remembered); if (rememberedRow) return rememberedRow;
  return [...sessions].sort((a, b) => { const aDistance = Math.abs(Date.parse(`${a.startDate > today ? a.startDate : a.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)); const bDistance = Math.abs(Date.parse(`${b.startDate > today ? b.startDate : b.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)); return aDistance - bDistance; })[0];
}
