"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../../PortalPageState";

const page = { numItems: 100, cursor: null } as const;
function timeToMinutes(value: string) {
  if (!value) return undefined;
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}
type Audience = "single_batch" | "selected_batches" | "all_course_batches";
type Mode = "mcq" | "written" | "both";
type Rule = {
  subjectId: Id<"subjects">;
  mode: Mode;
  mcq: number;
  written: number;
  pass: number;
  mcqPass: string;
  writtenPass: string;
  teacherId: Id<"teachers"> | "";
  assignmentMode: "all" | "per_batch";
  batchTeachers: Record<string, Id<"teachers"> | "">;
};

export function ExamCreateWizard({
  locale,
  onCreated,
}: {
  locale: "bn" | "en";
  onCreated?: (id: Id<"exams">) => void;
}) {
  const bn = locale === "bn";
  const [step, setStep] = useState(1);
  const [basicValues, setBasicValues] = useState({
    nameBn: "",
    nameEn: "",
    examDate: "",
    examType: "monthly" as
      "weekly" | "monthly" | "model_test" | "term" | "final" | "other",
    startsAt: "",
    endsAt: "",
    venue: "",
  });
  const [examId, setExamId] = useState<Id<"exams"> | null>(null);
  const [sessionId, setSessionId] = useState<Id<"academicSessions"> | "">("");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [audience, setAudience] = useState<Audience>("single_batch");
  const [batchIds, setBatchIds] = useState<Id<"batches">[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [exclusions, setExclusions] = useState<Record<string, string>>({});
  const [merit, setMerit] = useState<
    "official_only" | "official_and_batch" | "none"
  >("official_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [initializingMarks, setInitializingMarks] = useState(false);
  const [restoredExamId, setRestoredExamId] = useState<string | null>(null);
  const sessions = useQuery(api.academics.sessions.list, {
    status: "active",
    paginationOpts: page,
  });
  const activeSession = sessionId || sessions?.page[0]?._id || "";
  const courses = useQuery(
    api.academics.courses.list,
    activeSession
      ? {
          academicSessionId: activeSession,
          status: "active",
          paginationOpts: page,
        }
      : "skip",
  );
  const activeCourse = courseId || courses?.page[0]?._id || "";
  const batches = useQuery(
    api.academics.batches.list,
    activeCourse
      ? { courseId: activeCourse, status: "active", paginationOpts: page }
      : "skip",
  );
  const subjects = useQuery(api.academics.subjects.list, {
    status: "active",
    paginationOpts: page,
  });
  const teachers = useQuery(api.academics.teachers.list, {
    status: "active",
    paginationOpts: page,
  });
  const createDraft = useMutation(api.exams.exams.createDraft);
  const updateDraft = useMutation(api.exams.exams.updateDraft);
  const freeze = useMutation(api.exams.audience.freezeRoster);
  const configureSubjects = useMutation(api.exams.subjects.configure);
  const configureAssignments = useMutation(api.exams.assignments.configure);
  const open = useMutation(api.exams.assignments.openMarksEntry);
  const detail = useQuery(api.exams.exams.detail, examId ? { examId } : "skip");
  const audienceSelectionValid =
    audience === "all_course_batches" ||
    (audience === "single_batch" && batchIds.length === 1) ||
    (audience === "selected_batches" && batchIds.length >= 2);
  const preview = useQuery(
    api.exams.audience.preview,
    examId && step >= 2 && audienceSelectionValid
      ? {
          examId,
          batchIds,
          paginationOpts: { numItems: 500, cursor: null },
        }
      : "skip",
  );
  useEffect(() => {
    if (!examId || !detail?.exam.setupDraftJson || restoredExamId === examId)
      return;
    try {
      const saved = JSON.parse(detail.exam.setupDraftJson) as {
        step?: number;
        batchIds?: Id<"batches">[];
        rules?: Rule[];
        exclusions?: Record<string, string>;
        merit?: typeof merit;
      };
      // The server draft is an external persisted source; hydrate all wizard fields together once per exam.
      /* eslint-disable react-hooks/set-state-in-effect */
      if (saved.batchIds) setBatchIds(saved.batchIds);
      if (saved.rules) setRules(saved.rules);
      if (saved.exclusions) setExclusions(saved.exclusions);
      if (saved.merit) setMerit(saved.merit);
      if (saved.step && saved.step >= 2 && saved.step <= 5) setStep(saved.step);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      setDraftMessage(
        bn
          ? "সংরক্ষিত সেটআপ পড়া যায়নি।"
          : "Saved setup could not be restored.",
      );
    }
    setRestoredExamId(examId);
  }, [bn, detail?.exam.setupDraftJson, examId, merit, restoredExamId]);
  const selectedBatches =
    audience === "all_course_batches"
      ? (batches?.page.map((row) => row._id) ?? [])
      : batchIds;
  const totalFull = useMemo(
    () =>
      rules.reduce(
        (sum, rule) =>
          sum +
          (rule.mode === "written"
            ? rule.written
            : rule.mode === "mcq"
              ? rule.mcq
              : rule.mcq + rule.written),
        0,
      ),
    [rules],
  );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  async function basic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      const values = {
        courseId: activeCourse as Id<"courses">,
        audienceMode: audience,
        nameBn: basicValues.nameBn,
        nameEn: basicValues.nameEn,
        examDate: basicValues.examDate,
        examType: basicValues.examType,
        startsAtMinutes: timeToMinutes(basicValues.startsAt),
        endsAtMinutes: timeToMinutes(basicValues.endsAt),
        venue: basicValues.venue || undefined,
      };
      if (examId) await updateDraft({ examId, ...values });
      else {
        const id = await createDraft({
          ...values,
        });
        setExamId(id);
      }
      setStep(2);
    });
  }
  function toggleBatch(id: Id<"batches">) {
    setBatchIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  function toggleSubject(id: Id<"subjects">) {
    setRules((current) =>
      current.some((rule) => rule.subjectId === id)
        ? current.filter((rule) => rule.subjectId !== id)
        : [
            ...current,
            {
              subjectId: id,
              mode: "both",
              mcq: 40,
              written: 60,
              pass: 40,
              mcqPass: "",
              writtenPass: "",
              teacherId: "",
              assignmentMode: "all",
              batchTeachers: {},
            },
          ],
    );
  }
  async function finish() {
    if (!examId) return;
    await run(async () => {
      await updateDraft({ examId, meritMode: merit });
      const frozenBatches = audience === "all_course_batches" ? [] : batchIds;
      if (detail?.exam.rosterStatus !== "frozen")
        await freeze({
          examId,
          batchIds: frozenBatches,
          exclusions: Object.entries(exclusions).map(([studentId, reason]) => ({
            studentId: studentId as Id<"students">,
            reason,
          })),
        });
      const subjectIds = await configureSubjects({
        examId,
        subjects: rules.map((rule, index) => ({
          subjectId: rule.subjectId,
          mode: rule.mode,
          mcqFullMarksScaled:
            rule.mode === "written" ? undefined : Math.round(rule.mcq * 100),
          writtenFullMarksScaled:
            rule.mode === "mcq" ? undefined : Math.round(rule.written * 100),
          totalFullMarksScaled: Math.round(
            (rule.mode === "written"
              ? rule.written
              : rule.mode === "mcq"
                ? rule.mcq
                : rule.mcq + rule.written) * 100,
          ),
          passMarksScaled: Math.round(rule.pass * 100),
          mcqPassMarksScaled: rule.mcqPass
            ? Math.round(Number(rule.mcqPass) * 100)
            : undefined,
          writtenPassMarksScaled: rule.writtenPass
            ? Math.round(Number(rule.writtenPass) * 100)
            : undefined,
          isRequired: true,
          sortOrder: index + 1,
        })),
      });
      await configureAssignments({
        examId,
        assignments: subjectIds.flatMap((examSubjectId, index) => {
          const rule = rules[index];
          if (rule.assignmentMode === "per_batch")
            return selectedBatches.map((batchId) => ({
              examSubjectId,
              batchId,
              teacherId: rule.batchTeachers[batchId] as Id<"teachers">,
            }));
          return [
            { examSubjectId, teacherId: rule.teacherId as Id<"teachers"> },
          ];
        }),
      });
      const opened = await open({ examId });
      setInitializingMarks(opened.initializing);
      onCreated?.(examId);
      setStep(6);
    });
  }
  async function saveSetupDraft() {
    if (!examId) return;
    await run(async () => {
      await updateDraft({
        examId,
        meritMode: merit,
        setupDraftJson: JSON.stringify({
          step,
          batchIds,
          rules,
          exclusions,
          merit,
        }),
      });
      setDraftMessage(bn ? "খসড়া সংরক্ষিত হয়েছে।" : "Draft saved.");
    });
  }
  if (!sessions || !subjects || !teachers)
    return <PortalPageState state="loading" locale={locale} />;
  if (step === 6)
    return (
      <section className="submitted-summary">
        <strong>{bn ? "পরীক্ষা তৈরি হয়েছে" : "Exam created"}</strong>
        <span>
          {bn
            ? initializingMarks
              ? "রোস্টার ফ্রোজেন হয়েছে; নম্বরের সারি ব্যাচে প্রস্তুত হচ্ছে।"
              : "ফ্রোজেন রোস্টারসহ নম্বর এন্ট্রি খোলা হয়েছে।"
            : initializingMarks
              ? "The roster is frozen and marks rows are initializing in batches."
              : "Marks entry is open with a frozen roster."}
        </span>
      </section>
    );
  return (
    <section className="exam-wizard">
      <div className="stepper-container" aria-label={bn ? "ধাপ" : "Steps"}>
        <div className="stepper-line">
          <div
            className="stepper-line-fill"
            style={{ width: `${((step - 1) / 4) * 100}%` }}
          />
        </div>
        {[
          { number: 1, labelEn: "Basic info", labelBn: "মৌলিক তথ্য" },
          { number: 2, labelEn: "Audience", labelBn: "অডিয়েন্স" },
          { number: 3, labelEn: "Subjects & marks", labelBn: "বিষয় ও নম্বর" },
          { number: 4, labelEn: "Teachers & merit", labelBn: "শিক্ষক ও মেধা" },
          { number: 5, labelEn: "Confirm", labelBn: "নিশ্চিতকরণ" },
        ].map((s) => {
          const isActive = s.number === step;
          const isDone = s.number < step;
          return (
            <div
              key={s.number}
              className={`step-item ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="step-circle">{s.number}</span>
              <span className="step-label">{bn ? s.labelBn : s.labelEn}</span>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {draftMessage && (
        <p className="form-message success" role="status">
          {draftMessage}
        </p>
      )}
      {step === 1 && (
        <form
          className="operation-form compact-form"
          onSubmit={(event) => void basic(event)}
        >
          <fieldset>
            <legend>{bn ? "১. মৌলিক তথ্য" : "1. Basic information"}</legend>
            <div className="form-grid">
              <label>
                {bn ? "সেশন" : "Session"}
                <select
                  value={activeSession}
                  onChange={(event) => {
                    setSessionId(event.target.value as Id<"academicSessions">);
                    setCourseId("");
                  }}
                >
                  <option value="">—</option>
                  {sessions.page.map((row) => (
                    <option key={row._id} value={row._id}>
                      {bn ? row.nameBn : row.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {bn ? "কোর্স" : "Course"}
                <select
                  value={activeCourse}
                  onChange={(event) =>
                    setCourseId(event.target.value as Id<"courses">)
                  }
                >
                  {courses?.page.map((row) => (
                    <option key={row._id} value={row._id}>
                      {bn ? row.nameBn : row.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                বাংলা
                <input
                  name="nameBn"
                  required
                  value={basicValues.nameBn}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      nameBn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                English
                <input
                  name="nameEn"
                  required
                  value={basicValues.nameEn}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      nameEn: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {bn ? "তারিখ" : "Date"}
                <input
                  name="examDate"
                  type="date"
                  required
                  value={basicValues.examDate}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      examDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {bn ? "শুরুর সময় (ঐচ্ছিক)" : "Start time (optional)"}
                <input
                  name="startsAt"
                  type="time"
                  value={basicValues.startsAt}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {bn ? "শেষ সময় (ঐচ্ছিক)" : "End time (optional)"}
                <input
                  name="endsAt"
                  type="time"
                  value={basicValues.endsAt}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {bn ? "পরীক্ষার ধরন" : "Exam type"}
                <select
                  name="examType"
                  value={basicValues.examType}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      examType: event.target.value as typeof current.examType,
                    }))
                  }
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="model_test">Model test</option>
                  <option value="term">Term</option>
                  <option value="final">Final</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                {bn ? "স্থান" : "Venue"}
                <input
                  name="venue"
                  value={basicValues.venue}
                  onChange={(event) =>
                    setBasicValues((current) => ({
                      ...current,
                      venue: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {bn ? "অডিয়েন্স" : "Audience"}
                <select
                  value={audience}
                  onChange={(event) => {
                    const next = event.target.value as Audience;
                    if (
                      batchIds.length &&
                      !window.confirm(
                        bn
                          ? "অডিয়েন্স বদলালে নির্বাচিত ব্যাচ মুছে যাবে। চালিয়ে যাবেন?"
                          : "Changing audience will clear selected batches. Continue?",
                      )
                    )
                      return;
                    setAudience(next);
                    setBatchIds([]);
                    setMerit(
                      next === "single_batch"
                        ? "official_only"
                        : "official_and_batch",
                    );
                  }}
                >
                  <option value="single_batch">
                    {bn ? "এক ব্যাচ" : "One batch"}
                  </option>
                  <option value="selected_batches">
                    {bn ? "নির্বাচিত ব্যাচ" : "Selected batches"}
                  </option>
                  <option value="all_course_batches">
                    {bn ? "সব কোর্স ব্যাচ" : "All course batches"}
                  </option>
                </select>
              </label>
            </div>
            <button
              className="button button-primary"
              disabled={busy || !activeCourse}
            >
              {bn ? "অডিয়েন্সে যান" : "Continue to audience"}
            </button>
          </fieldset>
        </form>
      )}
      {step === 2 && (
        <fieldset className="wizard-panel">
          <legend>{bn ? "২. অডিয়েন্স" : "2. Audience"}</legend>
          {audience !== "all_course_batches" && (
            <div className="batch-card-grid">
              {batches?.page.map((row) => {
                const isChecked = batchIds.includes(row._id);
                return (
                  <label
                    key={row._id}
                    className={`batch-card ${isChecked ? "selected" : ""}`}
                  >
                    <input
                      type={audience === "single_batch" ? "radio" : "checkbox"}
                      checked={isChecked}
                      onChange={() =>
                        audience === "single_batch"
                          ? setBatchIds([row._id])
                          : toggleBatch(row._id)
                      }
                    />
                    <span>{bn ? row.nameBn : row.nameEn}</span>
                  </label>
                );
              })}
            </div>
          )}
          {!preview && <p>{bn ? "ব্যাচ বাছুন" : "Select batches"}</p>}
          {preview?.duplicateStudents.length ? (
            <p className="form-message error">
              {bn
                ? "ডুপ্লিকেট এনরোলমেন্ট সমাধান করুন।"
                : "Resolve duplicate enrolments."}
            </p>
          ) : null}
          {preview?.page.length ? (
            <details className="editor-disclosure candidate-preview">
              <summary>
                {bn ? "শিক্ষার্থী বাদ দিন (ঐচ্ছিক)" : "Exclude students (optional)"}
                {Object.keys(exclusions).length > 0 &&
                  ` · ${Object.keys(exclusions).length} ${bn ? "জন বাদ" : "excluded"}`}
              </summary>
              {preview.page.map(({ student }) => {
                const excluded = Object.hasOwn(exclusions, student._id);
                return (
                  <div key={student._id}>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={excluded}
                        onChange={(event) =>
                          setExclusions((current) => {
                            const next = { ...current };
                            if (event.target.checked) next[student._id] = "";
                            else delete next[student._id];
                            return next;
                          })
                        }
                      />
                      <span>
                        {bn ? "বাদ দিন:" : "Exclude:"} {student.studentNumber} ·{" "}
                        {student.displayName}
                      </span>
                    </label>
                    {excluded && (
                      <input
                        aria-label={`${student.displayName} exclusion reason`}
                        value={exclusions[student._id]}
                        required
                        placeholder={
                          bn ? "বাদ দেওয়ার কারণ" : "Exclusion reason"
                        }
                        onChange={(event) =>
                          setExclusions((current) => ({
                            ...current,
                            [student._id]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </details>
          ) : null}
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => setStep(1)}
            >
              {bn ? "পেছনে" : "Back"}
            </button>
            <button
              className="button button-primary"
              disabled={
                !preview ||
                preview.candidateCount < 1 ||
                preview.duplicateStudents.length > 0 ||
                Object.values(exclusions).some((reason) => !reason.trim())
              }
              onClick={() => setStep(3)}
            >
              {bn ? "বিষয়ে যান" : "Continue to subjects"}
            </button>
          </div>
        </fieldset>
      )}
      {step === 3 && (
        <fieldset className="wizard-panel">
          <legend>{bn ? "৩. বিষয় ও নম্বর" : "3. Subjects and marks"}</legend>
          <div className="choice-grid">
            {subjects.page.map((subject) => (
              <label className="check-row" key={subject._id}>
                <input
                  type="checkbox"
                  checked={rules.some((rule) => rule.subjectId === subject._id)}
                  onChange={() => toggleSubject(subject._id)}
                />
                <span>{bn ? subject.nameBn : subject.nameEn}</span>
              </label>
            ))}
          </div>
          <div className="subject-config-list">
            {rules.map((rule, ruleIndex) => {
              const subjectDoc = subjects.page.find((row) => row._id === rule.subjectId);
              const subjectName = subjectDoc ? (bn ? subjectDoc.nameBn : subjectDoc.nameEn) : "—";
              return (
                <div className="subject-config-card" key={rule.subjectId}>
                  <div className="subject-config-header">
                    <span className="subject-config-title">{subjectName}</span>
                    <div className="subject-config-actions">
                      <button
                        className="button button-ghost"
                        type="button"
                        disabled={ruleIndex === 0}
                        aria-label={bn ? "বিষয় উপরে নিন" : "Move subject up"}
                        onClick={() =>
                          setRules((current) => {
                            const next = [...current];
                            [next[ruleIndex - 1], next[ruleIndex]] = [
                              next[ruleIndex],
                              next[ruleIndex - 1],
                            ];
                            return next;
                          })
                        }
                        style={{ minHeight: "auto", padding: "4px 8px" }}
                      >
                        ↑
                      </button>
                      <button
                        className="button button-ghost"
                        type="button"
                        disabled={ruleIndex === rules.length - 1}
                        aria-label={bn ? "বিষয় নিচে নিন" : "Move subject down"}
                        onClick={() =>
                          setRules((current) => {
                            const next = [...current];
                            [next[ruleIndex], next[ruleIndex + 1]] = [
                              next[ruleIndex + 1],
                              next[ruleIndex],
                            ];
                            return next;
                          })
                        }
                        style={{ minHeight: "auto", padding: "4px 8px" }}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <div className="subject-config-grid">
                    <div className="subject-config-field">
                      <label>{bn ? "পরীক্ষার ধরন" : "Format"}</label>
                      <select
                        value={rule.mode}
                        onChange={(event) =>
                          setRules((current) =>
                            current.map((item) =>
                              item.subjectId === rule.subjectId
                                ? { ...item, mode: event.target.value as Mode }
                                : item,
                            ),
                          )
                        }
                        aria-label={`${subjectName} exam format`}
                      >
                        <option value="mcq">MCQ</option>
                        <option value="written">CQ/Written</option>
                        <option value="both">Both</option>
                      </select>
                    </div>
                    {rule.mode !== "written" && (
                      <div className="subject-config-field">
                        <label>MCQ {bn ? "পূর্ণমান" : "Full Marks"}</label>
                        <input
                          type="number"
                          value={rule.mcq}
                          onChange={(event) =>
                            setRules((current) =>
                              current.map((item) =>
                                item.subjectId === rule.subjectId
                                  ? { ...item, mcq: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`${subjectName} MCQ full marks`}
                        />
                      </div>
                    )}
                    {rule.mode !== "mcq" && (
                      <div className="subject-config-field">
                        <label>{bn ? "রচনামূলক পূর্ণমান" : "Written Full Marks"}</label>
                        <input
                          type="number"
                          value={rule.written}
                          onChange={(event) =>
                            setRules((current) =>
                              current.map((item) =>
                                item.subjectId === rule.subjectId
                                  ? { ...item, written: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`${subjectName} written full marks`}
                        />
                      </div>
                    )}
                    <div className="subject-config-field">
                      <label>{bn ? "পাস নম্বর" : "Pass Marks"}</label>
                      <input
                        type="number"
                        value={rule.pass}
                        onChange={(event) =>
                          setRules((current) =>
                            current.map((item) =>
                              item.subjectId === rule.subjectId
                                ? { ...item, pass: Number(event.target.value) }
                                : item,
                            ),
                          )
                        }
                        aria-label={`${subjectName} pass marks`}
                      />
                    </div>
                    {rule.mode !== "written" && (
                      <div className="subject-config-field">
                        <label>MCQ {bn ? "পাস (ঐচ্ছিক)" : "Pass (optional)"}</label>
                        <input
                          type="number"
                          placeholder={bn ? "MCQ পাস" : "MCQ pass"}
                          value={rule.mcqPass}
                          onChange={(event) =>
                            setRules((current) =>
                              current.map((item) =>
                                item.subjectId === rule.subjectId
                                  ? { ...item, mcqPass: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`${subjectName} MCQ component pass marks`}
                        />
                      </div>
                    )}
                    {rule.mode !== "mcq" && (
                      <div className="subject-config-field">
                        <label>CQ {bn ? "পাস (ঐচ্ছিক)" : "Pass (optional)"}</label>
                        <input
                          type="number"
                          placeholder={bn ? "CQ পাস" : "CQ pass"}
                          value={rule.writtenPass}
                          onChange={(event) =>
                            setRules((current) =>
                              current.map((item) =>
                                item.subjectId === rule.subjectId
                                  ? { ...item, writtenPass: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`${subjectName} written component pass marks`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {rules.length > 1 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                setRules((current) => {
                  const source = current[0];
                  return current.map((rule, index) =>
                    index === 0
                      ? rule
                      : {
                          ...rule,
                          mode: source.mode,
                          mcq: source.mcq,
                          written: source.written,
                          pass: source.pass,
                          mcqPass: source.mcqPass,
                          writtenPass: source.writtenPass,
                        },
                  );
                })
              }
            >
              {bn
                ? "প্রথম নিয়ম সব নির্বাচিত বিষয়ে প্রয়োগ"
                : "Apply first rule to all selected subjects"}
            </button>
          )}
          <p>
            {bn ? "মোট পূর্ণমান" : "Grand full marks"}: {totalFull}
          </p>
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => setStep(2)}
            >
              {bn ? "পেছনে" : "Back"}
            </button>
            <button
              className="button button-primary"
              disabled={!rules.length}
              onClick={() => setStep(4)}
            >
              {bn ? "অ্যাসাইনমেন্টে যান" : "Continue to assignments"}
            </button>
          </div>
        </fieldset>
      )}
      {step === 4 && (
        <fieldset className="wizard-panel">
          <legend>{bn ? "৪. শিক্ষক ও মেধা" : "4. Teachers and merit"}</legend>
          {rules.map((rule) => (
            <section className="content-card" key={rule.subjectId}>
              <strong>
                {
                  subjects.page.find((row) => row._id === rule.subjectId)?.[
                    bn ? "nameBn" : "nameEn"
                  ]
                }
              </strong>
              {selectedBatches.length > 1 && (
                <label>
                  {bn ? "অ্যাসাইনমেন্ট পরিধি" : "Assignment scope"}
                  <select
                    value={rule.assignmentMode}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.subjectId === rule.subjectId
                            ? {
                                ...item,
                                assignmentMode: event.target
                                  .value as Rule["assignmentMode"],
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="all">
                      {bn
                        ? "সব ব্যাচে একজন শিক্ষক"
                        : "One teacher for all batches"}
                    </option>
                    <option value="per_batch">
                      {bn ? "ব্যাচভিত্তিক শিক্ষক" : "Teacher per batch"}
                    </option>
                  </select>
                </label>
              )}
              {rule.assignmentMode === "per_batch" &&
              selectedBatches.length > 1 ? (
                selectedBatches.map((batchId) => {
                  const batch = batches?.page.find(
                    (row) => row._id === batchId,
                  );
                  return (
                    <label key={batchId}>
                      {batch ? (bn ? batch.nameBn : batch.nameEn) : batchId}
                      <select
                        value={rule.batchTeachers[batchId] ?? ""}
                        onChange={(event) =>
                          setRules((current) =>
                            current.map((item) =>
                              item.subjectId === rule.subjectId
                                ? {
                                    ...item,
                                    batchTeachers: {
                                      ...item.batchTeachers,
                                      [batchId]: event.target
                                        .value as Id<"teachers">,
                                    },
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">
                          {bn ? "শিক্ষক বাছুন" : "Select teacher"}
                        </option>
                        {teachers.page.map((row) => (
                          <option key={row._id} value={row._id}>
                            {row.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })
              ) : (
                <label>
                  {bn ? "শিক্ষক" : "Teacher"}
                  <select
                    value={rule.teacherId}
                    onChange={(event) =>
                      setRules((current) =>
                        current.map((item) =>
                          item.subjectId === rule.subjectId
                            ? {
                                ...item,
                                teacherId: event.target.value as Id<"teachers">,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">
                      {bn ? "শিক্ষক বাছুন" : "Select teacher"}
                    </option>
                    {teachers.page.map((row) => (
                      <option key={row._id} value={row._id}>
                        {row.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          ))}
          <label>
            {bn ? "মেধা নীতি" : "Merit policy"}
            <select
              value={merit}
              onChange={(event) => setMerit(event.target.value as typeof merit)}
            >
              <option value="official_only">Official only</option>
              {audience !== "single_batch" && (
                <option value="official_and_batch">Official and batch</option>
              )}
              <option value="none">None</option>
            </select>
          </label>
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => setStep(3)}
            >
              {bn ? "পেছনে" : "Back"}
            </button>
            <button
              className="button button-primary"
              disabled={rules.some((rule) =>
                rule.assignmentMode === "per_batch" &&
                selectedBatches.length > 1
                  ? selectedBatches.some(
                      (batchId) => !rule.batchTeachers[batchId],
                    )
                  : !rule.teacherId,
              )}
              onClick={() => setStep(5)}
            >
              {bn ? "পর্যালোচনা" : "Review exam"}
            </button>
          </div>
        </fieldset>
      )}
      {step === 5 && (
        <fieldset className="wizard-panel">
          <legend>{bn ? "৫. নিশ্চিত করুন" : "5. Review and confirm"}</legend>
          <dl className="detail-list">
            <div>
              <dt>{bn ? "প্রার্থী" : "Candidates"}</dt>
              <dd>{preview?.candidateCount ?? 0}</dd>
            </div>
            <div>
              <dt>{bn ? "ব্যাচ" : "Batches"}</dt>
              <dd>{selectedBatches.length}</dd>
            </div>
            <div>
              <dt>{bn ? "বিষয়" : "Subjects"}</dt>
              <dd>{rules.length}</dd>
            </div>
            <div>
              <dt>{bn ? "পূর্ণমান" : "Full marks"}</dt>
              <dd>{totalFull}</dd>
            </div>
            <div>
              <dt>{bn ? "মেধা" : "Merit"}</dt>
              <dd>{merit}</dd>
            </div>
          </dl>
          <p className="warning-panel">
            {bn
              ? "নম্বর এন্ট্রি খোলার পর প্রার্থী তালিকা ও নম্বরের নিয়ম লক হবে।"
              : "The candidate roster and marking rules lock when marks entry opens."}
          </p>
          <div className="form-actions">
            <button
              className="button button-secondary"
              onClick={() => setStep(4)}
            >
              {bn ? "পেছনে" : "Back"}
            </button>
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() => void finish()}
            >
              {bn
                ? "পরীক্ষা তৈরি ও নম্বর এন্ট্রি খুলুন"
                : "Create exam and open marks entry"}
            </button>
          </div>
        </fieldset>
      )}
      {examId && step >= 2 && step <= 5 && (
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() => void saveSetupDraft()}
        >
          {bn ? "খসড়া সংরক্ষণ" : "Save draft"}
        </button>
      )}
    </section>
  );
}
