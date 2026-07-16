import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const DAY_MS = 86_400_000;

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00+06:00`).getUTCDay();
}

function dhakaTimestamp(date: string, minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return Date.parse(`${date}T${hours}:${mins}:00+06:00`);
}

export const materializeSchedules = internalMutation({
  args: { scheduleIds: v.array(v.id("batchSchedules")) },
  returns: v.number(),
  handler: async (ctx, { scheduleIds }) => {
    const today = dhakaToday();
    const through = addDays(today, 27);
    let created = 0;
    for (const scheduleId of scheduleIds.slice(0, 100)) {
      const schedule = await ctx.db.get("batchSchedules", scheduleId);
      if (!schedule || schedule.status !== "active") continue;
      const firstDate = schedule.effectiveFrom > today ? schedule.effectiveFrom : today;
      for (let date = firstDate; date <= through; date = addDays(date, 1)) {
        if (schedule.effectiveUntil && date > schedule.effectiveUntil) break;
        if (weekday(date) !== schedule.weekday) continue;
        const sessionKey = `schedule:${schedule._id}:${date}`;
        if (await ctx.db.query("classSessions").withIndex("by_sessionKey", (q) => q.eq("sessionKey", sessionKey)).unique()) continue;
        await ctx.db.insert("classSessions", {
          sessionKey,
          batchId: schedule.batchId,
          teacherId: schedule.teacherId,
          subjectId: schedule.subjectId,
          scheduleId: schedule._id,
          sessionDate: date,
          startsAt: dhakaTimestamp(date, schedule.startMinutes),
          endsAt: dhakaTimestamp(date, schedule.endMinutes),
          status: "scheduled",
          rosterCount: 0,
          createdAt: Date.now(),
        });
        created += 1;
      }
    }
    return created;
  },
});
