"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";
import { AcademicForm } from "./shared/AcademicForm";
import { ConfirmModal } from "./shared/ConfirmModal";
import { FeedbackMessage, type Feedback } from "./shared/FeedbackMessage";
import { executeMutation } from "./shared/utils";

const pageLimit = { numItems: 100, cursor: null } as const;

interface AcademicOperationsProps {
  locale: "bn" | "en";
  selectedBatchId: string | null;
  onSelectBatchId: (id: string | null) => void;
}

export function AcademicOperations({
  locale,
  selectedBatchId,
  onSelectBatchId,
}: AcademicOperationsProps) {
  const bn = locale === "bn";

  // Load full workspace details
  const workspace = useQuery(api.academics.options.ownerWorkspace, {});

  // Queries for active selections in batch detail
  const batchId = selectedBatchId ? (selectedBatchId as Id<"batches">) : null;
  const batch = workspace?.batches.find((b) => b.batchId === batchId);

  const courseSubjects = useQuery(
    api.academics.courses.listSubjects,
    batch ? { courseId: batch.courseId } : "skip",
  );
  const activeAssignments = useQuery(
    api.academics.assignments.listForBatch,
    batchId ? { batchId, status: "active", paginationOpts: pageLimit } : "skip",
  );
  const activeSchedules = useQuery(
    api.academics.schedules.listForBatch,
    batchId ? { batchId, status: "active", paginationOpts: pageLimit } : "skip",
  );

  // Mutations
  const createAssignment = useMutation(api.academics.assignments.create);
  const endAssignment = useMutation(api.academics.assignments.end);
  const createSchedule = useMutation(api.academics.schedules.create);
  const cancelSchedule = useMutation(api.academics.schedules.cancel);
  const createClass = useMutation(api.attendance.functions.createSession);
  const addSubject = useMutation(api.academics.courses.addSubject);
  const removeSubject = useMutation(api.academics.courses.removeSubject);

  // State
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    detail: string;
    danger?: boolean;
    work: () => Promise<unknown>;
  } | null>(null);

  if (!workspace) {
    return <PortalPageState state="loading" locale={locale} />;
  }

  // Map subjects for friendly labels
  const subjectMap = new Map(workspace.subjects.map((s) => [s.subjectId, s]));
  const teacherMap = new Map(workspace.teachers.map((t) => [t.teacherId, t]));

  // Compute available subjects to link (active subjects not already linked to the course)
  const linkedSubjectIds = new Set(
    courseSubjects?.map((s) => s.subjectId) ?? [],
  );
  const availableSubjects = workspace.subjects.filter(
    (s) => !linkedSubjectIds.has(s.subjectId),
  );

  const runMutationAction = (
    work: () => Promise<unknown>,
    form?: HTMLFormElement,
  ) => {
    void executeMutation(
      work,
      setBusy,
      setFeedback,
      bn ? "একাডেমিক রেকর্ড আপডেট হয়েছে।" : "Academic record updated.",
      bn,
    ).then((ok) => {
      if (ok) {
        form?.reset();
      }
    });
  };

  const handleLinkSubject = (data: FormData, form: HTMLFormElement) => {
    if (!batch) return;
    const subjectId = String(data.get("subjectId")) as Id<"subjects">;
    const sortOrder = Number(data.get("sortOrder"));
    runMutationAction(
      () => addSubject({ courseId: batch.courseId, subjectId, sortOrder }),
      form,
    );
  };

  const handleUnlinkSubject = (courseSubjectId: Id<"courseSubjects">) => {
    setConfirmation({
      title: bn ? "বিষয় অপসারণ করতে চান?" : "Unlink subject from course?",
      detail: bn
        ? "এই বিষয়টি কোর্স থেকে অপসারণ করলে এই কোর্সের প্রতিটি ব্যাচ প্রভাবিত হবে। কোনো ব্যাচে এই বিষয়ের সক্রিয় রুটিন বা শিক্ষক অ্যাসাইনমেন্ট থাকলে অপারেশনটি ব্যর্থ হবে।"
        : "Unlinking this subject will affect every batch under this course. If active schedules or assignments exist for this subject, the unlinking will be rejected.",
      danger: true,
      work: () => removeSubject({ courseSubjectId }),
    });
  };

  const handleAssignTeacher = (data: FormData, form: HTMLFormElement) => {
    if (!batchId) return;
    const teacherId = String(data.get("teacherId")) as Id<"teachers">;
    const subjVal = String(data.get("subjectId"));
    const subjectId = subjVal ? (subjVal as Id<"subjects">) : undefined;
    const startsOn = String(data.get("startsOn"));
    const endsOn = String(data.get("endsOn")) || undefined;

    runMutationAction(
      () =>
        createAssignment({ batchId, teacherId, subjectId, startsOn, endsOn }),
      form,
    );
  };

  const handleAddRoutine = (data: FormData, form: HTMLFormElement) => {
    if (!batchId) return;
    const teacherId = String(data.get("teacherId")) as Id<"teachers">;
    const subjVal = String(data.get("subjectId"));
    const subjectId = subjVal ? (subjVal as Id<"subjects">) : undefined;
    const weekday = Number(data.get("weekday"));
    const startMinutes =
      Number(data.get("startHour")) * 60 + Number(data.get("startMinute"));
    const endMinutes =
      Number(data.get("endHour")) * 60 + Number(data.get("endMinute"));
    const roomBn = String(data.get("roomBn")) || undefined;
    const roomEn = String(data.get("roomEn")) || undefined;
    const effectiveFrom = String(data.get("effectiveFrom"));
    const effectiveUntil = String(data.get("effectiveUntil")) || undefined;

    runMutationAction(
      () =>
        createSchedule({
          batchId,
          teacherId,
          subjectId,
          weekday,
          startMinutes,
          endMinutes,
          roomBn,
          roomEn,
          effectiveFrom,
          effectiveUntil,
        }),
      form,
    );
  };

  const handleCreateClassSession = (data: FormData, form: HTMLFormElement) => {
    if (!batchId) return;
    const teacherId = String(data.get("teacherId")) as Id<"teachers">;
    const sessionDate = String(data.get("sessionDate"));
    const startsAt = new Date(String(data.get("startsAt"))).getTime();
    const endsAt = new Date(String(data.get("endsAt"))).getTime();

    runMutationAction(
      () => createClass({ batchId, teacherId, sessionDate, startsAt, endsAt }),
      form,
    );
  };

  return (
    <div className="master-detail">
      {/* Left panel: selection-list of batches */}
      <section>
        <div className="selection-list">
          {workspace.batches.map((b) => {
            const isSelected = selectedBatchId === b.batchId;
            return (
              <button
                key={b.batchId}
                className={isSelected ? "selected" : ""}
                onClick={() => onSelectBatchId(isSelected ? null : b.batchId)}
              >
                <strong style={{ fontSize: "14px" }}>
                  {bn ? b.nameBn : b.nameEn}
                </strong>
                <span style={{ fontSize: "11px", color: "var(--ink-mute)" }}>
                  {workspace.courses.find((c) => c.courseId === b.courseId)
                    ?.nameEn ?? ""}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Right panel: Operations dashboard for selected batch */}
      <section>
        {batch && batchId ? (
          <div>
            <header style={{ marginBottom: "20px" }}>
              <span className="eyebrow">
                {bn ? "ব্যাচ অপারেশনস" : "Batch Operations"}
              </span>
              <h2
                style={{
                  margin: "4px 0 8px",
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                {bn ? batch.nameBn : batch.nameEn}
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--ink-mute)",
                  fontSize: "13px",
                }}
              >
                {bn ? "কোর্স:" : "Course:"}{" "}
                {workspace.courses.find((c) => c.courseId === batch.courseId)
                  ?.nameEn ?? ""}
              </p>
            </header>

            <FeedbackMessage value={feedback} />

            {/* Scoped Course Subjects */}
            <section
              className="section"
              style={{ paddingBlock: "24px", marginTop: "16px" }}
            >
              <div
                className="section-heading"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
                  {bn
                    ? "কোর্সের বিষয় তালিকা"
                    : "Subjects in this batch's course"}
                </h3>
              </div>
              {!courseSubjects ? (
                <p style={{ fontSize: "13px", color: "var(--ink-mute)" }}>
                  {bn ? "লোড হচ্ছে..." : "Loading subjects..."}
                </p>
              ) : courseSubjects.length === 0 ? (
                <p
                  className="empty-panel"
                  style={{ padding: "16px", fontSize: "13px" }}
                >
                  {bn
                    ? "কোনো বিষয় যুক্ত নেই।"
                    : "No subjects linked to this course."}
                </p>
              ) : (
                <div className="table-wrap" style={{ marginTop: "12px" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{bn ? "বিষয় কোড" : "Subject Code"}</th>
                        <th>{bn ? "নাম" : "Name"}</th>
                        <th>{bn ? "কাজ" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courseSubjects.map((cs) => {
                        const subj = subjectMap.get(cs.subjectId);
                        return (
                          <tr key={cs._id}>
                            <td>{subj?.code ?? "—"}</td>
                            <td>
                              {subj ? (bn ? subj.nameBn : subj.nameEn) : "—"}
                            </td>
                            <td>
                              <button
                                className="button button-secondary"
                                type="button"
                                style={{
                                  minHeight: "32px",
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() => handleUnlinkSubject(cs._id)}
                              >
                                {bn ? "অপসারণ" : "Unlink"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Active Assignments */}
            <section className="section" style={{ paddingBlock: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: "0 0 12px",
                }}
              >
                {bn
                  ? "সক্রিয় শিক্ষক অ্যাসাইনমেন্ট"
                  : "Active Teacher Assignments"}
              </h3>
              {!activeAssignments ? (
                <p style={{ fontSize: "13px", color: "var(--ink-mute)" }}>
                  {bn ? "লোড হচ্ছে..." : "Loading assignments..."}
                </p>
              ) : activeAssignments.page.length === 0 ? (
                <p
                  className="empty-panel"
                  style={{ padding: "16px", fontSize: "13px" }}
                >
                  {bn
                    ? "কোনো শিক্ষক অ্যাসাইনমেন্ট নেই।"
                    : "No active teacher assignments."}
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{bn ? "শিক্ষক" : "Teacher"}</th>
                        <th>{bn ? "বিষয়" : "Subject"}</th>
                        <th>{bn ? "শুরুর তারিখ" : "Starts"}</th>
                        <th>{bn ? "কাজ" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeAssignments.page.map((row) => {
                        const tInfo = teacherMap.get(row.teacherId);
                        const sInfo = row.subjectId
                          ? subjectMap.get(row.subjectId)
                          : null;
                        return (
                          <tr key={row._id}>
                            <td>{tInfo?.displayName ?? row.teacherId}</td>
                            <td>
                              {sInfo
                                ? bn
                                  ? sInfo.nameBn
                                  : sInfo.nameEn
                                : bn
                                  ? "সব বিষয়"
                                  : "All subjects"}
                            </td>
                            <td>{row.startsOn}</td>
                            <td>
                              <button
                                className="button button-secondary"
                                type="button"
                                style={{
                                  minHeight: "32px",
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() =>
                                  setConfirmation({
                                    title: bn
                                      ? "অ্যাসাইনমেন্ট শেষ করতে চান?"
                                      : "End assignment?",
                                    detail: bn
                                      ? "অ্যাসাইনমেন্টটি আজ শেষ করা হবে। এর সক্রিয় রুটিন থাকলে আগে তা বাতিল করতে হবে।"
                                      : "This teacher assignment will be marked as ended today. Any active weekly routines must be cancelled first.",
                                    work: () =>
                                      endAssignment({
                                        assignmentId: row._id,
                                        endsOn: new Date()
                                          .toISOString()
                                          .slice(0, 10),
                                      }),
                                  })
                                }
                              >
                                {bn ? "শেষ করুন" : "End"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Active Routines */}
            <section className="section" style={{ paddingBlock: "24px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: "0 0 12px",
                }}
              >
                {bn ? "সক্রিয় রুটিন" : "Active Weekly Routines"}
              </h3>
              {!activeSchedules ? (
                <p style={{ fontSize: "13px", color: "var(--ink-mute)" }}>
                  {bn ? "লোড হচ্ছে..." : "Loading schedules..."}
                </p>
              ) : activeSchedules.page.length === 0 ? (
                <p
                  className="empty-panel"
                  style={{ padding: "16px", fontSize: "13px" }}
                >
                  {bn ? "কোনো সক্রিয় রুটিন নেই।" : "No active weekly routines."}
                </p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{bn ? "বার" : "Day"}</th>
                        <th>{bn ? "বিষয়" : "Subject"}</th>
                        <th>{bn ? "সময়" : "Time"}</th>
                        <th>{bn ? "রুম" : "Room"}</th>
                        <th>{bn ? "কাজ" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSchedules.page.map((row) => {
                        const sInfo = row.subjectId
                          ? subjectMap.get(row.subjectId)
                          : null;
                        const dayNamesBn = [
                          "রবিবার",
                          "সোমবার",
                          "মঙ্গলবার",
                          "বুধবার",
                          "বৃহস্পতিবার",
                          "শুক্রবার",
                          "শনিবার",
                        ];
                        const dayNamesEn = [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ];
                        const start = `${Math.floor(row.startMinutes / 60)
                          .toString()
                          .padStart(
                            2,
                            "0",
                          )}:${(row.startMinutes % 60).toString().padStart(2, "0")}`;
                        const end = `${Math.floor(row.endMinutes / 60)
                          .toString()
                          .padStart(
                            2,
                            "0",
                          )}:${(row.endMinutes % 60).toString().padStart(2, "0")}`;

                        return (
                          <tr key={row._id}>
                            <td>
                              {bn
                                ? dayNamesBn[row.weekday]
                                : dayNamesEn[row.weekday]}
                            </td>
                            <td>
                              {sInfo
                                ? bn
                                  ? sInfo.nameBn
                                  : sInfo.nameEn
                                : bn
                                  ? "সব বিষয়"
                                  : "All subjects"}
                            </td>
                            <td>
                              {start} – {end}
                            </td>
                            <td>
                              {bn ? (row.roomBn ?? "—") : (row.roomEn ?? "—")}
                            </td>
                            <td>
                              <button
                                className="button button-secondary"
                                type="button"
                                style={{
                                  minHeight: "32px",
                                  padding: "4px 10px",
                                  fontSize: "12px",
                                }}
                                onClick={() =>
                                  setConfirmation({
                                    title: bn
                                      ? "রুটিন বাতিল করতে চান?"
                                      : "Cancel weekly routine?",
                                    detail: bn
                                      ? "এই সাপ্তাহিক রুটিনটি আজ থেকে আর সক্রিয় থাকবে না।"
                                      : "This weekly schedule will be cancelled and will no longer take effect.",
                                    danger: true,
                                    work: () =>
                                      cancelSchedule({ scheduleId: row._id }),
                                  })
                                }
                              >
                                {bn ? "বাতিল" : "Cancel"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Collapsible Forms Grid */}
            <div
              className="editor-grid"
              style={{
                gridTemplateColumns: "1fr",
                gap: "16px",
                marginTop: "24px",
              }}
            >
              <details className="editor-disclosure">
                <summary>
                  {bn ? "কোর্সে বিষয় যুক্ত করুন" : "Link subject to course"}
                </summary>
                <AcademicForm
                  title={bn ? "কোর্সে বিষয় সংযোগ" : "Subject Association"}
                  onSubmit={handleLinkSubject}
                >
                  <label>
                    {bn ? "বিষয়" : "Subject"}
                    <select name="subjectId" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {availableSubjects.map((row) => (
                        <option key={row.subjectId} value={row.subjectId}>
                          {bn ? row.nameBn : row.nameEn}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {bn ? "ক্রম" : "Sort Order"}
                    <input
                      name="sortOrder"
                      type="number"
                      min={0}
                      defaultValue={0}
                      required
                    />
                  </label>
                  <button className="button button-primary" disabled={busy}>
                    {bn ? "সংযোগ করুন" : "Link Subject"}
                  </button>
                </AcademicForm>
              </details>

              <details className="editor-disclosure">
                <summary>
                  {bn ? "শিক্ষক অ্যাসাইন করুন" : "Assign teacher"}
                </summary>
                <AcademicForm
                  title={bn ? "নতুন অ্যাসাইনমেন্ট" : "New Assignment"}
                  onSubmit={handleAssignTeacher}
                >
                  <label>
                    {bn ? "শিক্ষক" : "Teacher"}
                    <select name="teacherId" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {workspace.teachers.map((row) => (
                        <option key={row.teacherId} value={row.teacherId}>
                          {row.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {bn ? "বিষয়" : "Subject"}
                    <select name="subjectId" defaultValue="">
                      <option value="">
                        {bn ? "সব বিষয় (জেনারেল)" : "All subjects"}
                      </option>
                      {courseSubjects?.map((cs) => {
                        const s = subjectMap.get(cs.subjectId);
                        return s ? (
                          <option key={s.subjectId} value={s.subjectId}>
                            {bn ? s.nameBn : s.nameEn}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      {bn ? "শুরুর তারিখ" : "Starts On"}
                      <input name="startsOn" type="date" required />
                    </label>
                    <label>
                      {bn ? "শেষের তারিখ (ঐচ্ছিক)" : "Ends On (Optional)"}
                      <input name="endsOn" type="date" />
                    </label>
                  </div>
                  <button className="button button-primary" disabled={busy}>
                    {bn ? "অ্যাসাইন করুন" : "Assign Teacher"}
                  </button>
                </AcademicForm>
              </details>

              <details className="editor-disclosure">
                <summary>
                  {bn ? "সাপ্তাহিক রুটিন যোগ করুন" : "Add weekly routine"}
                </summary>
                <AcademicForm
                  title={bn ? "রুটিন শিডিউল" : "Routine Schedule"}
                  onSubmit={handleAddRoutine}
                >
                  <label>
                    {bn ? "শিক্ষক" : "Teacher"}
                    <select name="teacherId" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {workspace.teachers.map((row) => (
                        <option key={row.teacherId} value={row.teacherId}>
                          {row.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {bn ? "বিষয়" : "Subject"}
                    <select name="subjectId" defaultValue="">
                      <option value="">
                        {bn ? "সব বিষয়" : "All subjects"}
                      </option>
                      {courseSubjects?.map((cs) => {
                        const s = subjectMap.get(cs.subjectId);
                        return s ? (
                          <option key={s.subjectId} value={s.subjectId}>
                            {bn ? s.nameBn : s.nameEn}
                          </option>
                        ) : null;
                      })}
                    </select>
                  </label>
                  <label>
                    {bn ? "বার" : "Weekday"}
                    <select name="weekday" defaultValue="0">
                      {[
                        "রবি / Sun",
                        "সোম / Mon",
                        "মঙ্গল / Tue",
                        "বুধ / Wed",
                        "বৃহঃ / Thu",
                        "শুক্র / Fri",
                        "শনি / Sat",
                      ].map((label, index) => (
                        <option value={index} key={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid">
                    <label>
                      {bn ? "শুরুর ঘণ্টা (0-23)" : "Start Hour (0-23)"}
                      <input
                        name="startHour"
                        type="number"
                        min={0}
                        max={23}
                        required
                      />
                    </label>
                    <label>
                      {bn ? "মিনিট" : "Minute"}
                      <input
                        name="startMinute"
                        type="number"
                        min={0}
                        max={59}
                        defaultValue={0}
                        required
                      />
                    </label>
                    <label>
                      {bn ? "শেষের ঘণ্টা" : "End Hour"}
                      <input
                        name="endHour"
                        type="number"
                        min={0}
                        max={23}
                        required
                      />
                    </label>
                    <label>
                      {bn ? "মিনিট" : "Minute"}
                      <input
                        name="endMinute"
                        type="number"
                        min={0}
                        max={59}
                        defaultValue={0}
                        required
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      {bn ? "কার্যকর শুরু" : "Effective From"}
                      <input name="effectiveFrom" type="date" required />
                    </label>
                    <label>
                      {bn ? "কার্যকর শেষ" : "Effective Until"}
                      <input name="effectiveUntil" type="date" />
                    </label>
                    <label>
                      {bn ? "রুম (বাংলা)" : "Room (Bangla)"}
                      <input name="roomBn" />
                    </label>
                    <label>
                      Room (English)
                      <input name="roomEn" />
                    </label>
                  </div>
                  <button className="button button-primary" disabled={busy}>
                    {bn ? "রুটিন যোগ করুন" : "Add Routine"}
                  </button>
                </AcademicForm>
              </details>

              <details className="editor-disclosure">
                <summary>
                  {bn ? "ক্লাস সেশন তৈরি করুন" : "Create class session"}
                </summary>
                <AcademicForm
                  title={bn ? "ক্লাস সেশন তৈরি" : "Class Session Creation"}
                  onSubmit={handleCreateClassSession}
                >
                  <label>
                    {bn ? "শিক্ষক" : "Teacher"}
                    <select name="teacherId" required defaultValue="">
                      <option value="" disabled>
                        —
                      </option>
                      {workspace.teachers.map((row) => (
                        <option key={row.teacherId} value={row.teacherId}>
                          {row.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {bn ? "তারিখ" : "Date"}
                    <input name="sessionDate" type="date" required />
                  </label>
                  <div className="form-grid">
                    <label>
                      {bn ? "শুরু" : "Starts At"}
                      <input name="startsAt" type="datetime-local" required />
                    </label>
                    <label>
                      {bn ? "শেষ" : "Ends At"}
                      <input name="endsAt" type="datetime-local" required />
                    </label>
                  </div>
                  <button className="button button-primary" disabled={busy}>
                    {bn ? "ক্লাস তৈরি করুন" : "Create Class"}
                  </button>
                </AcademicForm>
              </details>
            </div>
          </div>
        ) : (
          <div
            className="empty-panel"
            style={{
              display: "grid",
              placeItems: "center",
              height: "200px",
              textAlign: "center",
              alignContent: "center",
            }}
          >
            <p>
              {bn
                ? "যেকোনো অপারেশনের জন্য বাম পাশের তালিকা থেকে একটি ব্যাচ নির্বাচন করুন।"
                : "Select a batch from the list on the left to manage routines, assignments, and class sessions."}
            </p>
          </div>
        )}
      </section>

      {/* Shared Confirmation Dialog */}
      {confirmation && (
        <ConfirmModal
          title={confirmation.title}
          detail={confirmation.detail}
          danger={confirmation.danger}
          locale={locale}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const item = confirmation;
            setConfirmation(null);
            runMutationAction(item.work);
          }}
        />
      )}
    </div>
  );
}
