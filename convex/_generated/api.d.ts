/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academics_assignments from "../academics/assignments.js";
import type * as academics_batches from "../academics/batches.js";
import type * as academics_courseReadiness from "../academics/courseReadiness.js";
import type * as academics_courseSnapshots from "../academics/courseSnapshots.js";
import type * as academics_courseWorkspace from "../academics/courseWorkspace.js";
import type * as academics_courses from "../academics/courses.js";
import type * as academics_options from "../academics/options.js";
import type * as academics_public from "../academics/public.js";
import type * as academics_readModels from "../academics/readModels.js";
import type * as academics_schedules from "../academics/schedules.js";
import type * as academics_sessions from "../academics/sessions.js";
import type * as academics_shared from "../academics/shared.js";
import type * as academics_snapshotHooks from "../academics/snapshotHooks.js";
import type * as academics_subjects from "../academics/subjects.js";
import type * as academics_teachers from "../academics/teachers.js";
import type * as accounts from "../accounts.js";
import type * as admissions_actions from "../admissions/actions.js";
import type * as admissions_model from "../admissions/model.js";
import type * as admissions_owner from "../admissions/owner.js";
import type * as admissions_public from "../admissions/public.js";
import type * as admissions_turnstile from "../admissions/turnstile.js";
import type * as attendance_functions from "../attendance/functions.js";
import type * as crons from "../crons.js";
import type * as devSeedData from "../devSeedData.js";
import type * as devTesting from "../devTesting.js";
import type * as exams_assignments from "../exams/assignments.js";
import type * as exams_audience from "../exams/audience.js";
import type * as exams_diagnostics from "../exams/diagnostics.js";
import type * as exams_exams from "../exams/exams.js";
import type * as exams_functions from "../exams/functions.js";
import type * as exams_marks from "../exams/marks.js";
import type * as exams_migrations from "../exams/migrations.js";
import type * as exams_model from "../exams/model.js";
import type * as exams_publication from "../exams/publication.js";
import type * as exams_review from "../exams/review.js";
import type * as exams_studentResults from "../exams/studentResults.js";
import type * as exams_subjects from "../exams/subjects.js";
import type * as exams_validators from "../exams/validators.js";
import type * as finance_actions from "../finance/actions.js";
import type * as finance_campaigns from "../finance/campaigns.js";
import type * as finance_functions from "../finance/functions.js";
import type * as finance_imports from "../finance/imports.js";
import type * as finance_model from "../finance/model.js";
import type * as finance_operations from "../finance/operations.js";
import type * as finance_receivables from "../finance/receivables.js";
import type * as integrations_smsBd from "../integrations/smsBd.js";
import type * as materials_functions from "../materials/functions.js";
import type * as materials_shared from "../materials/shared.js";
import type * as messaging_actions from "../messaging/actions.js";
import type * as messaging_functions from "../messaging/functions.js";
import type * as messaging_model from "../messaging/model.js";
import type * as messaging_templateFunctions from "../messaging/templateFunctions.js";
import type * as messaging_templates from "../messaging/templates.js";
import type * as migrations from "../migrations.js";
import type * as model_audit from "../model/audit.js";
import type * as model_auth from "../model/auth.js";
import type * as model_dates from "../model/dates.js";
import type * as model_identifiers from "../model/identifiers.js";
import type * as model_money from "../model/money.js";
import type * as model_normalization from "../model/normalization.js";
import type * as model_validators from "../model/validators.js";
import type * as notices_functions from "../notices/functions.js";
import type * as notices_shared from "../notices/shared.js";
import type * as publicSite_cms from "../publicSite/cms.js";
import type * as publicSite_public from "../publicSite/public.js";
import type * as publicSite_shared from "../publicSite/shared.js";
import type * as reports_academic from "../reports/academic.js";
import type * as reports_dashboards from "../reports/dashboards.js";
import type * as reports_exams from "../reports/exams.js";
import type * as reports_exports from "../reports/exports.js";
import type * as reports_finance from "../reports/finance.js";
import type * as reports_operations from "../reports/operations.js";
import type * as reports_shared from "../reports/shared.js";
import type * as reports_summaries from "../reports/summaries.js";
import type * as settings from "../settings.js";
import type * as status from "../status.js";
import type * as students_model from "../students/model.js";
import type * as students_owner from "../students/owner.js";
import type * as students_self from "../students/self.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "academics/assignments": typeof academics_assignments;
  "academics/batches": typeof academics_batches;
  "academics/courseReadiness": typeof academics_courseReadiness;
  "academics/courseSnapshots": typeof academics_courseSnapshots;
  "academics/courseWorkspace": typeof academics_courseWorkspace;
  "academics/courses": typeof academics_courses;
  "academics/options": typeof academics_options;
  "academics/public": typeof academics_public;
  "academics/readModels": typeof academics_readModels;
  "academics/schedules": typeof academics_schedules;
  "academics/sessions": typeof academics_sessions;
  "academics/shared": typeof academics_shared;
  "academics/snapshotHooks": typeof academics_snapshotHooks;
  "academics/subjects": typeof academics_subjects;
  "academics/teachers": typeof academics_teachers;
  accounts: typeof accounts;
  "admissions/actions": typeof admissions_actions;
  "admissions/model": typeof admissions_model;
  "admissions/owner": typeof admissions_owner;
  "admissions/public": typeof admissions_public;
  "admissions/turnstile": typeof admissions_turnstile;
  "attendance/functions": typeof attendance_functions;
  crons: typeof crons;
  devSeedData: typeof devSeedData;
  devTesting: typeof devTesting;
  "exams/assignments": typeof exams_assignments;
  "exams/audience": typeof exams_audience;
  "exams/diagnostics": typeof exams_diagnostics;
  "exams/exams": typeof exams_exams;
  "exams/functions": typeof exams_functions;
  "exams/marks": typeof exams_marks;
  "exams/migrations": typeof exams_migrations;
  "exams/model": typeof exams_model;
  "exams/publication": typeof exams_publication;
  "exams/review": typeof exams_review;
  "exams/studentResults": typeof exams_studentResults;
  "exams/subjects": typeof exams_subjects;
  "exams/validators": typeof exams_validators;
  "finance/actions": typeof finance_actions;
  "finance/campaigns": typeof finance_campaigns;
  "finance/functions": typeof finance_functions;
  "finance/imports": typeof finance_imports;
  "finance/model": typeof finance_model;
  "finance/operations": typeof finance_operations;
  "finance/receivables": typeof finance_receivables;
  "integrations/smsBd": typeof integrations_smsBd;
  "materials/functions": typeof materials_functions;
  "materials/shared": typeof materials_shared;
  "messaging/actions": typeof messaging_actions;
  "messaging/functions": typeof messaging_functions;
  "messaging/model": typeof messaging_model;
  "messaging/templateFunctions": typeof messaging_templateFunctions;
  "messaging/templates": typeof messaging_templates;
  migrations: typeof migrations;
  "model/audit": typeof model_audit;
  "model/auth": typeof model_auth;
  "model/dates": typeof model_dates;
  "model/identifiers": typeof model_identifiers;
  "model/money": typeof model_money;
  "model/normalization": typeof model_normalization;
  "model/validators": typeof model_validators;
  "notices/functions": typeof notices_functions;
  "notices/shared": typeof notices_shared;
  "publicSite/cms": typeof publicSite_cms;
  "publicSite/public": typeof publicSite_public;
  "publicSite/shared": typeof publicSite_shared;
  "reports/academic": typeof reports_academic;
  "reports/dashboards": typeof reports_dashboards;
  "reports/exams": typeof reports_exams;
  "reports/exports": typeof reports_exports;
  "reports/finance": typeof reports_finance;
  "reports/operations": typeof reports_operations;
  "reports/shared": typeof reports_shared;
  "reports/summaries": typeof reports_summaries;
  settings: typeof settings;
  status: typeof status;
  "students/model": typeof students_model;
  "students/owner": typeof students_owner;
  "students/self": typeof students_self;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
