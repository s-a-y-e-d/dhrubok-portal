"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  BookOpen,
  Users,
  Calendar,
  Globe,
  CheckCircle2,
  AlertCircle,
  CircleDollarSign,
  Layers,
  Archive,
  ChevronDown,
  Check,
  Search,
  Settings,
  UserCheck,
  UserX,
  LayoutDashboard,
  Clock,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  X
} from "lucide-react";
import { courseViews, resolveSession, slugFrom, validStatus, validView, type CourseView } from "./courseWorkspaceState";
import { AllSchedules, BatchActions, ScheduleActions, SubjectTeacherActions } from "./CourseOperations";
import { ConfirmModal } from "@/components/portal/academics/shared/ConfirmModal";

const page = { numItems: 100, cursor: null } as const;
const weekdaysBn = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type PendingConfirmation =
  | { kind: "switch-course"; courseId: Id<"courses"> }
  | { kind: "course-lifecycle"; action: "complete" | "archive" }
  | { kind: "close-drawer" };

function getCourseStatusLabel(status: string, bn: boolean) {
  switch (status) {
    case "active": return bn ? "সক্রিয়" : "Active";
    case "draft": return bn ? "খসড়া" : "Draft";
    case "completed": return bn ? "সম্পন্ন" : "Completed";
    case "archived": return bn ? "আর্কাইভ" : "Archived";
    default: return status;
  }
}

export function CoursesWorkspace({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sessions = useQuery(api.academics.sessions.list, { status: "active", paginationOpts: page });
  const requestedSession = searchParams.get("sessionId");
  const selectedCourseId = searchParams.get("courseId") as Id<"courses"> | null;
  const view = validView(searchParams.get("view"));
  const status = validStatus(searchParams.get("status"));
  const query = searchParams.get("query") ?? "";

  const remembered = typeof window === "undefined" ? null : window.localStorage.getItem("owner-courses-session");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const session = sessions ? resolveSession(sessions.page, requestedSession, remembered, today) : undefined;

  const courses = usePaginatedQuery(
    api.academics.courseWorkspace.listCourses,
    session ? { academicSessionId: session._id, status, query } : "skip",
    { initialNumItems: 20 }
  );

  const overview = useQuery(api.academics.courseWorkspace.getCourseOverview, selectedCourseId ? { courseId: selectedCourseId } : "skip");
  const batches = useQuery(api.academics.courseWorkspace.getCourseBatches, selectedCourseId ? { courseId: selectedCourseId } : "skip");
  const coverage = useQuery(api.academics.courseWorkspace.getCoverageMatrix, selectedCourseId ? { courseId: selectedCourseId } : "skip");
  const schedules = useQuery(api.academics.courseWorkspace.getScheduleAgenda, selectedCourseId ? { courseId: selectedCourseId } : "skip");
  const archiveBlockers = useQuery(api.academics.courseWorkspace.getArchiveBlockers, selectedCourseId ? { courseId: selectedCourseId } : "skip");

  const createSession = useMutation(api.academics.sessions.create);
  const createDraft = useMutation(api.academics.courses.createDraft);
  const activate = useMutation(api.academics.courses.activate);
  const complete = useMutation(api.academics.courses.complete);
  const archive = useMutation(api.academics.courses.archive);

  const [showCreate, setShowCreate] = useState(false);
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const newCourseBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const updateUrl = (patch: Record<string, string | null>, mode: "push" | "replace" = "push") => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    router[mode](`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!session) return;
    window.localStorage.setItem("owner-courses-session", session._id);
    if (requestedSession !== session._id) updateUrl({ sessionId: session._id }, "replace");
  }, [session?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedCourseId && courses.status === "Exhausted" && !courses.results.some(row => row.courseId === selectedCourseId)) {
      updateUrl({ courseId: null, view: "overview" }, "replace");
    }
  }, [courses.status, selectedCourseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextAction = useMemo(() => {
    const issue = overview?.readiness.issues[0];
    if (!issue) return overview?.course.status === "draft" ? "activate" : null;
    if (issue.code === "NO_QUALIFYING_BATCH") return "batches";
    if (issue.code === "NO_COURSE_SUBJECT" || issue.code === "BATCH_SUBJECT_TEACHER_MISSING") return "subjects-teachers";
    if (issue.code === "BATCH_ROUTINE_MISSING") return "schedule";
    return "fees";
  }, [overview]);

  async function submitSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setFeedback(null);
    try {
      const id = await createSession({
        nameBn: String(data.get("nameBn")),
        nameEn: String(data.get("nameEn")),
        startDate: String(data.get("startDate")),
        endDate: String(data.get("endDate")),
        status: "active"
      });
      window.localStorage.setItem("owner-courses-session", id);
      setFeedback(bn ? "একাডেমিক সেশন তৈরি হয়েছে। এখন প্রথম কোর্সটি তৈরি করুন।" : "Academic session created. You can now create your first course.");
      updateUrl({ sessionId: id }, "replace");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const handleCloseDrawer = useCallback(() => {
    if (dirty) {
      setPendingConfirm({ kind: "close-drawer" });
    } else {
      setShowCreate(false);
    }
  }, [dirty, setPendingConfirm, setShowCreate]);

  useEffect(() => {
    if (!showCreate) return;
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        handleCloseDrawer();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreate, handleCloseDrawer]);

  useEffect(() => {
    if (showCreate) {
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    } else {
      newCourseBtnRef.current?.focus();
    }
  }, [showCreate]);

  function openCourse(id: Id<"courses">) {
    if (dirty) {
      setPendingConfirm({ kind: "switch-course", courseId: id });
    } else {
      updateUrl({ courseId: id, view: "overview" });
    }
  }

  async function submitCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setFeedback(null);
    try {
      const code = String(data.get("code"));
      const id = await createDraft({
        academicSessionId: String(data.get("sessionId")) as Id<"academicSessions">,
        nameBn: String(data.get("nameBn")),
        nameEn: String(data.get("nameEn")),
        code,
        slug: String(data.get("slug")) || slugFrom(code)
      });
      setShowCreate(false);
      setDirty(false);
      updateUrl({ courseId: id, status: "draft", view: "subjects-teachers" });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function activateCourse() {
    if (!selectedCourseId) return;
    setBusy(true);
    const result = await activate({ courseId: selectedCourseId });
    setBusy(false);
    setFeedback(result.activated ? (bn ? "কোর্স সক্রিয় হয়েছে।" : "Course activated.") : (bn ? `${result.issues.length}টি সেটআপ বাকি আছে।` : `${result.issues.length} setup items remain.`));
  }

  async function lifecycle(action: "complete" | "archive") {
    if (!selectedCourseId) return;
    if (action === "archive" && archiveBlockers?.length) {
      setFeedback(bn ? "আর্কাইভের আগে সব ব্যাচ ও নির্ভরতা সমাধান করুন।" : "Resolve every batch and dependency before archiving.");
      return;
    }
    setPendingConfirm({ kind: "course-lifecycle", action });
  }

  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % courseViews.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + courseViews.length) % courseViews.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = courseViews.length - 1;
    else return;
    event.preventDefault();
    tabsRef.current[next]?.focus();
    updateUrl({ view: courseViews[next] });
  }

  if (!sessions) return <p className="empty-panel">{bn ? "কোর্স লোড হচ্ছে…" : "Loading courses…"}</p>;

  if (!session) {
    return (
      <section className="course-session-setup-panel">
        <div>
          <p className="eyebrow">{bn ? "প্রথম ধাপ" : "First step"}</p>
          <h1>{bn ? "একাডেমিক সেশন তৈরি করুন" : "Create an academic session"}</h1>
          <p className="description">{bn ? "সেশনটি আপনার কোর্স, ব্যাচ ও শিক্ষাবর্ষকে একসঙ্গে রাখে। এটি তৈরি হলে আপনি প্রথম কোর্স যোগ করতে পারবেন।" : "A session groups your courses, batches, and academic year. Once it is created, you can add your first course."}</p>
        </div>
        {feedback && <p className="form-message error" role="status" style={{ marginBottom: "16px" }}>{feedback}</p>}
        <form className="operation-form" onSubmit={submitSession}>
          <div className="form-grid" style={{ marginBottom: "16px" }}>
            <label>{bn ? "বাংলা নাম" : "Bangla name"}<input name="nameBn" required placeholder="শিক্ষাবর্ষ ২০২৬" /></label>
            <label>{bn ? "ইংরেজি নাম" : "English name"}<input name="nameEn" required placeholder="Academic Year 2026" /></label>
          </div>
          <div className="form-grid" style={{ marginBottom: "20px" }}>
            <label>{bn ? "শুরুর তারিখ" : "Start date"}<input name="startDate" type="date" required defaultValue={`${today.slice(0, 4)}-01-01`} /></label>
            <label>{bn ? "শেষ তারিখ" : "End date"}<input name="endDate" type="date" required defaultValue={`${today.slice(0, 4)}-12-31`} /></label>
          </div>
          <div className="form-actions" style={{ marginTop: "0" }}>
            <button className="button button-primary" disabled={busy}>{busy ? (bn ? "তৈরি হচ্ছে…" : "Creating…") : (bn ? "সেশন তৈরি করুন" : "Create session")}</button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className="courses-workspace">
      <header className="portal-page-header courses-page-heading">
        <div>
          <p className="eyebrow">{bn ? "একাডেমিক কার্যক্রম" : "Academic operations"}</p>
          <h1>{bn ? "কোর্স" : "Courses"}</h1>
          <p>{bn ? `${session.nameBn} সেশনের কোর্স, প্রস্তুতি ও রুটিন পরিচালনা করুন।` : `Manage courses, readiness, and schedules for ${session.nameEn}.`}</p>
        </div>
        <button ref={newCourseBtnRef} className="button button-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
          {bn ? "নতুন কোর্স" : "New course"}
        </button>
      </header>

      {feedback && <p className="feedback-message" role="status">{feedback}</p>}

      <div className="course-toolbar">
        <label>
          {bn ? "সেশন" : "Session"}
          <select value={session._id} onChange={e => updateUrl({ sessionId: e.target.value, courseId: null })}>
            {sessions.page.map(row => <option key={row._id} value={row._id}>{bn ? row.nameBn : row.nameEn}</option>)}
          </select>
        </label>
        <label>
          {bn ? "খুঁজুন" : "Search"}
          <div className="search-input-wrapper">
            <Search className="search-icon" size={16} aria-hidden="true" focusable="false" />
            <input
              value={query}
              onChange={e => updateUrl({ query: e.target.value || null, courseId: null }, "replace")}
              placeholder={bn ? "নাম বা কোড" : "Name or code"}
            />
          </div>
        </label>
        <div className="course-status-filter" aria-label={bn ? "কোর্স অবস্থা" : "Course status"}>
          {(["active", "draft", "completed", "archived"] as const).map(item => (
            <button
              key={item}
              className={`button ${status === item ? "button-primary" : "button-secondary"}`}
              aria-pressed={status === item}
              onClick={() => updateUrl({ status: item, courseId: null })}
            >
              {item === "active" ? (bn ? "সক্রিয়" : "Active") : item === "draft" ? (bn ? "খসড়া" : "Draft") : item === "completed" ? (bn ? "সম্পন্ন" : "Completed") : (bn ? "আর্কাইভ" : "Archived")}
            </button>
          ))}
        </div>
      </div>

      <div className="course-master-detail">
        <aside className="course-list" aria-label={bn ? "কোর্স তালিকা" : "Course list"}>
          {courses.results.length ? (
            courses.results.map(row => (
              <button
                key={row.courseId}
                className={`course-list-card ${selectedCourseId === row.courseId ? "is-selected" : ""}`}
                onClick={() => openCourse(row.courseId)}
                aria-current={selectedCourseId === row.courseId ? "true" : undefined}
                aria-label={`${bn ? row.nameBn : row.nameEn}, ${row.code}`}
              >
                <span className="course-card-identity">
                  <strong>{bn ? row.nameBn : row.nameEn}</strong>
                  <span className="course-code-badge">{row.code}</span>
                </span>
                <span className={`status-pill ${row.status}`}>
                  {row.status === "active" ? (
                    <CheckCircle2 size={12} aria-hidden="true" focusable="false" />
                  ) : row.status === "draft" ? (
                    <Layers size={12} aria-hidden="true" focusable="false" />
                  ) : row.status === "completed" ? (
                    <Check size={12} aria-hidden="true" focusable="false" />
                  ) : (
                    <Archive size={12} aria-hidden="true" focusable="false" />
                  )}
                  {getCourseStatusLabel(row.status, bn)}
                </span>
                <span className="course-card-metrics">
                  <small className="course-card-metric-item">
                    <Users size={12} aria-hidden="true" focusable="false" />
                    {row.snapshot ? `${row.snapshot.activeEnrolmentCount} ${bn ? "শিক্ষার্থী" : "students"}` : (bn ? "হিসাব হচ্ছে…" : "Calculating…")}
                  </small>
                  <small className={`course-card-metric-item ${row.snapshot?.academicReady ? "text-success" : "text-warning"}`}>
                    {row.snapshot?.academicReady ? (
                      <CheckCircle2 size={12} aria-hidden="true" focusable="false" />
                    ) : (
                      <AlertCircle size={12} aria-hidden="true" focusable="false" />
                    )}
                    {row.snapshot?.academicReady ? (bn ? "প্রস্তুত" : "Ready") : (bn ? "সেটআপ বাকি" : "Needs setup")}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="empty-panel">{bn ? "কোনো কোর্স পাওয়া যায়নি।" : "No courses found."}</p>
          )}
          {courses.status === "CanLoadMore" && (
            <button className="button button-secondary" onClick={() => courses.loadMore(20)}>{bn ? "আরও দেখুন" : "Load more"}</button>
          )}
        </aside>

        <main className="course-detail">
          {!selectedCourseId ? (
            <div className="empty-panel">
              <BookOpen size={20} aria-hidden="true" focusable="false" className="text-mute" style={{ marginBottom: "8px" }} />
              <h2>{bn ? "একটি কোর্স নির্বাচন করুন" : "Select a course"}</h2>
              <p>{bn ? "প্রস্তুতি, ব্যাচ, শিক্ষক ও রুটিন এক জায়গায় দেখুন।" : "See readiness, batches, teachers, and routines in one place."}</p>
            </div>
          ) : !overview ? (
            <p className="empty-panel">{bn ? "কোর্স লোড হচ্ছে…" : "Loading course…"}</p>
          ) : (
            <>
              <header className="course-workspace-header">
                <div>
                  <p className="eyebrow">{bn ? overview.session.nameBn : overview.session.nameEn}</p>
                  <h2>{bn ? overview.course.nameBn : overview.course.nameEn} <span className="course-code-badge">{overview.course.code}</span></h2>
                  <div className="course-status-summary">
                    <span className={`status-pill ${overview.course.status}`}>
                      {overview.course.status === "active" ? (
                        <CheckCircle2 size={14} aria-hidden="true" focusable="false" />
                      ) : overview.course.status === "draft" ? (
                        <Layers size={14} aria-hidden="true" focusable="false" />
                      ) : overview.course.status === "completed" ? (
                        <Check size={14} aria-hidden="true" focusable="false" />
                      ) : (
                        <Archive size={14} aria-hidden="true" focusable="false" />
                      )}
                      {getCourseStatusLabel(overview.course.status, bn)}
                    </span>
                    <span className={`status-pill ${overview.readiness.ready ? "active" : "reserved"}`}>
                      {overview.readiness.ready ? (
                        <CheckCircle2 size={14} className="text-success" aria-hidden="true" focusable="false" />
                      ) : (
                        <AlertCircle size={14} className="text-warning" aria-hidden="true" focusable="false" />
                      )}
                      {bn ? "একাডেমিক: " : "Academic: "}
                      {overview.readiness.ready ? (bn ? "প্রস্তুত" : "Ready") : (bn ? "সেটআপ বাকি" : "Needs setup")}
                    </span>
                    <span className={`status-pill ${overview.readiness.feesConfigured ? "active" : "reserved"}`}>
                      {overview.readiness.feesConfigured ? (
                        <CheckCircle2 size={14} className="text-success" aria-hidden="true" focusable="false" />
                      ) : (
                        <AlertCircle size={14} className="text-warning" aria-hidden="true" focusable="false" />
                      )}
                      {bn ? "ফি: " : "Fees: "}
                      {overview.readiness.feesConfigured ? (bn ? "প্রস্তুত" : "Configured") : (bn ? "সেটআপ বাকি" : "Needs setup")}
                    </span>
                    <span className={`status-pill ${overview.course.isPublic ? "published" : ""}`}>
                      <Globe size={14} aria-hidden="true" focusable="false" />
                      {bn ? "ওয়েবসাইট: " : "Website: "}
                      {overview.course.isPublic ? (bn ? "প্রকাশিত" : "Published") : (bn ? "অপ্রকাশিত" : "Not published")}
                    </span>
                  </div>
                </div>
                <div className="course-header-actions">
                  {nextAction === "activate" ? (
                    <button className="button button-primary" disabled={busy} onClick={activateCourse}>
                      <CheckCircle2 size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                      {bn ? "কোর্স সক্রিয় করুন" : "Activate course"}
                    </button>
                  ) : nextAction === "fees" ? (
                    <a className="button button-primary" href={`/${locale}/owner/finance?courseId=${selectedCourseId}`}>
                      <CircleDollarSign size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                      {bn ? "ফি কনফিগার করুন" : "Configure fees"}
                    </a>
                  ) : (
                    nextAction && (
                      <button className="button button-primary" onClick={() => updateUrl({ view: nextAction })}>
                        <Plus size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                        {nextAction === "batches" ? (bn ? "ব্যাচ যোগ করুন" : "Add a batch") : nextAction === "subjects-teachers" ? (bn ? "বিষয় ও শিক্ষক" : "Subjects & teachers") : (bn ? "রুটিন যোগ করুন" : "Add routine")}
                      </button>
                    )
                  )}
                  {overview.course.status === "active" && (
                    <button className="button button-secondary" disabled={busy} onClick={() => void lifecycle("complete")}>
                      <Check size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                      {bn ? "সম্পন্ন করুন" : "Complete"}
                    </button>
                  )}
                  {overview.course.status !== "archived" && (
                    <button className="button button-tertiary" disabled={busy} onClick={() => void lifecycle("archive")}>
                      <Archive size={16} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                      {bn ? "আর্কাইভ" : "Archive"}
                    </button>
                  )}
                </div>
              </header>

              <div className="course-tabs" role="tablist" aria-label={bn ? "কোর্স বিভাগ" : "Course sections"}>
                {courseViews.map((item, index) => {
                  const getTabIcon = (tab: CourseView) => {
                    switch (tab) {
                      case "overview": return <LayoutDashboard size={16} aria-hidden="true" focusable="false" />;
                      case "batches": return <Layers size={16} aria-hidden="true" focusable="false" />;
                      case "subjects-teachers": return <BookOpen size={16} aria-hidden="true" focusable="false" />;
                      case "schedule": return <Calendar size={16} aria-hidden="true" focusable="false" />;
                      case "website": return <Globe size={16} aria-hidden="true" focusable="false" />;
                    }
                  };
                  const getTabLabel = (tab: CourseView) => {
                    switch (tab) {
                      case "overview": return bn ? "সারসংক্ষেপ" : "Overview";
                      case "batches": return bn ? "ব্যাচ" : "Batches";
                      case "subjects-teachers": return bn ? "বিষয় ও শিক্ষক" : "Subjects & teachers";
                      case "schedule": return bn ? "রুটিন" : "Schedule";
                      case "website": return bn ? "ওয়েবসাইট" : "Website";
                    }
                  };
                  return (
                    <button
                      key={item}
                      id={`tab-${item}`}
                      aria-controls={`panel-${item}`}
                      ref={node => { tabsRef.current[index] = node; }}
                      role="tab"
                      aria-selected={view === item}
                      tabIndex={view === item ? 0 : -1}
                      className={view === item ? "is-active" : ""}
                      onKeyDown={event => tabKeys(event, index)}
                      onClick={() => updateUrl({ view: item })}
                      style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    >
                      {getTabIcon(item)}
                      <span>{getTabLabel(item)}</span>
                    </button>
                  );
                })}
              </div>

              <section role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} className="course-panel">
                {view === "overview" && (
                  <>
                    <h3>{bn ? "প্রস্তুতির তালিকা" : "Readiness checklist"}</h3>
                    {overview.readiness.issues.length ? (
                      <>
                        <div className="readiness-summary-banner">
                          <AlertCircle size={16} className="text-warning" aria-hidden="true" focusable="false" />
                          <span>
                            {bn
                              ? `${overview.readiness.issues.length}টি সেটআপ বাকি আছে`
                              : `${overview.readiness.issues.length} setup items remaining`}
                          </span>
                        </div>
                        <ul className="readiness-list">
                          {overview.readiness.issues.map((issue, index) => (
                            <li key={`${issue.code}-${index}`}>
                              <AlertCircle size={16} className="text-warning-deep" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }} />
                              <div>
                                <strong>{bn ? issue.labelBn : issue.labelEn}</strong>
                                <small>{issue.code}</small>
                              </div>
                              <button
                                className="button button-tertiary"
                                onClick={() =>
                                  updateUrl({
                                    view: issue.code.includes("ROUTINE")
                                      ? "schedule"
                                      : issue.code.includes("SUBJECT") || issue.code.includes("TEACHER")
                                        ? "subjects-teachers"
                                        : issue.code.includes("FEE")
                                          ? null
                                          : "batches",
                                  })
                                }
                              >
                                {bn ? "সমাধান করুন" : "Resolve"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="success-panel">
                        <CheckCircle2 size={16} className="text-success" aria-hidden="true" focusable="false" />
                        {bn ? "কোর্স সক্রিয় করার জন্য সব প্রস্তুতি সম্পন্ন।" : "All activation requirements are complete."}
                      </p>
                    )}
                    {archiveBlockers?.length ? (
                      <div className="archive-blocker-panel">
                        <h3>
                          <AlertTriangle size={16} className="text-danger" aria-hidden="true" focusable="false" />
                          {bn ? "আর্কাইভের আগে সমাধান করুন" : "Resolve before archiving"}
                        </h3>
                        {archiveBlockers.map(row => (
                          <article key={row.batchId}>
                            <div>
                              <strong>{bn ? row.nameBn : row.nameEn}</strong>
                              <p>
                                {row.status} · {row.assignmentCount} {bn ? "দায়িত্ব" : "assignments"} · {row.routineCount} {bn ? "রুটিন" : "routines"} · {row.enrolmentCount} {bn ? "ভর্তি" : "enrolments"}
                              </p>
                            </div>
                            <button
                              className="button button-tertiary"
                              onClick={() =>
                                updateUrl({
                                  view: row.routineCount ? "schedule" : row.assignmentCount ? "subjects-teachers" : "batches",
                                })
                              }
                            >
                              {bn ? "সমাধান করুন" : "Resolve"}
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                )}

                {view === "batches" && (
                  <div>
                    <div className="course-record-grid">
                      {batches?.map(row => (
                        <article key={row.batchId} className="course-record-card">
                          <div className="course-record-card-header">
                            <h3>{bn ? row.nameBn : row.nameEn}</h3>
                            <span className="course-code-badge">{row.code}</span>
                          </div>
                          <span className={`status-pill ${row.status}`}>
                            {row.status === "active" ? (
                              <CheckCircle2 size={12} aria-hidden="true" focusable="false" />
                            ) : row.status === "planned" ? (
                              <Layers size={12} aria-hidden="true" focusable="false" />
                            ) : row.status === "completed" ? (
                              <Check size={12} aria-hidden="true" focusable="false" />
                            ) : (
                              <Archive size={12} aria-hidden="true" focusable="false" />
                            )}
                            {row.status}
                          </span>
                          <dl>
                            <div>
                              <dt>
                                <Users size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px", verticalAlign: "middle" }} />
                                {bn ? "ধারণক্ষমতা" : "Capacity"}
                              </dt>
                              <dd>{row.capacity ?? "—"}</dd>
                            </div>
                            <div>
                              <dt>
                                {row.admissionOpen ? (
                                  <Unlock size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px", verticalAlign: "middle" }} />
                                ) : (
                                  <Lock size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px", verticalAlign: "middle" }} />
                                )}
                                {bn ? "ভর্তি" : "Admission"}
                              </dt>
                              <dd>{row.admissionOpen ? (bn ? "খোলা" : "Open") : (bn ? "বন্ধ" : "Closed")}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                    <BatchActions
                      locale={locale}
                      courseId={selectedCourseId}
                      sessionId={overview.course.academicSessionId}
                      readOnly={overview.course.status === "archived"}
                      batches={batches}
                    />
                  </div>
                )}

                {view === "subjects-teachers" && (
                  <div className="coverage-wrap">
                    <h3>{bn ? "শিক্ষক কভারেজ" : "Teacher coverage"}</h3>
                    {coverage?.subjects.length ? (
                      <div
                        className="coverage-matrix"
                        role="table"
                        style={
                          {
                            "--coverage-columns": coverage.batches.length,
                          } as React.CSSProperties
                        }
                      >
                        <div className="coverage-row coverage-head" role="row">
                          <span role="columnheader">{bn ? "বিষয়" : "Subject"}</span>
                          {coverage.batches.map(batch => (
                            <span key={batch.batchId} role="columnheader">
                              {bn ? batch.nameBn : batch.nameEn}
                            </span>
                          ))}
                        </div>
                        {coverage.subjects.map(subject => (
                          <div className="coverage-row" role="row" key={subject.subjectId}>
                            <strong role="rowheader">{bn ? subject.nameBn : subject.nameEn}</strong>
                            {coverage.batches.map(batch => {
                              const names = coverage.assignments
                                .filter(item => item.batchId === batch.batchId && item.subjectId === subject.subjectId)
                                .map(item => item.teacherName);
                              return (
                                <span key={batch.batchId} className={names.length ? "coverage-ok" : "coverage-missing"}>
                                  {names.length ? (
                                    <span className="coverage-cell-value">
                                      <UserCheck size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                                      {names.join(", ")}
                                    </span>
                                  ) : (
                                    <span className="coverage-cell-value coverage-empty">
                                      <UserX size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px" }} />
                                      {bn ? "অনুপস্থিত" : "Missing"}
                                    </span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-panel">{bn ? "এই কোর্সে এখনো কোনো সক্রিয় বিষয় নেই।" : "No active subjects are linked yet."}</p>
                    )}
                    <SubjectTeacherActions
                      locale={locale}
                      courseId={selectedCourseId}
                      readOnly={overview.course.status === "archived"}
                      coverage={coverage}
                    />
                  </div>
                )}

                {view === "schedule" && (
                  <div>
                    <div className="section-toolbar">
                      <h3>{bn ? "সাপ্তাহিক রুটিন" : "Weekly schedule"}</h3>
                      <button className="button button-secondary" onClick={() => setShowAllSchedules(value => !value)}>
                        {showAllSchedules ? (bn ? "কোর্স রুটিন" : "Course schedule") : (bn ? "সব রুটিন" : "All schedules")}
                      </button>
                    </div>
                    {showAllSchedules ? (
                      <AllSchedules locale={locale} />
                    ) : (
                      <>
                        {schedules?.length ? (
                          <div className="agenda-list">
                            {schedules.map(row => (
                              <article key={row.scheduleId}>
                                <time>
                                  <Clock size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px", verticalAlign: "middle" }} />
                                  {(bn ? weekdaysBn : weekdaysEn)[row.weekday]} · {clock(row.startMinutes)}–{clock(row.endMinutes)}
                                </time>
                                <div>
                                  <strong>{bn ? row.batchNameBn : row.batchNameEn}</strong>
                                  <p>
                                    {bn ? row.subjectNameBn : row.subjectNameEn} · {row.teacherName}
                                  </p>
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="empty-panel">{bn ? "কোনো সক্রিয় রুটিন নেই।" : "No active routines."}</p>
                        )}
                        <ScheduleActions
                          locale={locale}
                          readOnly={overview.course.status === "archived"}
                          coverage={coverage}
                          schedules={schedules}
                        />
                      </>
                    )}
                  </div>
                )}

                {view === "website" && (
                  <div className="website-status-card">
                    <h3>{bn ? "ওয়েবসাইট অবস্থা" : "Website status"}</h3>
                    <p>{overview.course.isPublic ? (bn ? "কোর্সটি প্রকাশিত।" : "This course is published.") : (bn ? "কোর্সটি এখনো প্রকাশিত নয়।" : "This course is not published yet.")}</p>
                    <a className="button button-secondary" href={`/${locale}/owner/website`}>
                      <Globe size={16} aria-hidden="true" focusable="false" style={{ marginRight: "6px", verticalAlign: "middle" }} />
                      {bn ? "ওয়েবসাইট CMS খুলুন" : "Open Website CMS"}
                    </a>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>

      {showCreate && (
        <div
          className="drawer-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              handleCloseDrawer();
            }
          }}
        >
          <aside ref={drawerRef} className="course-drawer" role="dialog" aria-modal="true" aria-labelledby="new-course-title">
            <header>
              <div>
                <p className="eyebrow">{bn ? "ধাপ ১" : "Step 1"}</p>
                <h2 id="new-course-title">{bn ? "খসড়া কোর্স তৈরি" : "Create course draft"}</h2>
              </div>
              <button
                className="icon-button"
                aria-label={bn ? "বন্ধ করুন" : "Close"}
                type="button"
                onClick={handleCloseDrawer}
              >
                <X size={16} aria-hidden="true" focusable="false" />
              </button>
            </header>
            <form onSubmit={submitCourse} onChange={() => setDirty(true)}>
              <label>
                {bn ? "একাডেমিক সেশন" : "Academic session"}
                <select name="sessionId" defaultValue={session._id}>
                  {sessions.page.map(row => <option key={row._id} value={row._id}>{bn ? row.nameBn : row.nameEn}</option>)}
                </select>
              </label>
              <label>{bn ? "বাংলা নাম" : "Bangla name"}<input name="nameBn" required /></label>
              <label>{bn ? "ইংরেজি নাম" : "English name"}<input name="nameEn" required /></label>
              <label>{bn ? "কোর্স কোড" : "Course code"}<input name="code" required /></label>
              <details>
                <summary className="accordion-trigger compact" style={{ padding: "8px 12px", minHeight: "36px" }}>
                  <span className="accordion-title-group" style={{ fontSize: "13px" }}>
                    <Settings size={14} aria-hidden="true" focusable="false" />
                    {bn ? "উন্নত সেটিং" : "Advanced"}
                  </span>
                  <ChevronDown size={14} className="accordion-chevron" aria-hidden="true" focusable="false" />
                </summary>
                <div style={{ paddingTop: "10px" }}>
                  <label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
                </div>
              </details>
              <div className="drawer-actions">
                <button type="button" className="button button-secondary" onClick={handleCloseDrawer}>{bn ? "বাতিল" : "Cancel"}</button>
                <button className="button button-primary" disabled={busy}>{bn ? "খসড়া তৈরি ও বিষয় যোগ" : "Create draft & add subjects"}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {pendingConfirm && (
        <ConfirmModal
          title={
            pendingConfirm.kind === "switch-course"
              ? (bn ? "পরিবর্তন বাতিল করবেন?" : "Discard changes?")
              : pendingConfirm.kind === "course-lifecycle"
                ? pendingConfirm.action === "archive"
                  ? (bn ? "কোর্সটি আর্কাইভ করবেন?" : "Archive this course?")
                  : (bn ? "কোর্সটি সম্পন্ন করবেন?" : "Complete course?")
                : (bn ? "পরিবর্তন বাতিল করবেন?" : "Discard changes?")
          }
          detail={
            pendingConfirm.kind === "switch-course"
              ? (bn ? "আপনার করা পরিবর্তনগুলো সংরক্ষিত হয়নি। পরিবর্তনগুলো বাতিল করে অন্য কোর্সে যেতে চান?" : "You have unsaved changes. Are you sure you want to discard them and switch courses?")
              : pendingConfirm.kind === "course-lifecycle"
                ? pendingConfirm.action === "archive"
                  ? (bn ? "কোর্সটি স্থায়ীভাবে আর্কাইভ করা হবে। এটি আর পরিবর্তন করা যাবে না।" : "This course will be permanently archived. This action cannot be undone.")
                  : (bn ? "কোর্সটি সম্পন্ন হিসেবে চিহ্নিত করা হবে। এটি আর সক্রিয় থাকবে না।" : "This course will be marked as completed and will no longer be active.")
                : (bn ? "আপনার পূরণ করা ফর্মের তথ্যগুলো হারিয়ে যাবে।" : "Any data entered in the form will be lost.")
          }
          danger={pendingConfirm.kind !== "course-lifecycle" || pendingConfirm.action === "archive"}
          confirmLabel={
            pendingConfirm.kind === "switch-course"
              ? (bn ? "বাতিল করুন ও বদলান" : "Discard and switch")
              : pendingConfirm.kind === "course-lifecycle"
                ? pendingConfirm.action === "archive"
                  ? (bn ? "কোর্স আর্কাইভ করুন" : "Archive course")
                  : (bn ? "কোর্স সম্পন্ন করুন" : "Complete course")
                : (bn ? "পরিবর্তন বাতিল করুন" : "Discard changes")
          }
          disabled={busy}
          locale={locale}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={async () => {
            const confirmAction = pendingConfirm;
            setPendingConfirm(null);
            if (confirmAction.kind === "switch-course") {
              setDirty(false);
              updateUrl({ courseId: confirmAction.courseId, view: "overview" });
            } else if (confirmAction.kind === "course-lifecycle") {
              setBusy(true);
              try {
                if (confirmAction.action === "archive") {
                  await archive({ courseId: selectedCourseId! });
                } else {
                  await complete({ courseId: selectedCourseId! });
                }
                setFeedback(bn ? "কোর্সের অবস্থা আপডেট হয়েছে।" : "Course lifecycle updated.");
                updateUrl({ status: confirmAction.action === "archive" ? "archived" : "completed" });
              } catch (error) {
                setFeedback(error instanceof Error ? error.message : String(error));
              } finally {
                setBusy(false);
              }
            } else if (confirmAction.kind === "close-drawer") {
              setDirty(false);
              setShowCreate(false);
            }
          }}
        />
      )}
    </div>
  );
}
