"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Plus, ChevronDown, Layers, Clock, AlertCircle, Link2, UserPlus, UserMinus, Unlink, CalendarPlus, CalendarX2 } from "lucide-react";
import { ConfirmModal } from "@/components/portal/academics/shared/ConfirmModal";

const page = { numItems: 200, cursor: null } as const;
type Locale = "bn" | "en";
type Batch = {
  batchId: Id<"batches">;
  code: string;
  nameBn: string;
  nameEn: string;
  status: "planned" | "active" | "completed" | "archived";
  capacity?: number;
  admissionOpen: boolean;
};
type Coverage = {
  subjects: Array<{ subjectId: Id<"subjects">; nameBn: string; nameEn: string; sortOrder: number }>;
  batches: Array<{ batchId: Id<"batches">; nameBn: string; nameEn: string }>;
  assignments: Array<{ assignmentId: Id<"teacherBatchAssignments">; batchId: Id<"batches">; subjectId?: Id<"subjects">; teacherId: Id<"teachers">; teacherName: string }>;
};
type Schedule = {
  scheduleId: Id<"batchSchedules">;
  batchId: Id<"batches">;
  teacherId: Id<"teachers">;
  subjectId?: Id<"subjects">;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
};

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function minutes(value: FormDataEntryValue | null) {
  const [hour, minute] = String(value).split(":").map(Number);
  return hour * 60 + minute;
}
const weekdaysBn = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getBatchStatusLabel(status: string, bn: boolean) {
  switch (status) {
    case "active": return bn ? "সক্রিয়" : "Active";
    case "planned": return bn ? "পরিকল্পিত" : "Planned";
    case "completed": return bn ? "সম্পন্ন" : "Completed";
    case "archived": return bn ? "আর্কাইভ" : "Archived";
    default: return status;
  }
}

export function BatchActions({
  locale,
  courseId,
  sessionId,
  readOnly,
  batches
}: {
  locale: Locale;
  courseId: Id<"courses">;
  sessionId: Id<"academicSessions">;
  readOnly: boolean;
  batches?: Batch[];
}) {
  const bn = locale === "bn";
  const create = useMutation(api.academics.batches.create);
  const transition = useMutation(api.academics.batches.transition);
  const archive = useMutation(api.academics.batches.archive);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  type BatchConfirmation =
    | { kind: "archive-batch"; batchId: Id<"batches">; name: string };
  const [pendingConfirm, setPendingConfirm] = useState<BatchConfirmation | null>(null);

  if (readOnly) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setFeedback(null);
    try {
      const code = String(data.get("code"));
      await create({
        academicSessionId: sessionId,
        courseId,
        code,
        slug: String(data.get("slug")) || code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        nameBn: String(data.get("nameBn")),
        nameEn: String(data.get("nameEn")),
        startDate: String(data.get("startDate")) || undefined,
        endDate: String(data.get("endDate")) || undefined,
        capacity: Number(data.get("capacity")) || undefined,
        status: "planned",
        admissionOpen: false,
        isPublic: false,
        publicSortOrder: 0
      });
      form.reset();
      setFeedback(bn ? "ব্যাচ তৈরি হয়েছে।" : "Batch created.");
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(run: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await run();
      setFeedback(success);
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-actions-stack">
      <details className="workspace-action">
        <summary className="accordion-trigger">
          <span className="accordion-title-group">
            <Plus size={16} aria-hidden="true" focusable="false" />
            {bn ? "ব্যাচ তৈরি করুন" : "Create batch"}
          </span>
          <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
        </summary>
        <form className="workspace-action-form" onSubmit={submit}>
          <div className="form-grid">
            <label>{bn ? "বাংলা নাম" : "Bangla name"}<input name="nameBn" required /></label>
            <label>{bn ? "ইংরেজি নাম" : "English name"}<input name="nameEn" required /></label>
            <label>{bn ? "কোড" : "Code"}<input name="code" required /></label>
            <label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
            <label>{bn ? "শুরুর তারিখ" : "Start date"}<input name="startDate" type="date" /></label>
            <label>{bn ? "শেষ তারিখ" : "End date"}<input name="endDate" type="date" /></label>
            <label>{bn ? "ধারণক্ষমতা" : "Capacity"}<input name="capacity" type="number" min={1} /></label>
          </div>
          <button className="button button-primary" disabled={busy}>
            {busy ? (bn ? "তৈরি হচ্ছে…" : "Creating…") : (bn ? "পরিকল্পিত ব্যাচ তৈরি" : "Create planned batch")}
          </button>
        </form>
      </details>

      {!!batches?.length && (
        <details className="workspace-action">
          <summary className="accordion-trigger">
            <span className="accordion-title-group">
              <Layers size={16} aria-hidden="true" focusable="false" />
              {bn ? "ব্যাচের জীবনচক্র" : "Batch lifecycle"}
            </span>
            <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
          </summary>
          <div className="workspace-action-list">
            {batches.filter(batch => batch.status !== "archived").map(batch => (
              <div key={batch.batchId}>
                <span>{bn ? batch.nameBn : batch.nameEn} · <span className={`status-pill ${batch.status}`}>{getBatchStatusLabel(batch.status, bn)}</span></span>
                <span className="table-actions">
                  {batch.status === "planned" && (
                    <button
                      className="button button-tertiary"
                      disabled={busy}
                      onClick={() => void lifecycle(() => transition({ batchId: batch.batchId, status: "active" }), bn ? "ব্যাচ সক্রিয় হয়েছে।" : "Batch activated.")}
                    >
                      {bn ? "সক্রিয় করুন" : "Activate"}
                    </button>
                  )}
                  {batch.status === "active" && (
                    <button
                      className="button button-tertiary"
                      disabled={busy}
                      onClick={() => void lifecycle(() => transition({ batchId: batch.batchId, status: "completed" }), bn ? "ব্যাচ সম্পন্ন হয়েছে।" : "Batch completed.")}
                    >
                      {bn ? "সম্পন্ন করুন" : "Complete"}
                    </button>
                  )}
                  {batch.status === "completed" && (
                    <button
                      className="button button-tertiary"
                      disabled={busy}
                      onClick={() => {
                        setPendingConfirm({
                          kind: "archive-batch",
                          batchId: batch.batchId,
                          name: bn ? batch.nameBn : batch.nameEn
                        });
                      }}
                    >
                      {bn ? "আর্কাইভ" : "Archive"}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
      {feedback && <p className="feedback-message" role="status">{feedback}</p>}
      {pendingConfirm && (
        <ConfirmModal
          title={bn ? "ব্যাচ আর্কাইভ করবেন?" : "Archive batch?"}
          detail={
            bn
              ? `"${pendingConfirm.name}" ব্যাচটি স্থায়ীভাবে আর্কাইভ করা হবে। এটি আর পরিবর্তন করা যাবে না।`
              : `"${pendingConfirm.name}" batch will be permanently archived. This action cannot be undone.`
          }
          danger
          confirmLabel={bn ? "ব্যাচ আর্কাইভ করুন" : "Archive batch"}
          disabled={busy}
          locale={locale}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={async () => {
            const batchId = pendingConfirm.batchId;
            setPendingConfirm(null);
            await lifecycle(() => archive({ batchId }), bn ? "ব্যাচ আর্কাইভ হয়েছে।" : "Batch archived.");
          }}
        />
      )}
    </div>
  );
}

export function SubjectTeacherActions({
  locale,
  courseId,
  readOnly,
  coverage
}: {
  locale: Locale;
  courseId: Id<"courses">;
  readOnly: boolean;
  coverage?: Coverage;
}) {
  const bn = locale === "bn";
  const subjects = useQuery(api.academics.subjects.list, { status: "active", paginationOpts: page });
  const teachers = useQuery(api.academics.teachers.list, { status: "active", paginationOpts: page });
  const addSubject = useMutation(api.academics.courses.addSubject);
  const removeSubject = useMutation(api.academics.courses.removeSubject);
  const createAssignment = useMutation(api.academics.assignments.create);
  const endAssignment = useMutation(api.academics.assignments.end);
  const links = useQuery(api.academics.courses.listSubjects, { courseId });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  type SubjectConfirmation =
    | { kind: "unlink-subject"; linkId: Id<"courseSubjects">; name: string };
  const [pendingConfirm, setPendingConfirm] = useState<SubjectConfirmation | null>(null);

  if (readOnly) return null;

  async function work(run: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await run();
      setFeedback(success);
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-actions-stack">
      <details className="workspace-action">
        <summary className="accordion-trigger">
          <span className="accordion-title-group">
            <Link2 size={16} aria-hidden="true" focusable="false" />
            {bn ? "বিষয় যুক্ত করুন" : "Link subject"}
          </span>
          <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
        </summary>
        <form
          className="workspace-action-form"
          onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const subjectId = String(data.get("subjectId")) as Id<"subjects">;
            void work(() => addSubject({ courseId, subjectId, sortOrder: coverage?.subjects.length ?? 0 }), bn ? "বিষয় যুক্ত হয়েছে।" : "Subject linked.").then(() => form.reset());
          }}
        >
          <label>
            {bn ? "বিষয়" : "Subject"}
            <select name="subjectId" required defaultValue="">
              <option value="" disabled>{bn ? "নির্বাচন করুন" : "Select"}</option>
              {subjects?.page.filter(subject => !coverage?.subjects.some(row => row.subjectId === subject._id)).map(subject => (
                <option key={subject._id} value={subject._id}>{bn ? subject.nameBn : subject.nameEn} ({subject.code})</option>
              ))}
            </select>
          </label>
          <button className="button button-primary" disabled={busy}>{bn ? "যুক্ত করুন" : "Link"}</button>
        </form>
      </details>

      <details className="workspace-action">
        <summary className="accordion-trigger">
          <span className="accordion-title-group">
            <UserPlus size={16} aria-hidden="true" focusable="false" />
            {bn ? "শিক্ষক দায়িত্ব দিন" : "Assign teacher"}
          </span>
          <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
        </summary>
        <form
          className="workspace-action-form"
          onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void work(
              () =>
                createAssignment({
                  teacherId: String(data.get("teacherId")) as Id<"teachers">,
                  batchId: String(data.get("batchId")) as Id<"batches">,
                  subjectId: String(data.get("subjectId")) as Id<"subjects">,
                  startsOn: String(data.get("startsOn"))
                }),
              bn ? "শিক্ষক দায়িত্ব পেয়েছেন।" : "Teacher assigned."
            ).then(() => form.reset());
          }}
        >
          <div className="form-grid">
            <label>
              {bn ? "ব্যাচ" : "Batch"}
              <select name="batchId" required>
                {coverage?.batches.map(batch => <option key={batch.batchId} value={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</option>)}
              </select>
            </label>
            <label>
              {bn ? "বিষয়" : "Subject"}
              <select name="subjectId" required>
                {coverage?.subjects.map(subject => <option key={subject.subjectId} value={subject.subjectId}>{bn ? subject.nameBn : subject.nameEn}</option>)}
              </select>
            </label>
            <label>
              {bn ? "শিক্ষক" : "Teacher"}
              <select name="teacherId" required>
                {teachers?.page.map(teacher => <option key={teacher._id} value={teacher._id}>{teacher.displayName}</option>)}
              </select>
            </label>
            <label>{bn ? "শুরুর তারিখ" : "Starts on"}<input name="startsOn" type="date" required /></label>
          </div>
          <button className="button button-primary" disabled={busy}>{bn ? "দায়িত্ব দিন" : "Assign"}</button>
        </form>
      </details>

      {!!coverage?.assignments.length && (
        <details className="workspace-action">
          <summary className="accordion-trigger">
            <span className="accordion-title-group">
              <UserMinus size={16} aria-hidden="true" focusable="false" />
              {bn ? "বর্তমান দায়িত্ব শেষ করুন" : "End assignments"}
            </span>
            <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
          </summary>
          <div className="workspace-action-list">
            {coverage.assignments.map(row => (
              <div key={row.assignmentId}>
                <span>{row.teacherName} · {bn ? coverage.subjects.find(subject => subject.subjectId === row.subjectId)?.nameBn : coverage.subjects.find(subject => subject.subjectId === row.subjectId)?.nameEn}</span>
                <button
                  className="button button-tertiary"
                  disabled={busy}
                  onClick={() => {
                    const endsOn = new Date().toISOString().slice(0, 10);
                    void work(() => endAssignment({ assignmentId: row.assignmentId, endsOn }), bn ? "দায়িত্ব শেষ হয়েছে।" : "Assignment ended.");
                  }}
                >
                  {bn ? "শেষ করুন" : "End"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {!!links?.length && (
        <details className="workspace-action">
          <summary className="accordion-trigger">
            <span className="accordion-title-group">
              <Unlink size={16} aria-hidden="true" focusable="false" />
              {bn ? "বিষয় সরান" : "Unlink subject"}
            </span>
            <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
          </summary>
          <div className="workspace-action-list">
            {links.map(link => {
              const subject = coverage?.subjects.find(row => row.subjectId === link.subjectId);
              return (
                <div key={link._id}>
                  <span>{bn ? subject?.nameBn : subject?.nameEn}</span>
                  <button
                    className="button button-tertiary"
                    disabled={busy}
                    onClick={() => {
                      setPendingConfirm({
                        kind: "unlink-subject",
                        linkId: link._id,
                        name: bn ? subject?.nameBn ?? "" : subject?.nameEn ?? ""
                      });
                    }}
                  >
                    {bn ? "সরান" : "Unlink"}
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      )}
      {feedback && <p className="feedback-message" role="status">{feedback}</p>}
      {pendingConfirm && (
        <ConfirmModal
          title={bn ? "বিষয় সরিয়ে ফেলবেন?" : "Unlink subject?"}
          detail={
            bn
              ? `"${pendingConfirm.name}" বিষয়টি কোর্স থেকে সরিয়ে ফেলা হবে। কোনো সক্রিয় দায়িত্ব বা রুটিন থাকলে এই কাজটি করা যাবে না।`
              : `"${pendingConfirm.name}" will be unlinked from the course. Active assignments or routines will prevent this.`
          }
          danger
          confirmLabel={bn ? "বিষয় সরান" : "Unlink subject"}
          disabled={busy}
          locale={locale}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={async () => {
            const linkId = pendingConfirm.linkId;
            setPendingConfirm(null);
            await work(() => removeSubject({ courseSubjectId: linkId }), bn ? "বিষয় সরানো হয়েছে।" : "Subject unlinked.");
          }}
        />
      )}
    </div>
  );
}

export function ScheduleActions({
  locale,
  readOnly,
  coverage,
  schedules
}: {
  locale: Locale;
  readOnly: boolean;
  coverage?: Coverage;
  schedules?: Schedule[];
}) {
  const bn = locale === "bn";
  const create = useMutation(api.academics.schedules.create);
  const cancel = useMutation(api.academics.schedules.cancel);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ assignmentId: "", weekday: "0", startTime: "", endTime: "", effectiveFrom: "", effectiveUntil: "" });

  const selectedAssignment = coverage?.assignments.find(row => row.assignmentId === draft.assignmentId) ?? coverage?.assignments[0];
  const previewArgs = selectedAssignment && draft.startTime && draft.endTime && draft.effectiveFrom ? {
    batchId: selectedAssignment.batchId,
    teacherId: selectedAssignment.teacherId,
    subjectId: selectedAssignment.subjectId,
    weekday: Number(draft.weekday),
    startMinutes: minutes(draft.startTime),
    endMinutes: minutes(draft.endTime),
    effectiveFrom: draft.effectiveFrom,
    effectiveUntil: draft.effectiveUntil || undefined
  } : null;

  const conflicts = useQuery(api.academics.schedules.previewConflicts, previewArgs && previewArgs.endMinutes > previewArgs.startMinutes ? previewArgs : "skip");

  if (readOnly) return null;

  async function work(run: () => Promise<unknown>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await run();
      setFeedback(success);
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-actions-stack">
      <details className="workspace-action">
        <summary className="accordion-trigger">
          <span className="accordion-title-group">
            <CalendarPlus size={16} aria-hidden="true" focusable="false" />
            {bn ? "রুটিন যোগ করুন" : "Add routine"}
          </span>
          <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
        </summary>
        <form
          className="workspace-action-form"
          onSubmit={event => {
            event.preventDefault();
            if (!selectedAssignment || !previewArgs) return;
            void work(() => create(previewArgs), bn ? "রুটিন যোগ হয়েছে।" : "Routine added.").then(() => setDraft({ assignmentId: "", weekday: "0", startTime: "", endTime: "", effectiveFrom: "", effectiveUntil: "" }));
          }}
        >
          <div className="form-grid">
            <label>
              {bn ? "শিক্ষক দায়িত্ব" : "Assignment"}
              <select required value={selectedAssignment?.assignmentId ?? ""} onChange={event => setDraft(value => ({ ...value, assignmentId: event.target.value }))}>
                {coverage?.assignments.map(row => (
                  <option key={row.assignmentId} value={row.assignmentId}>
                    {row.teacherName} · {bn ? coverage.batches.find(batch => batch.batchId === row.batchId)?.nameBn : coverage.batches.find(batch => batch.batchId === row.batchId)?.nameEn} · {bn ? coverage.subjects.find(subject => subject.subjectId === row.subjectId)?.nameBn : coverage.subjects.find(subject => subject.subjectId === row.subjectId)?.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {bn ? "দিন" : "Weekday"}
              <select value={draft.weekday} onChange={event => setDraft(value => ({ ...value, weekday: event.target.value }))}>
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <option key={day} value={day}>{bn ? weekdaysBn[day] : weekdaysEn[day]}</option>
                ))}
              </select>
            </label>
            <label>{bn ? "শুরু" : "Start"}<input type="time" required value={draft.startTime} onChange={event => setDraft(value => ({ ...value, startTime: event.target.value }))} /></label>
            <label>{bn ? "শেষ" : "End"}<input type="time" required value={draft.endTime} onChange={event => setDraft(value => ({ ...value, endTime: event.target.value }))} /></label>
            <label>{bn ? "কার্যকর শুরু" : "Effective from"}<input type="date" required value={draft.effectiveFrom} onChange={event => setDraft(value => ({ ...value, effectiveFrom: event.target.value }))} /></label>
            <label>{bn ? "কার্যকর শেষ" : "Effective until"}<input type="date" value={draft.effectiveUntil} onChange={event => setDraft(value => ({ ...value, effectiveUntil: event.target.value }))} /></label>
          </div>

          {conflicts?.length ? (
            <div className="schedule-conflict-panel" role="alert">
              <strong>
                <AlertCircle size={16} className="text-danger" aria-hidden="true" focusable="false" style={{ marginRight: "6px", verticalAlign: "middle" }} />
                {bn ? "সময়সূচির সংঘর্ষ পাওয়া গেছে" : "Schedule conflicts found"}
              </strong>
              {conflicts.map(row => (
                <p key={`${row.kind}-${row.scheduleId}`}>
                  {row.kind === "teacher" ? (bn ? "শিক্ষকের সময় সংঘর্ষ" : "Teacher overlap") : (bn ? "ব্যাচের সময় সংঘর্ষ" : "Batch overlap")} · {String(Math.floor(row.startMinutes / 60)).padStart(2, "0")}:{String(row.startMinutes % 60).padStart(2, "0")}–{String(Math.floor(row.endMinutes / 60)).padStart(2, "0")}:{String(row.endMinutes % 60).padStart(2, "0")}
                </p>
              ))}
            </div>
          ) : previewArgs && conflicts ? (
            <p className="success-panel" role="status">✓ {bn ? "কোনো সময় সংঘর্ষ নেই।" : "No schedule conflicts."}</p>
          ) : null}

          <button className="button button-primary" disabled={busy || !coverage?.assignments.length || !!conflicts?.length}>
            {bn ? "রুটিন যোগ করুন" : "Add routine"}
          </button>
        </form>
      </details>

      {!!schedules?.length && (
        <details className="workspace-action">
          <summary className="accordion-trigger">
            <span className="accordion-title-group">
              <CalendarX2 size={16} aria-hidden="true" focusable="false" />
              {bn ? "রুটিন বাতিল করুন" : "Cancel routines"}
            </span>
            <ChevronDown size={16} className="accordion-chevron" aria-hidden="true" focusable="false" />
          </summary>
          <div className="workspace-action-list">
            {schedules.map(row => (
              <div key={row.scheduleId}>
                <span>
                  {(bn ? weekdaysBn : weekdaysEn)[row.weekday]} · {String(Math.floor(row.startMinutes / 60)).padStart(2, "0")}:{String(row.startMinutes % 60).padStart(2, "0")}–{String(Math.floor(row.endMinutes / 60)).padStart(2, "0")}:{String(row.endMinutes % 60).padStart(2, "0")}
                </span>
                <button className="button button-tertiary" disabled={busy} onClick={() => void work(() => cancel({ scheduleId: row.scheduleId }), bn ? "রুটিন বাতিল হয়েছে।" : "Routine cancelled.")}>
                  {bn ? "বাতিল" : "Cancel"}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
      {feedback && <p className="feedback-message" role="status">{feedback}</p>}
    </div>
  );
}

export function AllSchedules({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const rows = useQuery(api.academics.courseWorkspace.getScheduleAgenda, {});
  return (
    <div className="all-schedules">
      <h3>{bn ? "সব কোর্সের রুটিন" : "All schedules"}</h3>
      {rows?.length ? (
        <div className="agenda-list">
          {rows.map(row => (
            <article key={row.scheduleId}>
              <time>
                <Clock size={12} aria-hidden="true" focusable="false" style={{ marginRight: "4px", verticalAlign: "middle" }} />
                {(bn ? weekdaysBn : weekdaysEn)[row.weekday]} · {String(Math.floor(row.startMinutes / 60)).padStart(2, "0")}:{String(row.startMinutes % 60).padStart(2, "0")}–{String(Math.floor(row.endMinutes / 60)).padStart(2, "0")}:{String(row.endMinutes % 60).padStart(2, "0")}
              </time>
              <div>
                <strong>{bn ? row.batchNameBn : row.batchNameEn}</strong>
                <p>{bn ? row.subjectNameBn : row.subjectNameEn} · {row.teacherName}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-panel">{bn ? "কোনো সক্রিয় রুটিন নেই।" : "No active routines."}</p>
      )}
    </div>
  );
}
