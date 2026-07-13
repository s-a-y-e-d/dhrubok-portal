import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "poll SMS provider balance",
  { hours: 6 },
  internal.messaging.actions.pollBalance,
  {},
);
crons.interval(
  "generate monthly charges",
  { hours: 24 },
  internal.finance.actions.dailyBilling,
  {},
);
crons.cron(
  "refresh operational summary",
  "30 18 * * *",
  internal.reports.summaries.refreshToday,
  {},
);
crons.cron(
  "refresh finance ageing",
  "15 18 * * *",
  internal.finance.receivables.startDailyRefresh,
  {},
);

export default crons;
