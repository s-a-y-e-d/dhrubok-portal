"use client";

import Link from "next/link";
import { Users, UserPlus, MessageSquare, BarChart3 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";
import { OwnerWebsiteEditor } from "./OwnerEditors";
import { OwnerSettingsEditor } from "./OwnerWorkspaces";
import { AcademicEditor } from "./academics";
import { FinanceEditor } from "./FinanceWorkspace";
import { AdmissionsEditor as AdmissionsWorkflow } from "./AdmissionsEditor";
import { AttendanceEditor as AttendanceWorkflow } from "./AttendanceEditor";
import { ExamEditor } from "./ExamEditor";
import { ContentEditor } from "./ContentEditor";
import { ReportsEditor } from "./ReportsEditor";
import { StudentProfile, StudentRoutine, TeacherProfile, TeacherRoutine } from "./SelfService";
import { StudentMaterials as StudentMaterialsFlow, StudentNotices as StudentNoticesFlow } from "./StudentContent";
import { OwnerStudentsEditor } from "./OwnerStudentsEditor";
import { StudentFinance } from "./StudentFinance";
import { MessageHistory } from "./MessageHistory";

const page = { numItems: 50, cursor: null } as const;
const localDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(Date.now());
const bdt = (minor: number, locale: "bn" | "en") => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT" }).format(minor / 100);
const T = ({ children }: { children: React.ReactNode }) => <div className="table-wrap"><table>{children}</table></div>;
const H = ({ small, title, note, dateStr }: { small: string; title: string; note?: string; dateStr?: string }) => <header className="portal-page-header"><p className="eyebrow">{small}{dateStr && <> · {dateStr}</>}</p><h1>{title}</h1>{note && <p>{note}</p>}</header>;
const Load = ({ locale }: { locale: "bn" | "en" }) => <PortalPageState state="loading" locale={locale} />;
const Empty = ({ locale, title }: { locale: "bn" | "en"; title: string }) => <PortalPageState state="empty" locale={locale} emptyTitle={title} />;
const Metric = ({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) => <article className={`metric-card ${tone}`}><p>{label}</p><strong>{value}</strong></article>;

function OwnerDashboard({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.reports.dashboards.owner, { date: localDate() }); if (!d) return <Load locale={locale} />; const bn = locale === "bn"; const todayDisplay = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${localDate()}T00:00:00+06:00`)); return <><H small={bn ? "আজকের চিত্র" : "Today at a glance"} dateStr={todayDisplay} title={bn ? "অপারেশন ড্যাশবোর্ড" : "Operations dashboard"} note={!d.summaryUpdatedAt ? (bn ? "আজকের সারাংশ এখনো তৈরি হয়নি।" : "Today's operational summary has not run yet.") : undefined} /><div className="metric-grid"><Metric label={bn ? "সক্রিয় শিক্ষার্থী" : "Active students"} value={d.activeStudents} /><Metric label={bn ? "আজকের আদায়" : "Collected today"} value={bdt(d.todayCollectionsMinor, locale)} /><Metric label={bn ? "বকেয়া" : "Overdue"} value={bdt(d.overdueMinor, locale)} tone={d.overdueMinor ? "warning" : ""} /><Metric label={bn ? "নতুন আবেদন" : "New applications"} value={d.newApplications.value} /><Metric label={bn ? "ফল পর্যালোচনা" : "Results to review"} value={d.resultsAwaitingReview.value} /><Metric label={bn ? "ব্যর্থ SMS" : "Failed SMS"} value={d.smsFailures.value} tone={d.smsFailures.value ? "danger" : ""} /></div><div className="quick-grid"><Link href={`/${locale}/owner/students`}><Users aria-hidden="true" />{bn ? "শিক্ষার্থী" : "Students"}</Link><Link href={`/${locale}/owner/admissions`}><UserPlus aria-hidden="true" />{bn ? "ভর্তি আবেদন" : "Admissions"}</Link><Link href={`/${locale}/owner/messages`}><MessageSquare aria-hidden="true" />SMS</Link><Link href={`/${locale}/owner/reports`}><BarChart3 aria-hidden="true" />{bn ? "রিপোর্ট" : "Reports"}</Link></div></>; }

function OwnerStudents({ locale }: { locale: "bn" | "en" }) { return <OwnerStudentsEditor locale={locale} />; }

function OwnerAdmissions({ locale }: { locale: "bn" | "en" }) { return <AdmissionsWorkflow locale={locale} />; }

function OwnerMessages({ locale }: { locale: "bn" | "en" }) { return <MessageHistory locale={locale} />; }

function TeacherDashboard({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.reports.dashboards.teacher, { date: localDate() }); const bn = locale === "bn"; if (!d) return <Load locale={locale} />; return <><H small={bn ? "আজকের কাজ" : "Today's work"} title={bn ? "শিক্ষক ড্যাশবোর্ড" : "Teacher dashboard"} /><div className="metric-grid"><Metric label={bn ? "নির্ধারিত ব্যাচ" : "Assigned batches"} value={d.assignedBatchCount} /><Metric label={bn ? "আজকের ক্লাস" : "Today's classes"} value={d.todaySessions.length} /><Metric label={bn ? "উপস্থিতি বাকি" : "Attendance pending"} value={d.attendancePending} tone={d.attendancePending ? "warning" : ""} /><Metric label={bn ? "নির্ধারিত পরীক্ষা" : "Assigned exams"} value={d.assignedExams.length} /></div></>; }

function TeacherBatches({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.academics.readModels.teacherAssignedBatches, {}); const bn = locale === "bn"; if (!d) return <Load locale={locale} />; return <><H small={bn ? "একাডেমিক" : "Academic"} title={bn ? "আমার ব্যাচ" : "My batches"} />{d.length ? <div className="card-grid">{d.map((x) => <article className="content-card" key={`${x.batchId}:${x.subjectId || "all"}`}><p className="eyebrow">{x.code}</p><h2>{bn ? x.nameBn : x.nameEn}</h2><p>{bn ? x.courseNameBn : x.courseNameEn}</p></article>)}</div> : <Empty locale={locale} title={bn ? "কোনো ব্যাচ নির্ধারিত নেই" : "No assigned batches"} />}</>; }

function TeacherAttendance({ locale }: { locale: "bn" | "en" }) { return <AttendanceWorkflow locale={locale} />; }

function StudentDashboard({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.reports.dashboards.student, {}); const bn = locale === "bn"; if (!d) return <Load locale={locale} />; return <><H small={bn ? "আমার অগ্রগতি" : "My progress"} title={bn ? "শিক্ষার্থী ড্যাশবোর্ড" : "Student dashboard"} /><div className="metric-grid"><Metric label={bn ? "উপস্থিতি" : "Attendance"} value={d.attendancePercentage === null ? "—" : `${d.attendancePercentage}%`} /><Metric label={bn ? "বকেয়া" : "Outstanding"} value={bdt(d.outstandingMinor, locale)} tone={d.overdueMinor ? "warning" : ""} /><Metric label={bn ? "অগ্রিম" : "Advance"} value={bdt(d.advanceCreditMinor, locale)} /><Metric label={bn ? "নতুন নোটিশ" : "Unread notices"} value={d.unreadNotices} /></div>{d.nextClass && <article className="spotlight-card"><p className="eyebrow">{bn ? "পরবর্তী ক্লাস" : "Next class"}</p><h2>{d.nextClass.batchName}</h2><p>{d.nextClass.subjectName} · {d.nextClass.date}</p></article>}</>; }

function StudentAttendance({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.attendance.functions.myHistory, { paginationOpts: page }); const bn = locale === "bn"; if (!d) return <Load locale={locale} />; return <><H small={bn ? "ইতিহাস" : "History"} title={bn ? "আমার উপস্থিতি" : "My attendance"} />{d.page.length ? <T><thead><tr><th>{bn ? "সময়" : "Date"}</th><th>{bn ? "অবস্থা" : "Status"}</th></tr></thead><tbody>{d.page.map((r) => <tr key={r.recordId}><td>{new Date(r.submittedAt).toLocaleString()}</td><td><span className={`status-pill ${r.status}`}>{r.status}</span></td></tr>)}</tbody></T> : <Empty locale={locale} title={bn ? "উপস্থিতির ইতিহাস নেই" : "No attendance history"} />}</>; }

function StudentFees({ locale }: { locale: "bn" | "en" }) { return <StudentFinance locale={locale} />; }

function StudentResults({ locale }: { locale: "bn" | "en" }) { const d = useQuery(api.exams.functions.myPublishedResults, { paginationOpts: page }); const bn = locale === "bn"; if (!d) return <Load locale={locale} />; return <><H small={bn ? "প্রকাশিত" : "Published"} title={bn ? "আমার ফলাফল" : "My results"} />{d.page.length ? <T><thead><tr><th>{bn ? "পরীক্ষা" : "Exam"}</th><th>{bn ? "নম্বর" : "Score"}</th><th>{bn ? "ফল" : "Outcome"}</th><th>{bn ? "মেধা" : "Merit"}</th></tr></thead><tbody>{d.page.map((r) => <tr key={`${r.examId}:${r.publicationVersion}`}><td>{bn ? r.nameBn : r.nameEn}<small>{r.publicationVersion > 1 ? `Corrected · v${r.publicationVersion}` : r.examDate}</small></td><td>{(r.totalScoreScaled / 100).toFixed(2)} / {(r.totalFullMarksScaled / 100).toFixed(2)}</td><td>{r.passed ? (bn ? "পাস" : "Pass") : (bn ? "ফেল" : "Fail")}</td><td>{r.meritPosition ?? "—"}</td></tr>)}</tbody></T> : <Empty locale={locale} title={bn ? "প্রকাশিত ফল নেই" : "No published results"} />}</>; }

function StudentMaterials({ locale }: { locale: "bn" | "en" }) { return <StudentMaterialsFlow locale={locale} />; }

function StudentNotices({ locale }: { locale: "bn" | "en" }) { return <StudentNoticesFlow locale={locale} />; }

export function RoleSection({ role, locale, section }: { role: "owner" | "teacher" | "student"; locale: "bn" | "en"; section?: string }) {
  if (role === "owner") { if (section === "students") return <OwnerStudents locale={locale} />; if (section === "admissions") return <OwnerAdmissions locale={locale} />; if (section === "messages") return <OwnerMessages locale={locale} />; if (section === "notices") return <ContentEditor locale={locale} role="owner" initialTab="notices" />; if (section === "materials") return <ContentEditor locale={locale} role="owner" />; if (section === "courses") return <AcademicEditor locale={locale} />; if (section === "attendance") return <AttendanceWorkflow locale={locale} />; if (section === "finance") return <FinanceEditor locale={locale} />; if (section === "exams") return <ExamEditor locale={locale} role="owner" />; if (section === "reports") return <ReportsEditor locale={locale} />; if (section === "website") return <OwnerWebsiteEditor locale={locale} />; if (section === "settings") return <OwnerSettingsEditor locale={locale} />; return <OwnerDashboard locale={locale} />; }
  if (role === "teacher") { if (section === "batches") return <TeacherBatches locale={locale} />; if (section === "routine") return <TeacherRoutine locale={locale} />; if (section === "attendance") return <TeacherAttendance locale={locale} />; if (section === "exams") return <ExamEditor locale={locale} role="teacher" />; if (section === "materials") return <ContentEditor locale={locale} role="teacher" />; if (section === "notices") return <ContentEditor locale={locale} role="teacher" initialTab="notices" />; if (section === "profile") return <TeacherProfile locale={locale} />; return <TeacherDashboard locale={locale} />; }
  if (section === "routine") return <StudentRoutine locale={locale} />; if (section === "attendance") return <StudentAttendance locale={locale} />; if (section === "fees") return <StudentFees locale={locale} />; if (section === "results") return <StudentResults locale={locale} />; if (section === "materials") return <StudentMaterials locale={locale} />; if (section === "notices") return <StudentNotices locale={locale} />; if (section === "profile") return <StudentProfile locale={locale} />; return <StudentDashboard locale={locale} />;
}

