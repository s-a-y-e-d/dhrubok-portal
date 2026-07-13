"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";

export function ExamWorkQueue({
  locale,
  selected,
  onSelect,
}: {
  locale: "bn" | "en";
  selected?: Id<"exams">;
  onSelect: (id: Id<"exams">) => void;
}) {
  const bn = locale === "bn";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [needsMyAction, setNeedsMyAction] = useState(false);
  const [sessionId, setSessionId] = useState<Id<"academicSessions"> | "">("");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const sessions = useQuery(api.academics.sessions.list, {
    status: "active",
    paginationOpts: { numItems: 100, cursor: null },
  });
  const courses = useQuery(
    api.academics.courses.list,
    sessionId
      ? {
          academicSessionId: sessionId,
          status: "active",
          paginationOpts: { numItems: 100, cursor: null },
        }
      : "skip",
  );
  const result = useQuery(api.exams.exams.listManaged, {
    paginationOpts: { numItems: 100, cursor: null },
    search: search || undefined,
    status: status || undefined,
    needsMyAction: needsMyAction || undefined,
    academicSessionId: sessionId || undefined,
    courseId: courseId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  if (!result || !sessions)
    return <PortalPageState state="loading" locale={locale} />;
  return (
    <section>
      <div
        className="marks-toolbar"
        aria-label={bn ? "পরীক্ষা ফিল্টার" : "Exam filters"}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={bn ? "নাম বা পরীক্ষার নম্বর" : "Name or exam number"}
          aria-label={bn ? "পরীক্ষা খুঁজুন" : "Search exams"}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={bn ? "অবস্থা" : "Status"}
        >
          <option value="">{bn ? "সব অবস্থা" : "All statuses"}</option>
          <option value="draft">Draft</option>
          <option value="marks_entry">Marks in progress</option>
          <option value="marks_initializing">Initializing marks</option>
          <option value="ready_for_review">Ready for review</option>
          <option value="publication_processing">Publishing</option>
          <option value="published">Published</option>
          <option value="reopened">Reopened</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={sessionId}
          onChange={(event) => {
            setSessionId(event.target.value as Id<"academicSessions"> | "");
            setCourseId("");
          }}
          aria-label={bn ? "সেশন" : "Session"}
        >
          <option value="">{bn ? "সব সেশন" : "All sessions"}</option>
          {sessions.page.map((row) => (
            <option key={row._id} value={row._id}>
              {bn ? row.nameBn : row.nameEn}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          onChange={(event) =>
            setCourseId(event.target.value as Id<"courses"> | "")
          }
          disabled={!sessionId}
          aria-label={bn ? "কোর্স" : "Course"}
        >
          <option value="">{bn ? "সব কোর্স" : "All courses"}</option>
          {courses?.page.map((row) => (
            <option key={row._id} value={row._id}>
              {bn ? row.nameBn : row.nameEn}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label={bn ? "শুরুর তারিখ" : "From date"}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          aria-label={bn ? "শেষ তারিখ" : "To date"}
        />
        <label className="check-row">
          <input
            type="checkbox"
            checked={needsMyAction}
            onChange={(event) => setNeedsMyAction(event.target.checked)}
          />
          <span>{bn ? "আমার পদক্ষেপ দরকার" : "Needs my action"}</span>
        </label>
      </div>
      <div className="selection-list">
        {result.page.map((exam) => {
          const statusClass =
            exam.status === "published"
              ? "status-pill info"
              : exam.status === "ready_for_review"
                ? "status-pill late"
                : exam.status === "draft"
                  ? "status-pill"
                  : "status-pill late";

          const statusLabel =
            exam.status === "draft"
              ? (bn ? "খসড়া" : "Draft")
              : exam.status === "marks_entry"
                ? (bn ? "নম্বর এন্ট্রি" : "Marks entry")
                : exam.status === "ready_for_review"
                  ? (bn ? "পর্যালোচনা" : "Ready for review")
                  : exam.status === "published"
                    ? (bn ? "প্রকাশিত" : "Published")
                    : exam.status === "reopened"
                      ? (bn ? "পুনরায় উন্মুক্ত" : "Reopened")
                      : exam.status.replaceAll("_", " ");

          const modelLabel =
            exam.modelVersion === 2
              ? (bn ? "বিষয়ভিত্তিক" : "Subject-level")
              : (bn ? "পুরোনো ফল" : "Legacy result");

          const audienceLabel =
            exam.audienceMode?.replaceAll("_", " ") ??
            (bn ? "পুরোনো অডিয়েন্স" : "Legacy audience");

          return (
            <button
              key={exam._id}
              className={`exam-card ${selected === exam._id ? "selected" : ""}`}
              onClick={() => onSelect(exam._id)}
            >
              <div className="exam-card-header">
                <h3 className="exam-card-title">{bn ? exam.nameBn : exam.nameEn}</h3>
                <span className={statusClass}>{statusLabel}</span>
              </div>
              <div className="exam-card-meta">
                <div className="exam-card-meta-line">
                  <span>{exam.examNumber} · {exam.examDate}</span>
                  <span>{modelLabel}</span>
                </div>
                <div className="exam-card-meta-line">
                  <span>{bn ? exam.courseNameBn : exam.courseNameEn} ({audienceLabel})</span>
                  {exam.publicationVersion != null && <span>v{exam.publicationVersion}</span>}
                </div>
                <div className="exam-card-meta-line" style={{ marginTop: "4px" }}>
                  <span>
                    {exam.subjectCount} {bn ? "বিষয়" : "subjects"} ·{" "}
                    {exam.candidateCount ?? 0} {bn ? "প্রার্থী" : "candidates"}
                  </span>
                  <span style={{ fontWeight: 600 }}>{exam.completionPercentage}%</span>
                </div>
              </div>
              <div className="exam-progress-container">
                <div
                  className="exam-progress-bar"
                  style={{ width: `${exam.completionPercentage}%` }}
                  role="progressbar"
                  aria-valuenow={exam.completionPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={bn ? "নম্বর এন্ট্রি অগ্রগতি" : "Marks entry progress"}
                />
              </div>
            </button>
          );
        })}
      </div>
      {!result.page.length && (
        <p className="empty-panel">
          {bn ? "কোনো পরীক্ষা নেই।" : "No exams available."}
        </p>
      )}
    </section>
  );
}
