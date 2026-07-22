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
  "materialize monthly fees",
  { hours: 24 },
  internal.fees.actions.dailyMaterialization,
  {},
);
crons.interval(
  "extend class occurrence window",
  { hours: 24 },
  internal.academics.classOccurrenceMaterializer.materializeActiveSchedules,
  {},
);
crons.cron(
  "refresh operational summary",
  "30 18 * * *",
  internal.reports.summaries.refreshToday,
  {},
);
crons.cron(
  "automatic monthly due reminders",
  "0 13 * * *",
  internal.finance.campaigns.runAutomaticDueReminders,
  {},
);
export default crons;
