import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("poll SMS provider balance", { hours: 6 }, internal.messaging.actions.pollBalance, {});
crons.interval("generate monthly charges", { hours: 24 }, internal.finance.actions.dailyBilling, {});
crons.daily("refresh operational summary", { hourUTC: 18, minuteUTC: 30 }, internal.reports.summaries.refreshToday, {});

export default crons;
