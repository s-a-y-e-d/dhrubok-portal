"use client";

import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ExamWorkQueue } from "./exams/ExamWorkQueue";
import { ExamCreateWizard } from "./exams/create/ExamCreateWizard";
import { MarksWorkspace } from "./exams/marks/MarksWorkspace";
import { OwnerReviewWorkspace } from "./exams/review/OwnerReviewWorkspace";
import { PortalPageState } from "./PortalPageState";

function TeacherExamWork({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const assignments = useQuery(api.exams.assignments.myWork, {});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const requested = useSearchParams()?.get(
    "assignment",
  ) as Id<"examTeacherAssignments"> | null;
  const [selected, setSelected] = useState<Id<"examTeacherAssignments"> | null>(
    requested,
  );
  if (!assignments) return <PortalPageState state="loading" locale={locale} />;
  const visibleAssignments = assignments.filter((row) => {
    const matchesStatus = !status || row.assignment.status === status;
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !term ||
      row.exam?.nameBn.toLocaleLowerCase().includes(term) ||
      row.exam?.nameEn.toLocaleLowerCase().includes(term) ||
      row.batch?.nameBn.toLocaleLowerCase().includes(term) ||
      row.batch?.nameEn.toLocaleLowerCase().includes(term);
    return matchesStatus && matchesSearch;
  });
  const active = visibleAssignments.some(
    (row) => row.assignment._id === selected,
  )
    ? selected
    : (visibleAssignments.find(
        (row) =>
          row.exam?.status === "marks_entry" || row.exam?.status === "reopened",
      )?.assignment._id ?? visibleAssignments[0]?.assignment._id);
  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "আমার পরীক্ষার কাজ" : "My exam work"}</p>
        <h1>
          {bn ? "বিষয়ভিত্তিক নম্বর এন্ট্রি" : "Subject-level marks entry"}
        </h1>
        <p>
          {bn
            ? "খসড়া আলাদা করে সংরক্ষণ করুন, তারপর সম্পূর্ণ অ্যাসাইনমেন্ট পর্যালোচনার জন্য জমা দিন।"
            : "Save drafts separately, then submit the complete assignment for owner review."}
        </p>
      </header>
      <div className="master-detail">
        <section>
          <div className="marks-toolbar">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={bn ? "পরীক্ষার কাজ খুঁজুন" : "Search exam work"}
              placeholder={bn ? "পরীক্ষা বা ব্যাচ" : "Exam or batch"}
            />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label={bn ? "কাজের অবস্থা" : "Work status"}
            >
              <option value="">{bn ? "সব কাজ" : "All work"}</option>
              <option value="pending">
                {bn ? "শুরু হয়নি" : "Not started"}
              </option>
              <option value="in_progress">
                {bn ? "খসড়া চলছে" : "Draft in progress"}
              </option>
              <option value="submitted">
                {bn ? "জমা হয়েছে" : "Submitted"}
              </option>
              <option value="returned">{bn ? "ফেরত এসেছে" : "Returned"}</option>
            </select>
          </div>
          <div className="selection-list">
            {visibleAssignments.map((row) => (
              <button
                key={row.assignment._id}
                className={active === row.assignment._id ? "selected" : ""}
                onClick={() => setSelected(row.assignment._id)}
              >
                <strong>
                  {row.exam ? (bn ? row.exam.nameBn : row.exam.nameEn) : "—"}
                </strong>
                <span>
                  {row.batch
                    ? bn
                      ? row.batch.nameBn
                      : row.batch.nameEn
                    : bn
                      ? "সব ফ্রোজেন ব্যাচ"
                      : "All frozen batches"}{" "}
                  · {row.assignment.status ?? "pending"}
                </span>
              </button>
            ))}
            {!visibleAssignments.length && (
              <p className="empty-panel">
                {bn
                  ? "এই ফিল্টারে কোনো কাজ নেই।"
                  : "No work matches these filters."}
              </p>
            )}
          </div>
        </section>
        <section>
          {active ? (
            <MarksWorkspace locale={locale} assignmentId={active} />
          ) : (
            <p className="empty-panel">
              {bn ? "কোনো অ্যাসাইনমেন্ট নেই।" : "No exam assignments."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export function ExamEditor({
  locale,
  role,
}: {
  locale: "bn" | "en";
  role: "owner" | "teacher";
}) {
  const bn = locale === "bn";
  const requested = useSearchParams()?.get("exam") as Id<"exams"> | null;
  const [selected, setSelected] = useState<Id<"exams"> | undefined>(
    requested ?? undefined,
  );
  const detail = useQuery(
    api.exams.exams.detail,
    selected ? { examId: selected } : "skip",
  );
  if (role === "teacher") return <TeacherExamWork locale={locale} />;
  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "অফলাইন পরীক্ষা" : "Offline exams"}</p>
        <h1>
          {bn
            ? "পরীক্ষা, পর্যালোচনা ও প্রকাশনা"
            : "Exams, review, and publication"}
        </h1>
        <p>
          {bn
            ? "প্রার্থী তালিকা ফ্রিজ করুন, বিষয়ভিত্তিক অগ্রগতি দেখুন এবং যাচাইকৃত সংস্করণ প্রকাশ করুন।"
            : "Freeze the audience, monitor subject-level progress, and publish a validated version."}
        </p>
      </header>
      <details className="editor-disclosure">
        <summary>
          {bn ? "পাঁচ ধাপে পরীক্ষা তৈরি করুন" : "Create an exam in five steps"}
        </summary>
        <ExamCreateWizard locale={locale} onCreated={setSelected} />
      </details>
      <div className="master-detail">
        <ExamWorkQueue
          locale={locale}
          selected={selected}
          onSelect={setSelected}
        />
        <section>
          {selected && detail === undefined ? (
            <PortalPageState state="loading" locale={locale} />
          ) : detail?.exam.modelVersion === 2 ? (
            <>
              <div className="detail-title">
                <div>
                  <p className="eyebrow">{detail.exam.examNumber}</p>
                  <h2>{bn ? detail.exam.nameBn : detail.exam.nameEn}</h2>
                </div>
                <span className="status-pill queued">{detail.exam.status}</span>
              </div>
              <OwnerReviewWorkspace locale={locale} examId={detail.exam._id} />
            </>
          ) : detail ? (
            <section className="warning-panel">
              <strong>
                {bn ? "পুরোনো সম্মিলিত ফল" : "Legacy combined result"}
              </strong>
              <p>
                {bn
                  ? "ঐতিহাসিক ফল অপরিবর্তিত রাখা হয়েছে। রিপোর্ট থেকে প্রকাশিত সংস্করণ দেখা ও প্রিন্ট করা যাবে।"
                  : "Historical values are preserved unchanged. Use Reports to view and print the published version."}
              </p>
            </section>
          ) : (
            <p className="empty-panel">
              {bn ? "একটি পরীক্ষা নির্বাচন করুন।" : "Select an exam."}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
