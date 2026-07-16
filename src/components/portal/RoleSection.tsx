"use client";

import Link from "next/link";
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Calendar,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { useQuery } from "convex/react";
import React, { useState, useEffect, useRef } from "react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";
import { OwnerWebsiteEditor } from "./OwnerEditors";
import { OwnerSettingsEditor } from "./OwnerWorkspaces";
import { CoursesWorkspace } from "./courses";
import { BatchesWorkspace } from "./batches";
import { TeachersWorkspace } from "./teachers";
import { FinanceEditor } from "./FinanceWorkspace";
import { AdmissionsEditor as AdmissionsWorkflow } from "./AdmissionsEditor";
import { AttendanceEditor as AttendanceWorkflow } from "./AttendanceEditor";
import { ExamEditor } from "./ExamEditor";
import { StudentExamResults } from "./exams/StudentExamResults";
import { ContentEditor } from "./ContentEditor";
import { ReportsEditor } from "./ReportsEditor";
import {
  StudentProfile,
  StudentRoutine,
  TeacherProfile,
  TeacherRoutine,
} from "./SelfService";
import {
  StudentMaterials as StudentMaterialsFlow,
  StudentNotices as StudentNoticesFlow,
} from "./StudentContent";
import { OwnerStudentsEditor } from "./OwnerStudentsEditor";
import { StudentFinance } from "./StudentFinance";
import { MessageHistory } from "./MessageHistory";
import styles from "./portal.module.css";

const page = { numItems: 50, cursor: null } as const;
const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(Date.now());
const bdt = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
  }).format(minor / 100);
const T = ({ children }: { children: React.ReactNode }) => (
  <div className="table-wrap">
    <table>{children}</table>
  </div>
);
const H = ({
  small,
  title,
  note,
  dateStr,
}: {
  small: string;
  title: string;
  note?: string;
  dateStr?: string;
}) => (
  <header className="portal-page-header">
    <p className="eyebrow">
      {small}
      {dateStr && <> · {dateStr}</>}
    </p>
    <h1>{title}</h1>
    {note && <p>{note}</p>}
  </header>
);
const Load = ({ locale }: { locale: "bn" | "en" }) => (
  <PortalPageState state="loading" locale={locale} />
);
const Empty = ({ locale, title }: { locale: "bn" | "en"; title: string }) => (
  <PortalPageState state="empty" locale={locale} emptyTitle={title} />
);
const Metric = ({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) => (
  <article className={`metric-card ${tone}`}>
    <p>{label}</p>
    <strong>{value}</strong>
  </article>
);

function OwnerDashboard({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const todayStr = localDate();
  const d = useQuery(api.reports.dashboards.owner, { date: todayStr });

  const [searchText, setSearchText] = useState("");
  const [debouncedText, setDebouncedText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useQuery(
    api.students.owner.searchStudentsForOwner,
    debouncedText.trim().length >= 2 ? { queryText: debouncedText } : "skip",
  );

  if (!d) return <Load locale={locale} />;

  const todayDisplay = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${todayStr}T00:00:00+06:00`));

  // Dynamic audit log formatting
  const formatActivityLog = (action: string) => {
    switch (action) {
      case "admission.accepted":
        return bn
          ? "ভর্তি আবেদন গ্রহণ করা হয়েছে"
          : "Admission application accepted";
      case "student.directly_admitted":
        return bn
          ? "সরাসরি শিক্ষার্থী ভর্তি করা হয়েছে"
          : "Student directly admitted";
      case "payment.posted":
        return bn ? "পেমেন্ট গ্রহণ করা হয়েছে" : "Payment posted";
      case "payment.voided":
        return bn ? "পেমেন্ট বাতিল করা হয়েছে" : "Payment voided";
      case "attendance.submitted":
        return bn
          ? "উপস্থিতি তালিকা জমা দেওয়া হয়েছে"
          : "Attendance roster submitted";
      case "exam.created":
        return bn ? "পরীক্ষা তৈরি করা হয়েছে" : "Exam created";
      case "exam.results_published":
        return bn
          ? "পরীক্ষার ফলাফল প্রকাশ করা হয়েছে"
          : "Exam results published";
      default:
        return action;
    }
  };

  // Determine highest priority alert slot
  let priorityAlert = null;
  if (d.smsFailures.value > 0) {
    priorityAlert = {
      text: bn
        ? `${d.smsFailures.value}টি এসএমএস ব্যর্থ হয়েছে।`
        : `${d.smsFailures.value} SMS deliveries failed.`,
      link: `/${locale}/owner/messages`,
      actionLabel: bn ? "এসএমএস চেক করুন" : "View messages",
      tone: "danger",
    };
  } else if (d.attendancePending > 0) {
    priorityAlert = {
      text: bn
        ? `${d.attendancePending}টি ক্লাসের উপস্থিতি বাকি আছে।`
        : `${d.attendancePending} classes missing attendance.`,
      link: `/${locale}/owner/attendance`,
      actionLabel: bn ? "উপস্থিতি নিন" : "Take attendance",
      tone: "warning",
    };
  } else if (d.resultsAwaitingReview.value > 0) {
    priorityAlert = {
      text: bn
        ? `${d.resultsAwaitingReview.value}টি পরীক্ষার ফল পর্যালোচনার অপেক্ষায়।`
        : `${d.resultsAwaitingReview.value} exam results awaiting review.`,
      link: `/${locale}/owner/exams`,
      actionLabel: bn ? "পর্যালোচনা করুন" : "Review results",
      tone: "info",
    };
  } else if (d.newApplications.value > 0) {
    priorityAlert = {
      text: bn
        ? `${d.newApplications.value}টি নতুন ভর্তি আবেদন জমা পড়েছে।`
        : `${d.newApplications.value} new admission applications pending.`,
      link: `/${locale}/owner/admissions`,
      actionLabel: bn ? "আবেদন পর্যালোচনা" : "Review applications",
      tone: "success",
    };
  }

  return (
    <>
      <H
        small={bn ? "আজকের চিত্র" : "Today at a glance"}
        dateStr={todayDisplay}
        title={bn ? "অপারেশন ড্যাশবোর্ড" : "Operations dashboard"}
        note={
          !d.summaryUpdatedAt
            ? bn
              ? "আজকের সারাংশ এখনো তৈরি হয়নি।"
              : "Today's operational summary has not run yet."
            : undefined
        }
      />

      {/* Global Student Search Panel */}
      <section className="section" style={{ marginBottom: "20px" }}>
        <div
          ref={searchRef}
          className={styles.studentSearchContainer}
          style={{ position: "relative" }}
        >
          <Search className={styles.studentSearchIcon} />
          <input
            type="text"
            className={styles.studentSearchInput}
            placeholder={
              bn
                ? "শিক্ষার্থীর নাম, রোল বা আইডি দিয়ে খুঁজুন..."
                : "Search students by name, roll, or ID..."
            }
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && searchText.trim().length >= 2 && (
            <div
              className="search-dropdown-results"
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "var(--canvas-soft)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                maxHeight: "300px",
                overflowY: "auto",
                marginTop: "4px",
                padding: "4px",
                zIndex: 100,
              }}
            >
              {searchResults === undefined ? (
                <div
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "var(--ink-mute)",
                  }}
                >
                  {bn ? "খোঁজা হচ্ছে..." : "Searching..."}
                </div>
              ) : searchResults.length === 0 ? (
                <div
                  style={{
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "13px",
                    color: "var(--ink-mute)",
                  }}
                >
                  {bn ? "কোনো শিক্ষার্থী পাওয়া যায়নি।" : "No students found."}
                </div>
              ) : (
                searchResults.map((s) => (
                  <div
                    key={s.studentId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderBottom: "1px solid var(--border)",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        minWidth: 0,
                      }}
                    >
                      <span
                        className={`status-pill ${s.status}`}
                        style={{ fontSize: "10px", padding: "2px 6px" }}
                      >
                        {s.status}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "13.5px",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {s.displayName}
                        </div>
                        <div
                          style={{ fontSize: "11px", color: "var(--ink-mute)" }}
                        >
                          {s.studentNumber}{" "}
                          {s.overdueMinor > 0 && (
                            <span style={{ color: "var(--warning)" }}>
                              · {bn ? "বকেয়া" : "Overdue"}:{" "}
                              {bdt(s.overdueMinor, locale)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      {s.status === "active" && (
                        <Link
                          href={`/${locale}/owner/finance?view=collect&student=${s.studentId}`}
                          className="button button-secondary"
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            minHeight: "auto",
                          }}
                        >
                          {bn ? "ফি সংগ্রহ" : "Collect Fee"}
                        </Link>
                      )}
                      <Link
                        href={`/${locale}/owner/students?student=${s.studentId}`}
                        className="button button-secondary"
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          minHeight: "auto",
                        }}
                      >
                        {bn ? "প্রোফাইল" : "Profile"}
                      </Link>
                      <Link
                        href={`/${locale}/owner/reports/students/${s.studentId}/statement`}
                        className="button button-secondary"
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          minHeight: "auto",
                        }}
                      >
                        {bn ? "বিবরণী" : "Statement"}
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* Priority Action Strip (Single Urgent Alert Slot) */}
      {priorityAlert && (
        <div
          className={`operation-form compact-form alert-${priorityAlert.tone}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            marginBottom: "20px",
            borderLeft: "4px solid",
            borderColor:
              priorityAlert.tone === "danger"
                ? "var(--danger)"
                : priorityAlert.tone === "warning"
                  ? "var(--warning)"
                  : "var(--brand)",
            backgroundColor: "var(--canvas-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {priorityAlert.tone === "danger" ? (
              <ShieldAlert style={{ color: "var(--danger)" }} />
            ) : priorityAlert.tone === "warning" ? (
              <AlertTriangle style={{ color: "var(--warning)" }} />
            ) : (
              <AlertCircle style={{ color: "var(--brand)" }} />
            )}
            <span style={{ fontWeight: 500, fontSize: "14px" }}>
              {priorityAlert.text}
            </span>
          </div>
          <Link
            href={priorityAlert.link}
            className="button button-primary"
            style={{ padding: "6px 12px", minHeight: "auto", fontSize: "12px" }}
          >
            {priorityAlert.actionLabel}
          </Link>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="metric-grid">
        <Metric
          label={bn ? "সক্রিয় শিক্ষার্থী" : "Active students"}
          value={d.activeStudents}
        />
        <Metric
          label={bn ? "আজকের আদায়" : "Collected today"}
          value={bdt(d.todayCollectionsMinor, locale)}
        />
        <Metric
          label={bn ? "বকেয়া" : "Overdue"}
          value={bdt(d.overdueMinor, locale)}
          tone={d.overdueMinor ? "warning" : ""}
        />
        <Metric
          label={bn ? "নতুন আবেদন" : "New applications"}
          value={d.newApplications.value}
        />
        <Metric
          label={bn ? "ফল পর্যালোচনা" : "Results to review"}
          value={d.resultsAwaitingReview.value}
        />
        <Metric
          label={bn ? "ব্যর্থ SMS" : "Failed SMS"}
          value={d.smsFailures.value}
          tone={d.smsFailures.value ? "danger" : ""}
        />
      </div>

      <div className="editor-grid" style={{ marginTop: "24px" }}>
        {/* Left Column: Today's Class Sessions + Needs Attention */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Needs Attention Checklist */}
          {(d.unlinkedTeachersCount > 0 ||
            d.batchesWithoutTeacherCount > 0 ||
            d.newApplications.value > 0 ||
            d.resultsAwaitingReview.value > 0) && (
            <section className="section">
              <h2>{bn ? "মনোযোগ প্রয়োজন" : "Needs attention"}</h2>
              <div
                className="card-grid"
                style={{ gridTemplateColumns: "1fr", gap: "8px" }}
              >
                {d.unlinkedTeachersCount > 0 && (
                  <article
                    className="content-card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "14px", margin: 0 }}>
                        {bn
                          ? "অসংযুক্ত শিক্ষক অ্যাকাউন্ট"
                          : "Unlinked teacher accounts"}
                      </h3>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-mute)",
                          margin: "4px 0 0",
                        }}
                      >
                        {bn
                          ? `${d.unlinkedTeachersCount} জন শিক্ষকের পোর্টাল লিঙ্ক করা হয়নি`
                          : `${d.unlinkedTeachersCount} teachers lack portal account linkage`}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/settings`}
                      className="button button-secondary"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        minHeight: "auto",
                      }}
                    >
                      {bn ? "সেটিংস" : "Settings"}
                    </Link>
                  </article>
                )}
                {d.batchesWithoutTeacherCount > 0 && (
                  <article
                    className="content-card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "14px", margin: 0 }}>
                        {bn
                          ? "শিক্ষকহীন সক্রিয় ব্যাচ"
                          : "Batches without teacher"}
                      </h3>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-mute)",
                          margin: "4px 0 0",
                        }}
                      >
                        {bn
                          ? `${d.batchesWithoutTeacherCount} টি ব্যাচে শিক্ষক অ্যাসাইন করা হয়নি`
                          : `${d.batchesWithoutTeacherCount} active batches lack active teachers`}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/courses`}
                      className="button button-secondary"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        minHeight: "auto",
                      }}
                    >
                      {bn ? "ব্যাচ অ্যাসাইন" : "Assign Batches"}
                    </Link>
                  </article>
                )}
                {d.newApplications.value > 0 && (
                  <article
                    className="content-card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "14px", margin: 0 }}>
                        {bn
                          ? "নতুন ভর্তি আবেদন"
                          : "New admissions applications"}
                      </h3>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-mute)",
                          margin: "4px 0 0",
                        }}
                      >
                        {bn
                          ? `${d.newApplications.value}টি নতুন আবেদন পর্যালোচনার অপেক্ষায়`
                          : `${d.newApplications.value} applications awaiting reviews`}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/admissions`}
                      className="button button-secondary"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        minHeight: "auto",
                      }}
                    >
                      {bn ? "পর্যালোচনা" : "Review"}
                    </Link>
                  </article>
                )}
                {d.resultsAwaitingReview.value > 0 && (
                  <article
                    className="content-card"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "14px", margin: 0 }}>
                        {bn ? "পরীক্ষার ফল প্রকাশ" : "Results awaiting review"}
                      </h3>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--ink-mute)",
                          margin: "4px 0 0",
                        }}
                      >
                        {bn
                          ? `${d.resultsAwaitingReview.value}টি পরীক্ষার ফল পর্যালোচনার অপেক্ষায়`
                          : `${d.resultsAwaitingReview.value} exams ready for owner publication`}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/owner/exams`}
                      className="button button-secondary"
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        minHeight: "auto",
                      }}
                    >
                      {bn ? "প্রকাশ করুন" : "Publish"}
                    </Link>
                  </article>
                )}
              </div>
            </section>
          )}

          {/* Today's Class Sessions (Chronological agenda list) */}
          <section className="section">
            <h2>{bn ? "আজকের ক্লাস ও সেশন" : "Today's class sessions"}</h2>
            {d.todaySessionsDetail.length === 0 ? (
              <p className="empty-panel">
                {bn
                  ? "আজ কোনো ক্লাস সেশন নেই।"
                  : "No class sessions scheduled today."}
              </p>
            ) : (
              <div
                className="card-grid"
                style={{ gridTemplateColumns: "1fr", gap: "8px" }}
              >
                {d.todaySessionsDetail.map((s) => (
                  <article
                    key={s.sessionId}
                    className="content-card"
                    style={{ padding: "12px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <p className="eyebrow" style={{ margin: 0 }}>
                        {s.subjectName} · {s.rosterCount}{" "}
                        {bn ? "জন" : "students"}
                      </p>
                      <span
                        className={`status-pill ${s.status === "submitted" ? "present" : "absent"}`}
                        style={{ fontSize: "10px" }}
                      >
                        {s.status}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "15px", margin: "4px 0" }}>
                      {s.batchName}
                    </h3>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-mute)",
                        margin: "2px 0 8px",
                      }}
                    >
                      {bn ? "শিক্ষক" : "Teacher"}: {s.teacherName} ·{" "}
                      {new Date(s.startsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(s.endsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {s.status === "open" && (
                      <Link
                        href={`/${locale}/owner/attendance?session=${s.sessionId}`}
                        className="button button-primary"
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          minHeight: "auto",
                          fontSize: "11px",
                        }}
                      >
                        {bn ? "উপস্থিতি মার্ক করুন" : "Take Attendance"}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Finance & Recent Activities */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Finance summary card */}
          <section className="section">
            <h2>{bn ? "আর্থিক সারাংশ" : "Financial summary"}</h2>
            <div
              className="card-grid"
              style={{
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <article className="content-card" style={{ padding: "10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "আজকের সংগ্রহ" : "Collected Today"}
                </p>
                <strong style={{ fontSize: "16px", color: "var(--brand)" }}>
                  {bdt(d.todayCollectionsMinor, locale)}
                </strong>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "10px",
                    color: "var(--ink-mute)",
                  }}
                >
                  {d.todayPaymentsCount} {bn ? "টি পেমেন্ট" : "payments"}
                </p>
              </article>
              <article className="content-card" style={{ padding: "10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "চলতি মাসে সংগ্রহ" : "Month Collections"}
                </p>
                <strong style={{ fontSize: "16px" }}>
                  {bdt(d.monthCollectionsMinor, locale)}
                </strong>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "10px",
                    color: "var(--ink-mute)",
                  }}
                >
                  {d.monthSummaryDays} {bn ? "দিন প্রিভিউ" : "days tracked"}
                </p>
              </article>
              <article className="content-card" style={{ padding: "10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "সক্রিয় শিক্ষার্থীর বকেয়া" : "Active Outstanding"}
                </p>
                <strong style={{ fontSize: "16px" }}>
                  {bdt(d.activeOutstandingMinor, locale)}
                </strong>
              </article>
              <article className="content-card" style={{ padding: "10px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    color: "var(--ink-mute)",
                    textTransform: "uppercase",
                  }}
                >
                  {bn ? "ওভারডিউ বকেয়া" : "Total Overdue"}
                </p>
                <strong style={{ fontSize: "16px", color: "var(--warning)" }}>
                  {bdt(d.overdueMinor, locale)}
                </strong>
              </article>
            </div>

            {/* Recent Payments list */}
            <h3>{bn ? "সাম্প্রতিক পেমেন্ট" : "Recent payments"}</h3>
            {d.recentPayments.length === 0 ? (
              <p
                className="empty-panel"
                style={{ padding: "12px", fontSize: "12px" }}
              >
                {bn ? "কোনো পেমেন্ট সংগ্রহ করা হয়নি।" : "No recent payments."}
              </p>
            ) : (
              <div className="table-wrap">
                <table style={{ fontSize: "12.5px" }}>
                  <thead>
                    <tr>
                      <th>{bn ? "রশিদ" : "Receipt"}</th>
                      <th>{bn ? "শিক্ষার্থী" : "Student"}</th>
                      <th>{bn ? "পরিমাণ" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentPayments.map((p) => (
                      <tr key={p.paymentId}>
                        <td>
                          <Link
                            href={`/${locale}/owner/receipt/${p.paymentId}`}
                            style={{ fontWeight: 600 }}
                          >
                            {p.paymentNumber}
                          </Link>
                        </td>
                        <td>
                          <div>{p.studentName}</div>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "var(--ink-mute)",
                            }}
                          >
                            {p.studentNumber}
                          </div>
                        </td>
                        <td>{bdt(p.amountMinor, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Activity Feed panel */}
          <section className="section">
            <h2>{bn ? "সাম্প্রতিক কর্মকাণ্ড অডিট" : "Recent Activity Feed"}</h2>
            {d.recentActivities.length === 0 ? (
              <p className="empty-panel">
                {bn ? "কোনো কর্মকাণ্ড রেকর্ড নেই।" : "No recent logs recorded."}
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  borderLeft: "2px solid var(--border)",
                  paddingLeft: "14px",
                  marginLeft: "6px",
                }}
              >
                {d.recentActivities.map((log) => (
                  <div key={log.logId} style={{ position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        left: "-21px",
                        top: "5px",
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        backgroundColor: "var(--brand)",
                        border: "2px solid var(--canvas)",
                      }}
                    />
                    <div style={{ fontSize: "12px", color: "var(--ink-mute)" }}>
                      {new Date(log.occurredAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {log.actorName} ({log.actorRole})
                    </div>
                    <div
                      style={{
                        fontSize: "13.5px",
                        fontWeight: 500,
                        margin: "2px 0",
                      }}
                    >
                      {formatActivityLog(log.action)}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--ink-mute)" }}>
                      {log.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function OwnerStudents({ locale }: { locale: "bn" | "en" }) {
  return <OwnerStudentsEditor locale={locale} />;
}
function OwnerAdmissions({ locale }: { locale: "bn" | "en" }) {
  return <AdmissionsWorkflow locale={locale} />;
}
function OwnerMessages({ locale }: { locale: "bn" | "en" }) {
  return <MessageHistory locale={locale} />;
}

function TeacherDashboard({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const todayStr = localDate();
  const d = useQuery(api.reports.dashboards.teacher, { date: todayStr });

  if (!d) return <Load locale={locale} />;

  // Find next class session that is open
  const nextClass = d.todaySessions.find((s) => s.status === "open");

  return (
    <>
      <H
        small={bn ? "আজকের কাজ" : "Today's work"}
        title={bn ? "শিক্ষক ড্যাশবোর্ড" : "Teacher dashboard"}
      />

      {/* Spotlight Card for next class requiring attendance */}
      {nextClass && (
        <section className="section" style={{ marginBottom: "20px" }}>
          <article
            className="spotlight-card"
            style={{
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                className="eyebrow"
                style={{ margin: 0, color: "var(--brand)" }}
              >
                {bn
                  ? "পরবর্তী উপস্থিতির এন্ট্রি"
                  : "Spotlight: Next Class Attendance"}
              </p>
              <h2 style={{ fontSize: "20px", margin: "6px 0 2px" }}>
                {nextClass.batchName}
              </h2>
              <p style={{ margin: 0 }}>
                {nextClass.subjectName} · {nextClass.rosterCount}{" "}
                {bn ? "জন শিক্ষার্থী" : "students"}
              </p>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--ink-mute)",
                  marginTop: "4px",
                }}
              >
                {new Date(nextClass.startsAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {new Date(nextClass.endsAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Link
              href={`/${locale}/teacher/attendance?session=${nextClass.sessionId}`}
              className="button button-primary"
            >
              {bn ? "উপস্থিতি নিন" : "Take Attendance"}
            </Link>
          </article>
        </section>
      )}

      {/* Workload metric counters */}
      <div className="metric-grid">
        <Metric
          label={bn ? "নির্ধারিত ব্যাচ" : "Assigned batches"}
          value={d.assignedBatchCount}
        />
        <Metric
          label={bn ? "আজকের ক্লাস" : "Today's classes"}
          value={d.todaySessions.length}
        />
        <Metric
          label={bn ? "উপস্থিতি বাকি" : "Attendance pending"}
          value={d.attendancePending}
          tone={d.attendancePending ? "warning" : ""}
        />
        <Metric
          label={bn ? "নির্ধারিত পরীক্ষা" : "Assigned exams"}
          value={d.assignedExams.length}
        />
      </div>

      <div className="editor-grid" style={{ marginTop: "24px" }}>
        {/* Left Column: Today's Schedule List */}
        <section className="section">
          <h2>{bn ? "আজকের ক্লাসের সময়সূচী" : "Today's class schedule"}</h2>
          {d.todaySessions.length === 0 ? (
            <p className="empty-panel">
              {bn ? "আজ কোনো ক্লাস নেই।" : "No class sessions scheduled today."}
            </p>
          ) : (
            <div
              className="card-grid"
              style={{ gridTemplateColumns: "1fr", gap: "10px" }}
            >
              {d.todaySessions.map((s) => (
                <article
                  key={s.sessionId}
                  className="content-card"
                  style={{ padding: "14px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p className="eyebrow" style={{ margin: 0 }}>
                      {s.subjectName} · {s.rosterCount}{" "}
                      {bn ? "শিক্ষার্থী" : "students"}
                    </p>
                    <span
                      className={`status-pill ${s.status === "submitted" ? "present" : "absent"}`}
                      style={{ fontSize: "10px" }}
                    >
                      {s.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "16px", margin: "6px 0" }}>
                    {s.batchName}
                  </h3>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: "4px",
                    }}
                  >
                    <span
                      style={{ fontSize: "12px", color: "var(--ink-mute)" }}
                    >
                      {new Date(s.startsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(s.endsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {s.status === "open" && (
                      <Link
                        href={`/${locale}/teacher/attendance?session=${s.sessionId}`}
                        className="button button-secondary"
                        style={{
                          padding: "4px 8px",
                          minHeight: "auto",
                          fontSize: "11px",
                        }}
                      >
                        {bn ? "উপস্থিতি" : "Roster"}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Pending Marks Checklist */}
        <section className="section">
          <h2>{bn ? "পরীক্ষার নম্বর এন্ট্রি" : "Pending marks entry"}</h2>
          {d.assignedExams.length === 0 ? (
            <p className="empty-panel">
              {bn ? "কোনো পরীক্ষা নির্ধারিত নেই।" : "No assigned exams."}
            </p>
          ) : (
            <div
              className="card-grid"
              style={{ gridTemplateColumns: "1fr", gap: "8px" }}
            >
              {d.assignedExams.map((e) => {
                const isPending =
                  (e.status === "marks_entry" || e.status === "reopened") &&
                  e.completedCount < e.totalCandidates;
                return (
                  <article
                    key={e.examId}
                    className="content-card"
                    style={{ padding: "12px", opacity: isPending ? 1 : 0.85 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <p className="eyebrow" style={{ margin: 0 }}>
                        {e.subjectName} · {e.mode}
                      </p>
                      <span
                        className={`status-pill ${isPending ? "absent" : "present"}`}
                        style={{ fontSize: "10px" }}
                      >
                        {isPending
                          ? bn
                            ? "বাকি আছে"
                            : "Incomplete"
                          : bn
                            ? "সম্পূর্ণ"
                            : "Complete"}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "15px", margin: "4px 0" }}>
                      {e.examName}
                    </h3>
                    <p
                      style={{
                        fontSize: "12.5px",
                        color: "var(--ink-mute)",
                        margin: "2px 0 8px",
                      }}
                    >
                      {bn ? "ব্যাচ" : "Batch"}: {e.batchName} ·{" "}
                      {bn ? "তারিখ" : "Date"}: {e.examDate}
                    </p>

                    {/* Progress Bar indicator */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: "6px",
                          backgroundColor: "var(--canvas-subtle)",
                          borderRadius: "3px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${e.totalCandidates > 0 ? (e.completedCount / e.totalCandidates) * 100 : 0}%`,
                            height: "100%",
                            backgroundColor: isPending
                              ? "var(--warning)"
                              : "var(--brand)",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 600 }}>
                        {e.completedCount} / {e.totalCandidates}
                      </span>
                    </div>

                    {isPending && (
                      <Link
                        href={`/${locale}/teacher/exams?exam=${e.examId}`}
                        className="button button-primary"
                        style={{
                          padding: "4px 8px",
                          minHeight: "auto",
                          fontSize: "11px",
                        }}
                      >
                        {bn ? "নম্বর এন্ট্রি করুন" : "Enter Marks"}
                      </Link>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function TeacherBatches({ locale }: { locale: "bn" | "en" }) {
  const d = useQuery(api.academics.readModels.teacherAssignedBatches, {});
  const bn = locale === "bn";
  if (!d) return <Load locale={locale} />;
  return (
    <>
      <H
        small={bn ? "একাডেমিক" : "Academic"}
        title={bn ? "আমার ব্যাচ" : "My batches"}
      />
      {d.length ? (
        <div className="card-grid">
          {d.map((x) => (
            <article
              className="content-card"
              key={`${x.batchId}:${x.subjectId || "all"}`}
            >
              <p className="eyebrow">{x.code}</p>
              <h2>{bn ? x.nameBn : x.nameEn}</h2>
              <p>{bn ? x.courseNameBn : x.courseNameEn}</p>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          locale={locale}
          title={bn ? "কোনো ব্যাচ নির্ধারিত নেই" : "No assigned batches"}
        />
      )}
    </>
  );
}

function TeacherAttendance({ locale }: { locale: "bn" | "en" }) {
  return <AttendanceWorkflow locale={locale} />;
}

function StudentDashboard({ locale }: { locale: "bn" | "en" }) {
  const d = useQuery(api.reports.dashboards.student, {});
  const bn = locale === "bn";
  const todayStr = localDate();
  if (!d) return <Load locale={locale} />;

  // Find first unread notice spotlight
  const unreadNotice = d.recentNotices.find((n) => n.readAt === null);

  return (
    <>
      <H
        small={bn ? "আমার অগ্রগতি" : "My progress"}
        title={bn ? "শিক্ষার্থী ড্যাশবোর্ড" : "Student dashboard"}
      />

      {/* 1. spotlight class at the absolute top of the page */}
      {d.nextClass && (
        <section className="section" style={{ marginBottom: "16px" }}>
          <article className="spotlight-card" style={{ padding: "18px" }}>
            <p className="eyebrow" style={{ margin: 0, color: "var(--brand)" }}>
              {bn ? "পরবর্তী লাইভ ক্লাস" : "Next Live Session"}
            </p>
            <h2 style={{ fontSize: "19px", margin: "6px 0 2px" }}>
              {d.nextClass.batchName}
            </h2>
            <p style={{ margin: 0, fontSize: "13.5px" }}>
              {d.nextClass.subjectName} · {bn ? "শিক্ষক" : "Teacher"}:{" "}
              {d.nextClass.teacherName}
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--ink-mute)",
                marginTop: "4px",
              }}
            >
              {d.nextClass.date} (
              {Math.floor(d.nextClass.startMinutes / 60)
                .toString()
                .padStart(2, "0")}
              :{(d.nextClass.startMinutes % 60).toString().padStart(2, "0")} -{" "}
              {Math.floor(d.nextClass.endMinutes / 60)
                .toString()
                .padStart(2, "0")}
              :{(d.nextClass.endMinutes % 60).toString().padStart(2, "0")})
            </p>
          </article>
        </section>
      )}

      {/* 2. Spotlight unread notice immediately below class spotlight */}
      {unreadNotice && (
        <section className="section" style={{ marginBottom: "16px" }}>
          <div
            className="operation-form compact-form"
            style={{
              padding: "16px",
              borderLeft: "4px solid var(--brand)",
              backgroundColor: "var(--canvas-soft)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                marginBottom: "6px",
              }}
            >
              <AlertCircle style={{ color: "var(--brand)" }} />
              <strong style={{ fontSize: "14px" }}>
                {bn ? "নতুন গুরুত্বপূর্ণ নোটিশ" : "New Notice Alert"}
              </strong>
            </div>
            <h3 style={{ fontSize: "15px", margin: "0 0 4px" }}>
              {unreadNotice.title}
            </h3>
            <p
              style={{
                fontSize: "12.5px",
                color: "var(--ink-secondary)",
                margin: "0 0 8px",
                lineHeight: "1.4",
              }}
            >
              {unreadNotice.body}
            </p>
            <Link
              href={`/${locale}/student/notices`}
              className="button button-secondary"
              style={{
                padding: "4px 8px",
                minHeight: "auto",
                fontSize: "11px",
              }}
            >
              {bn ? "নোটিশ বোর্ড দেখুন" : "View Noticeboard"}
            </Link>
          </div>
        </section>
      )}

      {/* Roster performance and outstanding fees metrics grid */}
      <div className="metric-grid">
        <Metric
          label={bn ? "উপস্থিতি" : "Attendance"}
          value={
            d.attendancePercentage === null ? "—" : `${d.attendancePercentage}%`
          }
        />
        <Metric
          label={bn ? "বকেয়া" : "Outstanding"}
          value={bdt(d.outstandingMinor, locale)}
          tone={d.overdueMinor ? "warning" : ""}
        />
        <Metric
          label={bn ? "অগ্রিম" : "Advance"}
          value={bdt(d.advanceCreditMinor, locale)}
        />
        <Metric
          label={bn ? "নতুন নোটিশ" : "Unread notices"}
          value={d.unreadNotices}
        />
      </div>

      <div className="editor-grid" style={{ marginTop: "24px" }}>
        {/* Left Column: Weekly Routine Schedule agenda */}
        <section className="section">
          <h2>{bn ? "আমার সাপ্তাহিক ক্লাস রুটিন" : "My schedule this week"}</h2>
          {d.thisWeekClasses.length === 0 ? (
            <p className="empty-panel">
              {bn
                ? "এই সপ্তাহে কোনো ক্লাস নেই।"
                : "No classes scheduled for this week."}
            </p>
          ) : (
            <div
              className="card-grid"
              style={{ gridTemplateColumns: "1fr", gap: "8px" }}
            >
              {d.thisWeekClasses.map((c, i) => (
                <article
                  key={i}
                  className="content-card"
                  style={{
                    padding: "12px",
                    borderLeft:
                      c.date === todayStr
                        ? "4px solid var(--brand)"
                        : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p className="eyebrow" style={{ margin: 0 }}>
                      {c.subjectName}
                    </p>
                    <span
                      className="status-pill present"
                      style={{ fontSize: "9px", padding: "1px 5px" }}
                    >
                      {c.date}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "14.5px", margin: "4px 0" }}>
                    {c.batchName}
                  </h3>
                  <p
                    style={{
                      fontSize: "11.5px",
                      color: "var(--ink-mute)",
                      margin: 0,
                    }}
                  >
                    {bn ? "শিক্ষক" : "Teacher"}: {c.teacherName} ·{" "}
                    {Math.floor(c.startMinutes / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(c.startMinutes % 60).toString().padStart(2, "0")} -{" "}
                    {Math.floor(c.endMinutes / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(c.endMinutes % 60).toString().padStart(2, "0")}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Grades and Financial summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Recent Exam Results */}
          <section className="section">
            <h2>{bn ? "সাম্প্রতিক ফলাফল" : "Recent exam results"}</h2>
            {d.recentResults.length === 0 ? (
              <p className="empty-panel">
                {bn ? "কোনো পরীক্ষার ফলাফল নেই।" : "No exam results found."}
              </p>
            ) : (
              <div
                className="card-grid"
                style={{ gridTemplateColumns: "1fr", gap: "8px" }}
              >
                {d.recentResults.map((r, i) => (
                  <article
                    key={i}
                    className="content-card"
                    style={{ padding: "12px" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        className={`status-pill ${r.passed ? "present" : "absent"}`}
                        style={{ fontSize: "10px" }}
                      >
                        {r.passed ? (bn ? "পাস" : "Pass") : bn ? "ফেল" : "Fail"}
                      </span>
                      <span
                        style={{ fontSize: "11px", color: "var(--ink-mute)" }}
                      >
                        {new Date(r.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "14px", margin: "6px 0 4px" }}>
                      {r.examName}
                    </h3>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--ink-mute)",
                        margin: 0,
                      }}
                    >
                      {bn ? "স্কোর" : "Score"}:{" "}
                      <strong>
                        {r.totalScoreScaled == null
                          ? "—"
                          : (r.totalScoreScaled / 100).toFixed(2)}
                      </strong>{" "}
                      · {bn ? "মেধা" : "Merit"}: {r.meritPosition ?? "—"}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Financial summary and last payment */}
          <section className="section">
            <h2>{bn ? "ফি ও পেমেন্ট হিস্ট্রি" : "Fees & payments status"}</h2>
            <div
              className="card-grid"
              style={{ gridTemplateColumns: "1fr", gap: "10px" }}
            >
              <article className="content-card" style={{ padding: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "12px",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {bn
                      ? "পরবর্তী পেমেন্টের শেষ তারিখ"
                      : "Next Payment Due Date"}
                  </p>
                  <Calendar
                    style={{
                      width: "16px",
                      height: "16px",
                      color: "var(--warning)",
                    }}
                  />
                </div>
                <strong
                  style={{
                    fontSize: "16px",
                    color: d.overdueMinor > 0 ? "var(--warning)" : "inherit",
                  }}
                >
                  {d.nextDueDate
                    ? d.nextDueDate
                    : bn
                      ? "কোনো বকেয়া নেই"
                      : "No due dates"}
                </strong>
              </article>
              {d.lastPayment && (
                <article className="content-card" style={{ padding: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        color: "var(--ink-mute)",
                      }}
                    >
                      {bn
                        ? "সর্বশেষ পরিশোধিত পেমেন্ট"
                        : "Last Payment Received"}
                    </p>
                    <CheckCircle
                      style={{
                        width: "16px",
                        height: "16px",
                        color: "var(--brand)",
                      }}
                    />
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--brand)" }}>
                    {bdt(d.lastPayment.amountMinor, locale)}
                  </strong>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: "var(--ink-mute)",
                    }}
                  >
                    {bn ? "পরিশোধের তারিখ" : "Paid at"}:{" "}
                    {new Date(d.lastPayment.paidAt).toLocaleDateString()}
                  </p>
                </article>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function StudentAttendance({ locale }: { locale: "bn" | "en" }) {
  const d = useQuery(api.attendance.functions.myHistory, {
    paginationOpts: page,
  });
  const bn = locale === "bn";
  if (!d) return <Load locale={locale} />;
  return (
    <>
      <H
        small={bn ? "ইতিহাস" : "History"}
        title={bn ? "আমার উপস্থিতি" : "My attendance"}
      />
      {d.page.length ? (
        <T>
          <thead>
            <tr>
              <th>{bn ? "সময়" : "Date"}</th>
              <th>{bn ? "অবস্থা" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {d.page.map((r) => (
              <tr key={r.recordId}>
                <td>{new Date(r.submittedAt).toLocaleString()}</td>
                <td>
                  <span className={`status-pill ${r.status}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </T>
      ) : (
        <Empty
          locale={locale}
          title={bn ? "উপস্থিতির ইতিহাস নেই" : "No attendance history"}
        />
      )}
    </>
  );
}

function StudentFees({ locale }: { locale: "bn" | "en" }) {
  return <StudentFinance locale={locale} />;
}

function StudentMaterials({ locale }: { locale: "bn" | "en" }) {
  return <StudentMaterialsFlow locale={locale} />;
}
function StudentNotices({ locale }: { locale: "bn" | "en" }) {
  return <StudentNoticesFlow locale={locale} />;
}

export function RoleSection({
  role,
  locale,
  section,
}: {
  role: "owner" | "teacher" | "student";
  locale: "bn" | "en";
  section?: string;
}) {
  if (role === "owner") {
    if (section === "students") return <OwnerStudents locale={locale} />;
    if (section === "admissions") return <OwnerAdmissions locale={locale} />;
    if (section === "messages") return <OwnerMessages locale={locale} />;
    if (section === "notices")
      return (
        <ContentEditor locale={locale} role="owner" initialTab="notices" />
      );
    if (section === "materials")
      return <ContentEditor locale={locale} role="owner" />;
    if (section === "courses") return <CoursesWorkspace locale={locale} />;
    if (section === "batches") return <BatchesWorkspace locale={locale} />;
    if (section === "teachers") return <TeachersWorkspace locale={locale} />;
    if (section === "attendance") return <AttendanceWorkflow locale={locale} />;
    if (section === "finance") return <FinanceEditor locale={locale} />;
    if (section === "exams") return <ExamEditor locale={locale} role="owner" />;
    if (section === "reports") return <ReportsEditor locale={locale} />;
    if (section === "website") return <OwnerWebsiteEditor locale={locale} />;
    if (section === "settings") return <OwnerSettingsEditor locale={locale} />;
    return <OwnerDashboard locale={locale} />;
  }
  if (role === "teacher") {
    if (section === "batches") return <TeacherBatches locale={locale} />;
    if (section === "routine") return <TeacherRoutine locale={locale} />;
    if (section === "attendance") return <TeacherAttendance locale={locale} />;
    if (section === "exams")
      return <ExamEditor locale={locale} role="teacher" />;
    if (section === "materials")
      return <ContentEditor locale={locale} role="teacher" />;
    if (section === "notices")
      return (
        <ContentEditor locale={locale} role="teacher" initialTab="notices" />
      );
    if (section === "profile") return <TeacherProfile locale={locale} />;
    return <TeacherDashboard locale={locale} />;
  }
  if (section === "routine") return <StudentRoutine locale={locale} />;
  if (section === "attendance") return <StudentAttendance locale={locale} />;
  if (section === "fees") return <StudentFees locale={locale} />;
  if (section === "results") return <StudentExamResults locale={locale} />;
  if (section === "materials") return <StudentMaterials locale={locale} />;
  if (section === "notices") return <StudentNotices locale={locale} />;
  if (section === "profile") return <StudentProfile locale={locale} />;
  return <StudentDashboard locale={locale} />;
}
