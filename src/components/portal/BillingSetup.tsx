"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const page = { numItems: 100, cursor: null } as const;
const toMinor = (value: FormDataEntryValue | null) =>
  Math.round(Number(value) * 100);

export function BillingSetup({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const plans = useQuery(api.finance.functions.listFeePlans, {});
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const students = useQuery(api.students.owner.listStudents, {
    status: "active",
    paginationOpts: page,
  });
  const [studentId, setStudentId] = useState<Id<"students"> | "">("");
  const student = useQuery(
    api.students.owner.getStudent,
    studentId ? { studentId } : "skip",
  );
  const [planId, setPlanId] = useState<Id<"feePlans"> | "">("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const createPlan = useMutation(api.finance.functions.createFeePlan);
  const addItem = useMutation(api.finance.functions.addFeePlanItem);
  const addDiscount = useMutation(api.finance.functions.addDiscount);
  const activateAgreement = useMutation(
    api.finance.operations.activateAgreement,
  );
  const generateMonthly = useMutation(api.finance.functions.generateMonthly);
  if (!plans || !scopes || !students) return null;

  async function execute(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage(
        bn ? "বিলিং অপারেশন সম্পন্ন হয়েছে।" : "Billing operation completed.",
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Billing operation failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const course = String(data.get("courseId") || "");
    const batch = String(data.get("batchId") || "");
    void execute(async () => {
      const id = await createPlan({
        courseId: course ? (course as Id<"courses">) : undefined,
        batchId: batch ? (batch as Id<"batches">) : undefined,
        nameBn: String(data.get("nameBn")),
        nameEn: String(data.get("nameEn")),
        defaultDueDay: Number(data.get("defaultDueDay")),
      });
      setPlanId(id);
      form.reset();
    });
  }

  function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    void execute(async () => {
      await addItem({
        feePlanId: planId,
        chargeType: data.get("chargeType") as
          "admission" | "monthly" | "course" | "exam" | "material" | "custom",
        labelBn: String(data.get("labelBn")),
        labelEn: String(data.get("labelEn")),
        amountMinor: toMinor(data.get("amount")),
        recurrence: data.get("recurrence") === "monthly" ? "monthly" : "once",
        dueDay: Number(data.get("dueDay")) || undefined,
        sortOrder: Number(data.get("sortOrder")),
      });
      form.reset();
    });
  }

  return (
    <details className="editor-disclosure">
      <summary>
        {bn
          ? "ফি পরিকল্পনা, ছাড় ও মাসিক বিলিং"
          : "Fee plans, discounts, and monthly billing"}
      </summary>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <div className="editor-grid">
        <form className="operation-form compact-form" onSubmit={submitPlan}>
          <fieldset>
            <legend>{bn ? "ফি পরিকল্পনা তৈরি" : "Create fee plan"}</legend>
            <label>
              {bn ? "কোর্স" : "Course"}
              <select name="courseId">
                <option value="">—</option>
                {scopes.courses.map((row) => (
                  <option key={row.courseId} value={row.courseId}>
                    {bn ? row.nameBn : row.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {bn ? "ব্যাচ" : "Batch"}
              <select name="batchId">
                <option value="">—</option>
                {scopes.batches.map((row) => (
                  <option key={row.batchId} value={row.batchId}>
                    {bn ? row.nameBn : row.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                বাংলা
                <input name="nameBn" required />
              </label>
              <label>
                English
                <input name="nameEn" required />
              </label>
            </div>
            <label>
              {bn ? "ডিফল্ট বকেয়া দিন" : "Default due day"}
              <input
                name="defaultDueDay"
                type="number"
                min="1"
                max="28"
                defaultValue="15"
                required
              />
            </label>
            <button className="button button-primary" disabled={busy}>
              {bn ? "তৈরি" : "Create"}
            </button>
          </fieldset>
        </form>
        <form className="operation-form compact-form" onSubmit={submitItem}>
          <fieldset>
            <legend>{bn ? "পরিকল্পনার আইটেম" : "Plan item"}</legend>
            <label>
              {bn ? "পরিকল্পনা" : "Plan"}
              <select
                value={planId}
                onChange={(event) =>
                  setPlanId(event.target.value as Id<"feePlans">)
                }
                required
              >
                <option value="">—</option>
                {plans.map((row) => (
                  <option key={row.feePlanId} value={row.feePlanId}>
                    {bn ? row.nameBn : row.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {bn ? "চার্জের ধরন" : "Charge type"}
              <select name="chargeType">
                <option value="monthly">Monthly</option>
                <option value="admission">Admission</option>
                <option value="course">Course</option>
                <option value="exam">Exam</option>
                <option value="material">Material</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                বাংলা
                <input name="labelBn" required />
              </label>
              <label>
                English
                <input name="labelEn" required />
              </label>
            </div>
            <label>
              {bn ? "পরিমাণ (৳)" : "Amount (BDT)"}
              <input name="amount" type="number" min="0" step="0.01" required />
            </label>
            <label>
              {bn ? "পুনরাবৃত্তি" : "Recurrence"}
              <select name="recurrence">
                <option value="monthly">Monthly</option>
                <option value="once">Once</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                {bn ? "বকেয়া দিন" : "Due day"}
                <input name="dueDay" type="number" min="1" max="28" />
              </label>
              <label>
                {bn ? "ক্রম" : "Order"}
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  defaultValue="0"
                />
              </label>
            </div>
            <button
              className="button button-secondary"
              disabled={busy || !planId}
            >
              {bn ? "আইটেম যোগ" : "Add item"}
            </button>
          </fieldset>
        </form>
      </div>
      <div className="editor-grid">
        <form
          className="operation-form compact-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!studentId) return;
            const data = new FormData(event.currentTarget);
            const percentage = data.get("kind") === "percentage";
            void execute(() =>
              addDiscount({
                studentId,
                kind: percentage ? "percentage" : "fixed",
                valueMinor: percentage ? undefined : toMinor(data.get("value")),
                percentageBasisPoints: percentage
                  ? Math.round(Number(data.get("value")) * 100)
                  : undefined,
                reason: String(data.get("reason")),
                startsOn: String(data.get("startsOn")),
                endsOn: String(data.get("endsOn") || "") || undefined,
              }),
            );
          }}
        >
          <fieldset>
            <legend>{bn ? "শিক্ষার্থী ছাড়" : "Student discount"}</legend>
            <StudentSelect
              locale={locale}
              students={students.page}
              value={studentId}
              onChange={setStudentId}
            />
            <label>
              {bn ? "ধরন" : "Kind"}
              <select name="kind">
                <option value="fixed">Fixed BDT</option>
                <option value="percentage">Percentage</option>
              </select>
            </label>
            <label>
              {bn ? "মান" : "Value"}
              <input name="value" type="number" min="0" step="0.01" required />
            </label>
            <label>
              {bn ? "কারণ" : "Reason"}
              <input name="reason" required />
            </label>
            <div className="form-grid">
              <label>
                {bn ? "শুরু" : "Starts"}
                <input name="startsOn" type="date" required />
              </label>
              <label>
                {bn ? "শেষ" : "Ends"}
                <input name="endsOn" type="date" />
              </label>
            </div>
            <button
              className="button button-secondary"
              disabled={busy || !studentId}
            >
              {bn ? "ছাড় যোগ" : "Add discount"}
            </button>
          </fieldset>
        </form>
        <form
          className="operation-form compact-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void execute(() =>
              activateAgreement({
                enrolmentId: String(
                  data.get("enrolmentId"),
                ) as Id<"enrolments">,
                feePlanId: String(data.get("feePlanId")) as Id<"feePlans">,
                effectiveFrom: String(data.get("effectiveFrom")),
                effectiveTo: String(data.get("effectiveTo") || "") || undefined,
                reason: String(data.get("reason")),
                agreedMonthlyAmountMinor: String(data.get("monthly") || "")
                  ? toMinor(data.get("monthly"))
                  : undefined,
                agreedCourseAmountMinor: String(data.get("course") || "")
                  ? toMinor(data.get("course"))
                  : undefined,
              }),
            );
          }}
        >
          <fieldset>
            <legend>
              {bn ? "ফি চুক্তি সক্রিয় করুন" : "Activate fee agreement"}
            </legend>
            <StudentSelect
              locale={locale}
              students={students.page}
              value={studentId}
              onChange={setStudentId}
            />
            <label>
              {bn ? "এনরোলমেন্ট" : "Enrolment"}
              <select name="enrolmentId" required>
                <option value="">—</option>
                {student?.enrolments
                  .filter((row) => row.status === "active")
                  .map((row) => (
                    <option key={row.enrolmentId} value={row.enrolmentId}>
                      {row.enrolmentId}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {bn ? "পরিকল্পনা" : "Plan"}
              <select name="feePlanId" required>
                <option value="">—</option>
                {plans.map((row) => (
                  <option key={row.feePlanId} value={row.feePlanId}>
                    {bn ? row.nameBn : row.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                {bn ? "কার্যকর শুরু" : "Effective from"}
                <input name="effectiveFrom" type="date" required />
              </label>
              <label>
                {bn ? "কার্যকর শেষ (ঐচ্ছিক)" : "Effective to (optional)"}
                <input name="effectiveTo" type="date" />
              </label>
              <label>
                {bn ? "সম্মত মাসিক (৳)" : "Agreed monthly"}
                <input name="monthly" type="number" min="0" step="0.01" />
              </label>
              <label>
                {bn ? "সম্মত কোর্স (৳)" : "Agreed course"}
                <input name="course" type="number" min="0" step="0.01" />
              </label>
            </div>
            <label>
              {bn ? "অনুমোদনের কারণ" : "Approval reason"}
              <textarea name="reason" rows={3} required />
            </label>
            <button
              className="button button-secondary"
              disabled={busy || !student}
            >
              {bn ? "চুক্তি সক্রিয় করুন" : "Activate agreement"}
            </button>
          </fieldset>
        </form>
      </div>
      <form
        className="operation-form compact-form"
        onSubmit={(event) => {
          event.preventDefault();
          void execute(() =>
            generateMonthly({
              periodKey: String(
                new FormData(event.currentTarget).get("periodKey"),
              ),
            }),
          );
        }}
      >
        <fieldset>
          <legend>
            {bn ? "মাসিক চার্জ তৈরি" : "Generate monthly charges"}
          </legend>
          <label>
            {bn ? "মাস" : "Month"}
            <input name="periodKey" type="month" required />
          </label>
          <p>
            {bn
              ? "পুনরায় চালানো নিরাপদ; একই মাসের চার্জ দ্বিতীয়বার তৈরি হবে না।"
              : "Safe to rerun; a monthly charge is never created twice."}
          </p>
          <button className="button button-danger" disabled={busy}>
            {bn ? "মাসিক বিলিং চালান" : "Run monthly billing"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}

function StudentSelect({
  locale,
  students,
  value,
  onChange,
}: {
  locale: "bn" | "en";
  students: Array<{
    studentId: Id<"students">;
    studentNumber: string;
    displayName: string;
  }>;
  value: Id<"students"> | "";
  onChange: (value: Id<"students"> | "") => void;
}) {
  return (
    <label>
      {locale === "bn" ? "শিক্ষার্থী" : "Student"}
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as Id<"students"> | "")
        }
        required
      >
        <option value="">—</option>
        {students.map((row) => (
          <option key={row.studentId} value={row.studentId}>
            {row.studentNumber} · {row.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
