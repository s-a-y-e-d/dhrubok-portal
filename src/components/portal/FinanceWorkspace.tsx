"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FinanceEditor as LegacyFinanceEditor } from "./FinanceEditor";
import { PortalPageState } from "./PortalPageState";
import { ReportsEditor } from "./ReportsEditor";
import { BillingSetup } from "./BillingSetup";

type View =
  | "overview"
  | "collect"
  | "dues"
  | "campaigns"
  | "billing"
  | "adjustments"
  | "closing"
  | "reports"
  | "imports";
const VIEWS: Array<{ id: View; bn: string; en: string }> = [
  { id: "overview", bn: "সারসংক্ষেপ", en: "Overview" },
  { id: "collect", bn: "আদায়", en: "Collect" },
  { id: "dues", bn: "বকেয়া", en: "Dues" },
  { id: "campaigns", bn: "ক্যাম্পেইন", en: "Campaigns" },
  { id: "billing", bn: "চার্জ ও চুক্তি", en: "Charges & agreements" },
  { id: "adjustments", bn: "সমন্বয়", en: "Adjustments" },
  { id: "closing", bn: "ক্যাশ ক্লোজিং", en: "Cash closing" },
  { id: "reports", bn: "রিপোর্ট", en: "Reports" },
  { id: "imports", bn: "ইমপোর্ট", en: "Imports" },
];
const money = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
  }).format(minor / 100);
function downloadCsv(payload: {
  filename: string;
  contentType: string;
  content: string;
}) {
  const url = URL.createObjectURL(
    new Blob([payload.content], { type: payload.contentType }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = payload.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function financeConfirm(message: string) {
  return new Promise<boolean>((resolve) => {
    const bn = document.documentElement.lang === "bn";
    const dialog = document.createElement("dialog");
    dialog.className = "finance-dialog";
    dialog.setAttribute("aria-labelledby", "finance-dialog-title");
    const title = document.createElement("h2");
    title.id = "finance-dialog-title";
    title.textContent = bn
      ? "আর্থিক কাজ নিশ্চিত করুন"
      : "Confirm financial action";
    const copy = document.createElement("p");
    copy.textContent = message;
    const actions = document.createElement("div");
    actions.className = "form-actions";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "button button-primary";
    confirm.textContent = bn ? "নিশ্চিত করুন" : "Confirm";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "button button-secondary";
    cancel.textContent = bn ? "বাতিল" : "Cancel";
    actions.append(confirm, cancel);
    dialog.append(title, copy, actions);
    document.body.append(dialog);
    const finish = (value: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    confirm.addEventListener("click", () => finish(true), { once: true });
    cancel.addEventListener("click", () => finish(false), { once: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.showModal();
    confirm.focus();
  });
}

function ConfirmAction({
  label,
  confirmLabel,
  description,
  onConfirm,
  danger = false,
  disabled = false,
}: {
  label: string;
  confirmLabel: string;
  description: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <button
        type="button"
        className={danger ? "button button-danger" : "button button-secondary"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    );
  return (
    <div className="finance-confirmation" role="alert">
      <p>{description}</p>
      {error && <p className="form-message error">{error}</p>}
      <div className="form-actions">
        <button
          type="button"
          className={danger ? "button button-danger" : "button button-primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onConfirm();
              setOpen(false);
            } catch (caught) {
              setError(
                caught instanceof Error ? caught.message : "Action failed",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function FinanceEditor({ locale }: { locale: "bn" | "en" }) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("view") as View | null;
  const view = VIEWS.some((v) => v.id === requested) ? requested! : "overview";
  const bn = locale === "bn";
  function select(next: View) {
    const copy = new URLSearchParams(params.toString());
    copy.set("view", next);
    router.replace(`?${copy.toString()}`, { scroll: false });
  }
  return (
    <div className="finance-workspace space-y-5">
      <div className="finance-workspace-tabs">
        <div
          className="flex min-w-max gap-1"
          role="tablist"
          aria-label={bn ? "ফাইন্যান্স ওয়ার্কস্পেস" : "Finance workspaces"}
        >
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={view === item.id}
              onClick={() => select(item.id)}
              className="finance-workspace-tab"
            >
              {bn ? item.bn : item.en}
            </button>
          ))}
        </div>
      </div>
      {view === "overview" && (
        <Overview
          locale={locale}
          onCollect={() => select("collect")}
          onDues={() => select("dues")}
        />
      )}
      {view === "dues" && (
        <Dues locale={locale} onCampaign={() => select("campaigns")} />
      )}
      {view === "campaigns" && <Campaigns locale={locale} />}
      {view === "closing" && <CashClosing locale={locale} />}
      {view === "collect" && <LegacyFinanceEditor locale={locale} />}
      {view === "billing" && <BillingSetup locale={locale} />}
      {view === "imports" && <PaymentImports locale={locale} />}
      {view === "reports" && <ReportsEditor locale={locale} />}
      {view === "adjustments" && <Adjustments locale={locale} />}
    </div>
  );
}

function Overview({
  locale,
  onCollect,
  onDues,
}: {
  locale: "bn" | "en";
  onCollect: () => void;
  onDues: () => void;
}) {
  const data = useQuery(api.finance.receivables.overview, {});
  const operations = useQuery(api.finance.receivables.operationalStatus, {});
  const bn = locale === "bn";
  if (!data || !operations)
    return <PortalPageState state="loading" locale={locale} />;
  const ageing = [
    [bn ? "চলতি" : "Current", data.ageing.currentMinor],
    [`1–15 ${bn ? "দিন" : "days"}`, data.ageing.oneTo15Minor],
    [`16–30 ${bn ? "দিন" : "days"}`, data.ageing.sixteenTo30Minor],
    [`31–60 ${bn ? "দিন" : "days"}`, data.ageing.thirtyOneTo60Minor],
    [`61–90 ${bn ? "দিন" : "days"}`, data.ageing.sixtyOneTo90Minor],
    [`90+ ${bn ? "দিন" : "days"}`, data.ageing.over90Minor],
  ] as const;
  const cards = [
    {
      label: bn ? "আজকের আদায়" : "Collected today",
      value: money(data.collectedTodayMinor, locale),
    },
    {
      label: bn ? "আজকের পেমেন্ট" : "Payments today",
      value: String(data.paymentsToday),
    },
    {
      label: bn ? "বকেয়া শিক্ষার্থী" : "Overdue students",
      value: String(data.overdueStudents),
    },
    {
      label: bn ? "মোট বকেয়া" : "Total overdue",
      value: money(data.overdueMinor, locale),
    },
  ];
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {bn ? "ফাইন্যান্স সারসংক্ষেপ" : "Finance overview"}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {bn
              ? "আজকের আদায় ও বকেয়ার অবস্থা"
              : "Today’s collections and receivable health"}
          </p>
        </div>
        <button onClick={onCollect} className="button button-primary">
          {bn ? "পেমেন্ট নিন" : "Collect payment"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            onClick={
              c.label.includes("বকেয়া") || c.label.includes("Overdue")
                ? onDues
                : onCollect
            }
            className="finance-stat-card"
          >
            <span className="finance-stat-card-label">{c.label}</span>
            <strong className="finance-stat-card-value">{c.value}</strong>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="font-semibold">
          {bn ? "বকেয়ার বয়স" : "Receivable ageing"}
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {ageing.map(([label, value]) => (
            <div
              key={label}
              className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-900"
            >
              <span className="block text-xs text-neutral-500">
                {label}
              </span>
              <b className="finance-money block text-left">
                {money(value, locale)}
              </b>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-semibold">
            {bn ? "অপারেশন অবস্থা" : "Operations status"}
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-neutral-500">Receivable refresh</dt>
              <dd className="font-medium">
                {operations.state?.lastReceivableRefreshAt
                  ? new Date(
                      operations.state.lastReceivableRefreshAt,
                    ).toLocaleString()
                  : "Not run"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Summary drift</dt>
              <dd className="font-medium">
                {operations.state?.summaryDriftCount ?? 0} ·{" "}
                {money(operations.state?.summaryDriftMinor ?? 0, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">SMS provider</dt>
              <dd className="font-medium">
                {operations.smsProvider.enabled
                  ? operations.smsProvider.status
                  : "disabled"}
                {operations.smsProvider.balanceMinor !== undefined
                  ? ` · ${money(operations.smsProvider.balanceMinor, locale)}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Active jobs</dt>
              <dd className="font-medium">
                {operations.activeCampaignCount} campaigns ·{" "}
                {operations.activeImportCount} imports
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Cash drawer</dt>
              <dd className="font-medium">
                {operations.openDrawer
                  ? `${operations.openDrawer.businessDate} open`
                  : "No open drawer"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="font-semibold">
            {bn ? "সাম্প্রতিক আদায় প্রবণতা" : "Recent collection trend"}
          </h3>
          <div className="mt-3 space-y-2">
            {operations.snapshots.slice(0, 7).map((snapshot) => (
              <div
                key={snapshot.date}
                className="grid grid-cols-3 gap-2 text-sm"
              >
                <span>{snapshot.date}</span>
                <span className="finance-money">
                  {money(snapshot.collectedMinor, locale)}
                </span>
                <span className="text-right text-neutral-500">
                  {snapshot.paymentCount} payments
                </span>
              </div>
            ))}
            {operations.snapshots.length === 0 && (
              <p className="text-sm text-neutral-500">
                Trend snapshots appear after the daily receivable refresh.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function Dues({
  locale,
  onCampaign,
}: {
  locale: "bn" | "en";
  onCampaign: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [promiseStudentId, setPromiseStudentId] =
    useState<Id<"students"> | null>(null);
  const rows = useQuery(api.finance.receivables.worklist, {
    paginationOpts: { numItems: 50, cursor: null },
    courseId: courseId ? (courseId as Id<"courses">) : undefined,
    batchId: batchId ? (batchId as Id<"batches">) : undefined,
  });
  const options = useQuery(api.finance.receivables.filterOptions, {});
  const bn = locale === "bn";
  if (!rows || !options)
    return <PortalPageState state="loading" locale={locale} />;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {bn ? "বকেয়া ওয়ার্কলিস্ট" : "Receivables worklist"}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {bn
              ? "কোর্স ও ব্যাচ অনুযায়ী অগ্রাধিকার দিন"
              : "Prioritize follow-up by course and batch"}
          </p>
        </div>
        <button onClick={onCampaign} className="button button-primary">
          {bn ? "রিমাইন্ডার ক্যাম্পেইন" : "Create reminder campaign"}
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Course"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setBatchId("");
          }}
          className="min-h-11 rounded-md border px-3 dark:bg-neutral-950"
        >
          <option value="">{bn ? "সব কোর্স" : "All courses"}</option>
          {options.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {bn ? c.nameBn : c.nameEn}
            </option>
          ))}
        </select>
        <select
          aria-label="Batch"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="min-h-11 rounded-md border px-3 dark:bg-neutral-950"
        >
          <option value="">{bn ? "সব ব্যাচ" : "All batches"}</option>
          {options.batches
            .filter((b) => !courseId || b.courseId === courseId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {bn ? b.nameBn : b.nameEn}
              </option>
            ))}
        </select>
      </div>
      <div className="finance-table finance-record-table">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left dark:bg-neutral-900">
            <tr>
              <th className="p-3">{bn ? "শিক্ষার্থী" : "Student"}</th>
              <th className="p-3 text-right">{bn ? "বকেয়া" : "Overdue"}</th>
              <th className="p-3">{bn ? "পুরনো তারিখ" : "Oldest due"}</th>
              <th className="p-3">{bn ? "শেষ রিমাইন্ডার" : "Last reminder"}</th>
              <th className="p-3">{bn ? "প্রতিশ্রুতি" : "Promise"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.page.map((row) => (
              <tr
                key={row._id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                <td className="p-3" data-label={bn ? "শিক্ষার্থী" : "Student"}>
                  <b>{row.displayName}</b>
                  <span className="block text-xs text-neutral-500">
                    {row.studentNumber}
                  </span>
                </td>
                <td
                  className="finance-money finance-money-overdue p-3"
                  data-label={bn ? "বকেয়া" : "Overdue"}
                >
                  {money(row.overdueMinor, locale)}
                </td>
                <td
                  className="p-3"
                  data-label={bn ? "পুরোনো তারিখ" : "Oldest due"}
                >
                  {row.oldestUnpaidDueDate ?? "—"}
                </td>
                <td
                  className="p-3"
                  data-label={bn ? "শেষ রিমাইন্ডার" : "Last reminder"}
                >
                  {row.lastReminderAt
                    ? new Date(row.lastReminderAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-3" data-label={bn ? "প্রতিশ্রুতি" : "Promise"}>
                  <button
                    type="button"
                    onClick={() => setPromiseStudentId(row.studentId)}
                    className="button button-secondary"
                  >
                    {bn ? "রেকর্ড" : "Record"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.page.length === 0 && (
          <p className="p-6 text-center text-neutral-500">
            {bn ? "কোনো বকেয়া পাওয়া যায়নি" : "No overdue receivables found"}
          </p>
        )}
      </div>
      {promiseStudentId && (
        <PromiseForm
          locale={locale}
          studentId={promiseStudentId}
          courseId={courseId ? (courseId as Id<"courses">) : undefined}
          batchId={batchId ? (batchId as Id<"batches">) : undefined}
          onClose={() => setPromiseStudentId(null)}
        />
      )}
    </section>
  );
}

function PromiseForm({
  locale,
  studentId,
  courseId,
  batchId,
  onClose,
}: {
  locale: "bn" | "en";
  studentId: Id<"students">;
  courseId?: Id<"courses">;
  batchId?: Id<"batches">;
  onClose: () => void;
}) {
  const createPromise = useMutation(api.finance.receivables.createPromise);
  const [promisedOn, setPromisedOn] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const bn = locale === "bn";
  return (
    <form
      className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus("");
        try {
          await createPromise({
            studentId,
            courseId,
            batchId,
            promisedOn,
            promisedAmountMinor: amount
              ? Math.round(Number(amount) * 100)
              : undefined,
            note,
          });
          onClose();
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : "Unable to record promise",
          );
        }
      }}
    >
      <h3 className="font-semibold">
        {bn ? "পেমেন্ট প্রতিশ্রুতি" : "Payment promise"}
      </h3>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          {bn ? "তারিখ" : "Promised date"}
          <input
            required
            type="date"
            value={promisedOn}
            onChange={(event) => setPromisedOn(event.target.value)}
            className="min-h-11 rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {bn ? "পরিমাণ" : "Amount (BDT)"}
          <input
            min="0"
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="min-h-11 rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {bn ? "নোট" : "Follow-up note"}
          <input
            required
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-11 rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
      </div>
      {status && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {status}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="button button-primary">
          {bn ? "সংরক্ষণ" : "Save promise"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="button button-secondary"
        >
          {bn ? "বাতিল" : "Cancel"}
        </button>
      </div>
    </form>
  );
}

function Campaigns({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const campaigns = useQuery(api.finance.campaigns.listCampaigns, {});
  const options = useQuery(api.finance.receivables.filterOptions, {});
  const preview = useMutation(api.finance.campaigns.createPreview);
  const queue = useMutation(api.finance.campaigns.queueCampaign);
  const refresh = useMutation(api.finance.campaigns.refreshOutcomes);
  const retry = useMutation(api.finance.campaigns.retryFailed);
  const setIncluded = useMutation(api.finance.campaigns.setRecipientIncluded);
  const [selectedCampaignId, setSelectedCampaignId] =
    useState<Id<"dueReminderCampaigns"> | null>(null);
  const detail = useQuery(
    api.finance.campaigns.getCampaign,
    selectedCampaignId ? { campaignId: selectedCampaignId } : "skip",
  );
  const campaignCsv = useQuery(
    api.reports.exports.campaignOutcomesCsv,
    selectedCampaignId ? { campaignId: selectedCampaignId, locale } : "skip",
  );
  const [scopeType, setScopeType] = useState<"all" | "course" | "batch">("all");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [minimum, setMinimum] = useState("");
  const [maximum, setMaximum] = useState("");
  const [suppressionDays, setSuppressionDays] = useState("7");
  const [localeMode, setLocaleMode] = useState<
    "student_preference" | "bn" | "en"
  >("student_preference");
  const [buckets, setBuckets] = useState([
    "1_15",
    "16_30",
    "31_60",
    "61_90",
    "over_90",
  ] as Array<"1_15" | "16_30" | "31_60" | "61_90" | "over_90">);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function create() {
    setBusy(true);
    setFeedback("");
    try {
      const id = await preview({
        scopeType,
        courseId: courseId ? (courseId as Id<"courses">) : undefined,
        batchId: batchId ? (batchId as Id<"batches">) : undefined,
        ageingBuckets: buckets,
        minimumOverdueMinor: minimum
          ? Math.round(Number(minimum) * 100)
          : undefined,
        maximumOverdueMinor: maximum
          ? Math.round(Number(maximum) * 100)
          : undefined,
        localeMode,
        suppressIfRemindedSince:
          Number(suppressionDays) > 0
            ? Date.now() - Number(suppressionDays) * 86400000
            : undefined,
      });
      setSelectedCampaignId(id);
      setFeedback(
        bn
          ? "প্রিভিউ তৈরি হয়েছে। পাঠানোর আগে নিচে পর্যালোচনা করুন।"
          : "Preview created. Review it below before queueing.",
      );
      return id;
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  if (!campaigns || !options)
    return <PortalPageState state="loading" locale={locale} />;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {bn ? "রিমাইন্ডার ক্যাম্পেইন" : "Reminder campaigns"}
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {bn
              ? "প্রিভিউ, suppression ও স্থায়ী recipient snapshot"
              : "Preview, suppression, and durable recipient snapshots"}
          </p>
        </div>
        <button
          disabled={
            busy ||
            buckets.length === 0 ||
            (scopeType !== "all" && !courseId) ||
            (scopeType === "batch" && !batchId)
          }
          onClick={create}
          className="button button-primary"
        >
          {bn ? "সব বকেয়ার প্রিভিউ" : "Preview all overdue"}
        </button>
      </div>
      <div className="grid gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
        <label className="text-sm font-medium">
          Scope
          <select
            value={scopeType}
            onChange={(event) => {
              setScopeType(event.target.value as typeof scopeType);
              setCourseId("");
              setBatchId("");
            }}
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="all">All overdue</option>
            <option value="course">Course</option>
            <option value="batch">Batch</option>
          </select>
        </label>
        {scopeType !== "all" && (
          <label className="text-sm font-medium">
            Course
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setBatchId("");
              }}
              className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
              required
            >
              <option value="">Select course</option>
              {options.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {bn ? course.nameBn : course.nameEn}
                </option>
              ))}
            </select>
          </label>
        )}
        {scopeType === "batch" && (
          <label className="text-sm font-medium">
            Batch
            <select
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
              required
            >
              <option value="">Select batch</option>
              {options.batches
                .filter((batch) => batch.courseId === courseId)
                .map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {bn ? batch.nameBn : batch.nameEn}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="text-sm font-medium">
          Minimum overdue (BDT)
          <input
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
        <label className="text-sm font-medium">
          Maximum overdue (BDT)
          <input
            value={maximum}
            onChange={(event) => setMaximum(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
        <label className="text-sm font-medium">
          Suppress reminded within
          <select
            value={suppressionDays}
            onChange={(event) => setSuppressionDays(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="0">Never</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Message locale
          <select
            value={localeMode}
            onChange={(event) =>
              setLocaleMode(event.target.value as typeof localeMode)
            }
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="student_preference">Student preference</option>
            <option value="bn">Bangla</option>
            <option value="en">English</option>
          </select>
        </label>
        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className="text-sm font-medium">Ageing buckets</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["1_15", "16_30", "31_60", "61_90", "over_90"] as const).map(
              (bucket) => (
                <label
                  key={bucket}
                  className="inline-flex min-h-11 items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={buckets.includes(bucket)}
                    onChange={(event) =>
                      setBuckets((current) =>
                        event.target.checked
                          ? [...current, bucket]
                          : current.filter((item) => item !== bucket),
                      )
                    }
                  />
                  {bucket.replace("_", "–")}
                </label>
              ),
            )}
          </div>
        </fieldset>
      </div>
      {feedback && (
        <p
          role="status"
          className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
        >
          {feedback}
        </p>
      )}
      <div className="space-y-2">
        {campaigns.map((c) => (
          <article
            key={c._id}
            onClick={() => setSelectedCampaignId(c._id)}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div>
              <b>{c.campaignNumber}</b>
              <span className={`status-pill ${c.status}`}>{c.status}</span>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {c.eligibleRecipientCount} {bn ? "যোগ্য" : "eligible"} ·{" "}
                {c.suppressedRecipientCount} {bn ? "বাদ" : "suppressed"} ·{" "}
                {c.estimatedSegments} {bn ? "সেগমেন্ট" : "segments"} ·{" "}
                {c.estimatedCostMinor !== undefined
                  ? money(c.estimatedCostMinor, locale)
                  : bn
                    ? "রেট কনফিগার করা নেই"
                    : "provider rate not configured"}
              </p>
            </div>
            {c.status === "previewed" && (
              <ConfirmAction
                label={bn ? "পর্যালোচনা করুন" : "Review and queue"}
                confirmLabel={bn ? "নিশ্চিত করে পাঠান" : "Confirm and queue"}
                description={
                  bn
                    ? `${c.eligibleRecipientCount} জন প্রাপক, ${c.estimatedSegments} SMS সেগমেন্ট। পাঠানোর পরে প্রাপকের তালিকা পরিবর্তন করা যাবে না এবং SMS খরচ হতে পারে।`
                    : `${c.eligibleRecipientCount} recipients and ${c.estimatedSegments} SMS segments will be queued. The audience becomes immutable and SMS charges may apply.`
                }
                onConfirm={async () => {
                  await queue({ campaignId: c._id, confirmed: true });
                }}
              />
            )}
            {c.status !== "previewed" && (
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await refresh({ campaignId: c._id });
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium dark:border-neutral-700"
                >
                  Refresh status
                </button>
                {c.failedMessageCount > 0 && (
                  <ConfirmAction
                    label={bn ? "ব্যর্থগুলো আবার পাঠান" : "Retry failed"}
                    confirmLabel={bn ? "পুনরায় পাঠান" : "Confirm retry"}
                    description={
                      bn
                        ? `${c.failedMessageCount}টি ব্যর্থ SMS আবার কিউ করা হবে। সফল প্রাপকদের পুনরায় পাঠানো হবে না।`
                        : `${c.failedMessageCount} failed SMS messages will be queued again. Successful recipients will not be resent.`
                    }
                    onConfirm={async () => {
                      await retry({ campaignId: c._id, confirmed: true });
                    }}
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {detail && (
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">
                {detail.campaign.campaignNumber} recipients
              </h3>
              <p className="text-sm text-neutral-500">
                {detail.campaign.scopeType} ·{" "}
                {detail.campaign.eligibleRecipientCount} eligible ·{" "}
                {detail.campaign.suppressedRecipientCount} suppressed ·{" "}
                {detail.campaign.estimatedSegments} segments ·{" "}
                {detail.campaign.estimatedCostMinor !== undefined
                  ? money(detail.campaign.estimatedCostMinor, locale)
                  : bn
                    ? "রেট কনফিগার করা নেই"
                    : "provider rate not configured"}
              </p>
            </div>
            {campaignCsv && (
              <button
                className="min-h-11 rounded-md border border-neutral-300 px-3 text-sm font-medium dark:border-neutral-700"
                onClick={() => downloadCsv(campaignCsv)}
              >
                Campaign CSV
              </button>
            )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Include</th>
                  <th className="p-2 text-left">Student</th>
                  <th className="p-2 text-right">Overdue</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.recipients.map((recipient) => (
                  <tr
                    key={recipient._id}
                    className="border-t dark:border-neutral-800"
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        aria-label={`Include ${recipient.displayName}`}
                        disabled={
                          detail.campaign.status !== "previewed" ||
                          recipient.status === "suppressed"
                        }
                        checked={recipient.status === "eligible"}
                        onChange={(event) =>
                          void setIncluded({
                            recipientId: recipient._id,
                            included: event.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="p-2">
                      <b>{recipient.displayName}</b>
                      <span className="block text-xs text-neutral-500">
                        {recipient.studentNumber}
                      </span>
                    </td>
                    <td className="finance-money p-2">
                      {money(recipient.overdueMinorSnapshot, locale)}
                    </td>
                    <td className="p-2">
                      {recipient.status}
                      {recipient.suppressionReason
                        ? ` · ${recipient.suppressionReason}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}

function CashClosing({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const session = useQuery(api.finance.operations.todayDrawer, {});
  const open = useMutation(api.finance.operations.openDrawer);
  const close = useMutation(api.finance.operations.closeDrawer);
  const reopen = useMutation(api.finance.operations.reopenDrawer);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (session === undefined)
    return <PortalPageState state="loading" locale={locale} />;
  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">
        {bn ? "ক্যাশ ক্লোজিং" : "Cash closing"}
      </h2>
      {!session ? (
        <div className="rounded-lg border p-4 dark:border-neutral-800">
          <label className="block text-sm font-medium">
            {bn ? "ওপেনিং ফ্লোট" : "Opening float"}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await open({
                  openingFloatMinor: Math.round(Number(amount) * 100),
                });
                setAmount("");
              } finally {
                setBusy(false);
              }
            }}
            className="button button-primary mt-3"
          >
            {bn ? "ড্রয়ার খুলুন" : "Open drawer"}
          </button>
        </div>
      ) : session.status === "closed" ? (
        <div className="rounded-lg border p-4 dark:border-neutral-800">
          <p className="font-medium">
            {bn ? "আজকের ড্রয়ার বন্ধ" : "Today's drawer is closed"}
          </p>
          <p className="finance-money mt-1 text-left text-sm text-neutral-600 dark:text-neutral-400">
            Expected {money(session.expectedCashMinor, locale)} · Counted{" "}
            {money(session.countedCashMinor ?? 0, locale)} · Variance{" "}
            {money(session.varianceMinor ?? 0, locale)}
          </p>
          <label className="mt-3 block text-sm font-medium">
            {bn ? "পুনরায় খোলার কারণ" : "Reopen reason"}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full rounded-md border p-3 dark:bg-neutral-950"
            />
          </label>
          <button
            disabled={busy || !note.trim()}
            onClick={async () => {
              if (
                !(await financeConfirm(
                  bn ? "ড্রয়ার পুনরায় খুলবেন?" : "Reopen this drawer session?",
                ))
              )
                return;
              setBusy(true);
              try {
                await reopen({
                  sessionId: session._id,
                  reason: note.trim(),
                  confirmed: true,
                });
                setNote("");
              } finally {
                setBusy(false);
              }
            }}
            className="button button-secondary mt-3"
          >
            {bn ? "ড্রয়ার পুনরায় খুলুন" : "Reopen drawer"}
          </button>
        </div>
      ) : (
        <div className="rounded-lg border p-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-600">
            {bn ? "ব্যবসার তারিখ" : "Business date"}: {session.businessDate}
          </p>
          <label className="mt-3 block text-sm font-medium">
            {bn ? "গোনা ক্যাশ" : "Counted cash"}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
            />
          </label>
          <label className="mt-3 block text-sm font-medium">
            {bn ? "নোট / variance কারণ" : "Note / variance reason"}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-2 w-full rounded-md border p-3 dark:bg-neutral-950"
            />
          </label>
          <button
            disabled={busy}
            onClick={async () => {
              if (
                !(await financeConfirm(
                  bn ? "ড্রয়ার বন্ধ করবেন?" : "Close this drawer?",
                ))
              )
                return;
              setBusy(true);
              try {
                await close({
                  sessionId: session._id,
                  countedCashMinor: Math.round(Number(amount) * 100),
                  note: note || undefined,
                  confirmed: true,
                });
                setAmount("");
                setNote("");
              } finally {
                setBusy(false);
              }
            }}
            className="button button-primary mt-3"
          >
            {bn ? "ড্রয়ার ক্লোজ করুন" : "Close drawer"}
          </button>
        </div>
      )}
    </section>
  );
}

/* Removed staged placeholder after the real workspaces were implemented.
function FeatureHandoff({ locale, view }: { locale: "bn" | "en"; view: View }) {
  const bn = locale === "bn";
  const labels = useMemo(
    () => ({
      adjustments: bn
        ? "সমন্বয় ও চুক্তির backend প্রস্তুত; শিক্ষার্থী নির্বাচন করে Collect workspace থেকে বর্তমান কার্যক্রম চালান।"
        : "Adjustment and agreement backend is ready; use the Collect workspace for the current student workflow.",
      reports: bn
        ? "বিদ্যমান Finance reports এখানে একীভূত করা হচ্ছে।"
        : "Existing finance reports are being consolidated here.",
      imports: bn
        ? "Preview-first import staging model প্রস্তুত; CSV uploader পরবর্তী rollout-এ সক্রিয় হবে।"
        : "The preview-first import staging model is ready; the CSV uploader remains staged for rollout.",
    }),
    [bn],
  );
  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="text-xl font-semibold">
        {VIEWS.find((v) => v.id === view)?.[bn ? "bn" : "en"]}
      </h2>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        {labels[view as keyof typeof labels]}
      </p>
    </div>
  );
}

*/
function Adjustments({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const students = useQuery(api.students.owner.listStudents, {
    status: "active",
    paginationOpts: { numItems: 100, cursor: null },
  });
  const [studentId, setStudentId] = useState<Id<"students"> | "">("");
  const charges = useQuery(
    api.finance.functions.listCharges,
    studentId
      ? { studentId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  );
  const payments = useQuery(
    api.finance.functions.listPayments,
    studentId
      ? { studentId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  );
  const post = useMutation(api.finance.operations.postAdjustment);
  const [type, setType] = useState<
    "waiver" | "credit_note" | "refund" | "write_off"
  >("waiver");
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refundable = type === "refund";
  const requiresSource = type !== "credit_note";
  if (!students) return <PortalPageState state="loading" locale={locale} />;

  async function submit() {
    if (!studentId || (requiresSource && !sourceId)) return;
    if (
      !(await financeConfirm(
        bn ? "এই সমন্বয় পোস্ট করবেন?" : "Post this immutable adjustment?",
      ))
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await post({
        studentId,
        type,
        amountMinor: Math.round(Number(amount) * 100),
        reason: reason.trim(),
        chargeId:
          refundable || !sourceId
            ? undefined
            : (sourceId as Id<"studentCharges">),
        paymentId: refundable ? (sourceId as Id<"payments">) : undefined,
      });
      setMessage(bn ? "সমন্বয় পোস্ট হয়েছে।" : "Adjustment posted.");
      setAmount("");
      setReason("");
      setSourceId("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const sourceOptions = refundable
    ? payments?.page
        .filter((row) => row.status === "posted")
        .map((row) => ({
          id: row.paymentId,
          label: `${row.receiptNumber} · ${money(row.amountMinor, locale)}`,
        }))
    : charges?.page
        .filter(
          (row) =>
            row.status !== "paid" &&
            row.status !== "voided" &&
            row.netAmountMinor > row.paidAmountMinor,
        )
        .map((row) => ({
          id: row.chargeId,
          label: `${row.chargeNumber} · ${row.description} · ${money(row.netAmountMinor - row.paidAmountMinor, locale)}`,
        }));

  return (
    <section className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {bn ? "পেমেন্ট ও সমন্বয়" : "Payments & adjustments"}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {bn
            ? "মূল ইতিহাস না বদলে waiver, credit, refund ও write-off পোস্ট করুন।"
            : "Post waivers, credits, refunds, and write-offs without rewriting history."}
        </p>
      </div>
      <div className="grid gap-4 rounded-lg border border-neutral-200 p-4 sm:grid-cols-2 dark:border-neutral-800">
        <label className="text-sm font-medium">
          {bn ? "শিক্ষার্থী" : "Student"}
          <select
            value={studentId}
            onChange={(event) => {
              setStudentId(event.target.value as Id<"students">);
              setSourceId("");
            }}
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
            {students.page.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.displayName} · {student.studentNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {bn ? "সমন্বয়ের ধরন" : "Adjustment type"}
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              setSourceId("");
            }}
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="waiver">Waiver</option>
            <option value="credit_note">Credit note</option>
            <option value="refund">Refund</option>
            <option value="write_off">Write-off</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          {refundable
            ? bn
              ? "মূল পেমেন্ট"
              : "Original payment"
            : bn
              ? "চার্জ"
              : "Charge"}
          <select
            value={sourceId}
            onChange={(event) => setSourceId(event.target.value)}
            disabled={!studentId || !sourceOptions}
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          >
            <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
            {sourceOptions?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {bn ? "পরিমাণ" : "Amount"}
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            className="mt-2 min-h-11 w-full rounded-md border px-3 dark:bg-neutral-950"
          />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          {bn ? "কারণ" : "Reason"}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border p-3 dark:bg-neutral-950"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            disabled={
              busy ||
              !studentId ||
              (requiresSource && !sourceId) ||
              !amount ||
              !reason.trim()
            }
            onClick={() => void submit()}
            className="button button-primary"
          >
            {bn ? "নিশ্চিত করে পোস্ট করুন" : "Confirm and post"}
          </button>
        </div>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-md border p-3 text-sm dark:border-neutral-800"
        >
          {message}
        </p>
      )}
    </section>
  );
}

function parseCsv(text: string) {
  const result: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(value);
      if (row.some((cell) => cell.trim())) result.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.trim())) result.push(row);
  return result;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function PaymentImports({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const preview = useMutation(api.finance.imports.previewBatch);
  const commit = useMutation(api.finance.imports.commitBatch);
  const batches = useQuery(api.finance.imports.listBatches, {});
  const [selected, setSelected] = useState<Id<"paymentImportBatches"> | null>(
    null,
  );
  const detail = useQuery(
    api.finance.imports.getBatch,
    selected ? { batchId: selected } : "skip",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setMessage("");
    try {
      const text = await file.text();
      const records = parseCsv(text);
      if (records.length < 2)
        throw new Error("CSV must include a header and at least one row");
      const headers = records[0].map((value) =>
        value
          .trim()
          .toLowerCase()
          .replace(/^\uFEFF/, ""),
      );
      for (const name of ["student_number", "amount_bdt", "method", "paid_at"])
        if (!headers.includes(name)) throw new Error(`Missing column: ${name}`);
      const at = (row: string[], name: string) =>
        row[headers.indexOf(name)]?.trim() ?? "";
      const methods = new Set([
        "cash",
        "bkash",
        "nagad",
        "bank_transfer",
        "cheque",
        "other",
      ]);
      const rows = records.slice(1).map((row) => {
        const method = at(row, "method");
        if (!methods.has(method))
          throw new Error(`Unsupported payment method: ${method}`);
        return {
          studentNumber: at(row, "student_number"),
          amountMinor: Math.round(Number(at(row, "amount_bdt")) * 100),
          method: method as
            "cash" | "bkash" | "nagad" | "bank_transfer" | "cheque" | "other",
          paidAt: new Date(at(row, "paid_at")).getTime(),
          externalReference: at(row, "external_reference") || undefined,
          note: at(row, "note") || undefined,
        };
      });
      const id = await preview({
        fileName: file.name,
        fileHash: await sha256(text),
        rows,
        sendSms: false,
      });
      setSelected(id);
      setMessage(
        bn
          ? "প্রিভিউ প্রস্তুত। বৈধ ও ত্রুটিপূর্ণ সারি পর্যালোচনা করুন।"
          : "Preview ready. Review valid and invalid rows.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!batches) return <PortalPageState state="loading" locale={locale} />;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {bn ? "পেমেন্ট ইমপোর্ট" : "Payment imports"}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {bn
            ? "CSV যাচাই ও প্রিভিউ ছাড়া কোনো পেমেন্ট পোস্ট হয় না।"
            : "No payment is posted before CSV validation and preview."}
        </p>
      </div>
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-sm">
          student_number, amount_bdt, method, paid_at, external_reference, note
        </p>
        <label className="button button-primary mt-3 cursor-pointer">
          <span>
            {busy
              ? bn
                ? "যাচাই হচ্ছে…"
                : "Validating…"
              : bn
                ? "CSV নির্বাচন করুন"
                : "Choose CSV"}
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-md border p-3 text-sm dark:border-neutral-800"
        >
          {message}
        </p>
      )}
      {detail && (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <b>{detail.batch.fileName}</b>
              <p className="finance-money text-left text-sm text-neutral-500">
                {detail.batch.validRows} {bn ? "বৈধ" : "valid"} ·{" "}
                {detail.batch.invalidRows} {bn ? "ত্রুটি" : "invalid"} ·{" "}
                {money(detail.batch.totalAmountMinor, locale)}
              </p>
            </div>
            {detail.batch.status === "previewed" &&
              detail.batch.validRows > 0 && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !(await financeConfirm(
                        bn
                          ? "শুধু বৈধ সারি পোস্ট করবেন?"
                          : "Commit valid rows only?",
                      ))
                    )
                      return;
                    setBusy(true);
                    try {
                      const result = await commit({
                        batchId: detail.batch._id,
                        confirmed: true,
                      });
                      setMessage(
                        result.committed === 0 && result.skipped === 0
                          ? "Import commit queued; progress updates automatically."
                          : `${result.committed} committed, ${result.skipped} skipped`,
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="button button-primary"
                >
                  {bn ? "বৈধ সারি পোস্ট করুন" : "Commit valid rows"}
                </button>
              )}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">#</th>
                  <th className="p-2 text-left">
                    {bn ? "শিক্ষার্থী" : "Student"}
                  </th>
                  <th className="p-2 text-right">{bn ? "পরিমাণ" : "Amount"}</th>
                  <th className="p-2 text-left">{bn ? "অবস্থা" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((row) => (
                  <tr
                    key={row._id}
                    className="border-t dark:border-neutral-800"
                  >
                    <td className="p-2">{row.rowNumber}</td>
                    <td className="p-2">{row.studentNumber}</td>
                    <td className="finance-money p-2">
                      {money(row.amountMinor, locale)}
                    </td>
                    <td className="p-2">
                      {row.status}
                      {row.validationErrors.length
                        ? `: ${row.validationErrors.join(", ")}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="space-y-2">
        <h3 className="font-semibold">
          {bn ? "সাম্প্রতিক ব্যাচ" : "Recent batches"}
        </h3>
        {batches.map((batch) => (
          <button
            key={batch._id}
            onClick={() => setSelected(batch._id)}
            className="flex w-full items-center justify-between rounded-md border p-3 text-left dark:border-neutral-800"
          >
            <span>{batch.fileName}</span>
            <span className="text-sm text-neutral-500">
              {batch.status} · {batch.committedRows}/{batch.validRows}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
