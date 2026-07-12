"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";
import { AcademicForm } from "./shared/AcademicForm";
import { FeedbackMessage, type Feedback } from "./shared/FeedbackMessage";
import { executeMutation } from "./shared/utils";

const pagination = { numItems: 200, cursor: null } as const;

interface AcademicRecordCreatorProps {
  locale: "bn" | "en";
  onCreationSuccess: (type: "sessions" | "courses" | "batches" | "subjects" | "teachers", id: string) => void;
}

type RecordType = "sessions" | "courses" | "batches" | "subjects" | "teachers";

export function AcademicRecordCreator({ locale, onCreationSuccess }: AcademicRecordCreatorProps) {
  const bn = locale === "bn";
  const [activeType, setActiveType] = useState<RecordType>("sessions");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Queries needed for selectors
  const activeSessions = useQuery(api.academics.sessions.list, { status: "active", paginationOpts: pagination });
  const activeCourses = useQuery(api.academics.options.ownerWorkspace, {});

  // Mutations
  const createSession = useMutation(api.academics.sessions.create);
  const createSubject = useMutation(api.academics.subjects.create);
  const createCourse = useMutation(api.academics.courses.create);
  const createBatch = useMutation(api.academics.batches.create);
  const createTeacher = useMutation(api.academics.teachers.createWithReservedAccount);

  if (!activeSessions || !activeCourses) {
    return <PortalPageState state="loading" locale={locale} />;
  }

  const handleCreateSession = async (data: FormData, form: HTMLFormElement) => {
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));
    const startDate = String(data.get("startDate"));
    const endDate = String(data.get("endDate"));

    setBusy(true);
    try {
      const id = await createSession({ nameBn, nameEn, startDate, endDate, status: "active" });
      form.reset();
      setFeedback({ ok: true, text: bn ? "সেশন তৈরি হয়েছে।" : "Session created." });
      onCreationSuccess("sessions", id);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Error creating session" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSubject = async (data: FormData, form: HTMLFormElement) => {
    const code = String(data.get("code"));
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));

    setBusy(true);
    try {
      const id = await createSubject({ code, nameBn, nameEn });
      form.reset();
      setFeedback({ ok: true, text: bn ? "বিষয় তৈরি হয়েছে।" : "Subject created." });
      onCreationSuccess("subjects", id);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Error creating subject" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCourse = async (data: FormData, form: HTMLFormElement) => {
    const academicSessionId = String(data.get("academicSessionId")) as Id<"academicSessions">;
    const code = String(data.get("code"));
    const slug = String(data.get("slug"));
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));
    const shortDescriptionBn = String(data.get("shortDescriptionBn"));
    const shortDescriptionEn = String(data.get("shortDescriptionEn"));
    const descriptionBn = String(data.get("descriptionBn") || data.get("shortDescriptionBn"));
    const descriptionEn = String(data.get("descriptionEn") || data.get("shortDescriptionEn"));
    const isPublic = data.get("isPublic") === "on";
    const publicSortOrder = Number(data.get("publicSortOrder") || 0);

    setBusy(true);
    try {
      const id = await createCourse({
        academicSessionId,
        code,
        slug,
        nameBn,
        nameEn,
        shortDescriptionBn,
        shortDescriptionEn,
        descriptionBn,
        descriptionEn,
        status: "active",
        isPublic,
        publicSortOrder,
      });
      form.reset();
      setFeedback({ ok: true, text: bn ? "কোর্স তৈরি হয়েছে।" : "Course created." });
      onCreationSuccess("courses", id);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Error creating course" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBatch = async (data: FormData, form: HTMLFormElement) => {
    const courseId = String(data.get("courseId")) as Id<"courses">;
    const code = String(data.get("code"));
    const slug = String(data.get("slug"));
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));
    const roomBn = String(data.get("roomBn")) || undefined;
    const roomEn = String(data.get("roomEn")) || undefined;
    const capacity = Number(data.get("capacity")) || undefined;
    const isPublic = data.get("isPublic") === "on";
    const admissionOpen = data.get("admissionOpen") === "on";
    const publicSortOrder = Number(data.get("publicSortOrder") || 0);

    // Look up academicSessionId from course
    const courseObj = activeCourses.courses.find(c => c.courseId === courseId);
    if (!courseObj) {
      setFeedback({ ok: false, text: bn ? "সেশন খুঁজে পাওয়া যায়নি।" : "Selected course session not found" });
      return;
    }

    setBusy(true);
    try {
      const id = await createBatch({
        academicSessionId: courseObj.academicSessionId,
        courseId,
        code,
        slug,
        nameBn,
        nameEn,
        roomBn,
        roomEn,
        capacity,
        status: "active",
        isPublic,
        admissionOpen,
        publicSortOrder,
      });
      form.reset();
      setFeedback({ ok: true, text: bn ? "ব্যাচ তৈরি হয়েছে।" : "Batch created." });
      onCreationSuccess("batches", id);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Error creating batch" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTeacher = async (data: FormData, form: HTMLFormElement) => {
    const employeeCode = String(data.get("employeeCode"));
    const displayName = String(data.get("displayName"));
    const loginEmail = String(data.get("loginEmail"));
    const phone = String(data.get("phone"));
    const qualificationsBn = String(data.get("qualificationsBn") || "");
    const qualificationsEn = String(data.get("qualificationsEn") || "");
    const bioBn = "";
    const bioEn = "";
    const isPublic = data.get("isPublic") === "on";

    setBusy(true);
    try {
      const result = await createTeacher({
        employeeCode,
        displayName,
        loginEmail,
        phone,
        qualificationsBn,
        qualificationsEn,
        bioBn,
        bioEn,
        status: "active",
        isPublic,
        publicSortOrder: 0,
        locale,
      });
      form.reset();
      setFeedback({ ok: true, text: bn ? "শিক্ষক ও অ্যাকাউন্ট তৈরি হয়েছে।" : "Teacher and portal account created." });
      onCreationSuccess("teachers", result.teacherId);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : "Error creating teacher" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        className="status-filter"
        role="tablist"
        aria-label={bn ? "তৈরি করার টাইপ নির্বাচন" : "Choose creation type"}
        style={{ marginBottom: "20px" }}
      >
        {(["sessions", "courses", "batches", "subjects", "teachers"] as RecordType[]).map((type) => {
          const labels: Record<RecordType, { bn: string; en: string }> = {
            sessions: { bn: "নতুন সেশন", en: "New Session" },
            courses: { bn: "নতুন কোর্স", en: "New Course" },
            batches: { bn: "নতুন ব্যাচ", en: "New Batch" },
            subjects: { bn: "নতুন বিষয়", en: "New Subject" },
            teachers: { bn: "নতুন শিক্ষক", en: "New Teacher" },
          };
          return (
            <button
              key={type}
              role="tab"
              aria-selected={activeType === type}
              onClick={() => {
                setActiveType(type);
                setFeedback(null);
              }}
            >
              {bn ? labels[type].bn : labels[type].en}
            </button>
          );
        })}
      </div>

      <FeedbackMessage value={feedback} />

      <div style={{ marginTop: "12px" }}>
        {activeType === "sessions" && (
          <AcademicForm title={bn ? "নতুন সেশন" : "New Session"} onSubmit={handleCreateSession}>
            <div className="form-grid">
              <label>
                {bn ? "নাম (বাংলা)" : "Name (Bangla)"}
                <input name="nameBn" required />
              </label>
              <label>
                {bn ? "নাম (ইংরেজি)" : "Name (English)"}
                <input name="nameEn" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "শুরুর তারিখ" : "Start Date"}
                <input name="startDate" type="date" required />
              </label>
              <label>
                {bn ? "শেষের তারিখ" : "End Date"}
                <input name="endDate" type="date" required />
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {bn ? "সেশন তৈরি করুন" : "Create Session"}
            </button>
          </AcademicForm>
        )}

        {activeType === "subjects" && (
          <AcademicForm title={bn ? "নতুন বিষয়" : "New Subject"} onSubmit={handleCreateSubject}>
            <div className="form-grid">
              <label>
                {bn ? "কোড" : "Code"}
                <input name="code" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "নাম (বাংলা)" : "Name (Bangla)"}
                <input name="nameBn" required />
              </label>
              <label>
                {bn ? "নাম (ইংরেজি)" : "Name (English)"}
                <input name="nameEn" required />
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {bn ? "বিষয় তৈরি করুন" : "Create Subject"}
            </button>
          </AcademicForm>
        )}

        {activeType === "courses" && (
          <AcademicForm title={bn ? "নতুন কোর্স" : "New Course"} onSubmit={handleCreateCourse}>
            <div className="form-grid">
              <label>
                {bn ? "সেশন" : "Academic Session"}
                <select name="academicSessionId" required defaultValue="">
                  <option value="" disabled>—</option>
                  {activeSessions.page.map((s) => (
                    <option key={s._id} value={s._id}>{bn ? s.nameBn : s.nameEn}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "কোড" : "Code"}
                <input name="code" required />
              </label>
              <label>
                Slug
                <input name="slug" required pattern="[a-z0-9-]+" placeholder="e.g. math-class" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "নাম (বাংলা)" : "Name (Bangla)"}
                <input name="nameBn" required />
              </label>
              <label>
                {bn ? "নাম (ইংরেজি)" : "Name (English)"}
                <input name="nameEn" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "সংক্ষিপ্ত বিবরণ (বাংলা)" : "Short Description (Bangla)"}
                <input name="shortDescriptionBn" required />
              </label>
              <label>
                Short Description (English)
                <input name="shortDescriptionEn" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "বিস্তারিত বর্ণনা (বাংলা - ঐচ্ছিক)" : "Detailed Description (Bangla - Optional)"}
                <textarea name="descriptionBn" rows={3} />
              </label>
              <label>
                Detailed Description (English - Optional)
                <textarea name="descriptionEn" rows={3} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "ক্রম" : "Sort Order"}
                <input name="publicSortOrder" type="number" min={0} defaultValue={0} />
              </label>
              <label className="check-row" style={{ alignSelf: "center" }}>
                <input name="isPublic" type="checkbox" />
                <span>{bn ? "পাবলিক" : "Public"}</span>
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {bn ? "কোর্স তৈরি করুন" : "Create Course"}
            </button>
          </AcademicForm>
        )}

        {activeType === "batches" && (
          <AcademicForm title={bn ? "নতুন ব্যাচ" : "New Batch"} onSubmit={handleCreateBatch}>
            <div className="form-grid">
              <label>
                {bn ? "কোর্স" : "Course"}
                <select name="courseId" required defaultValue="">
                  <option value="" disabled>—</option>
                  {activeCourses.courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>{bn ? c.nameBn : c.nameEn}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "কোড" : "Code"}
                <input name="code" required />
              </label>
              <label>
                Slug
                <input name="slug" required pattern="[a-z0-9-]+" placeholder="e.g. batch-2026" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "নাম (বাংলা)" : "Name (Bangla)"}
                <input name="nameBn" required />
              </label>
              <label>
                {bn ? "নাম (ইংরেজি)" : "Name (English)"}
                <input name="nameEn" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "রুম (বাংলা)" : "Room (Bangla)"}
                <input name="roomBn" />
              </label>
              <label>
                Room (English)
                <input name="roomEn" />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "ধারণক্ষমতা (ঐচ্ছিক)" : "Capacity (Optional)"}
                <input name="capacity" type="number" min={1} />
              </label>
              <label>
                {bn ? "ক্রম" : "Sort Order"}
                <input name="publicSortOrder" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <div className="form-grid" style={{ gap: "10px", padding: "10px 0" }}>
              <label className="check-row">
                <input name="isPublic" type="checkbox" />
                <span>{bn ? "পাবলিক" : "Public"}</span>
              </label>
              <label className="check-row">
                <input name="admissionOpen" type="checkbox" />
                <span>{bn ? "ভর্তি চালু" : "Admission open"}</span>
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {bn ? "ব্যাচ তৈরি করুন" : "Create Batch"}
            </button>
          </AcademicForm>
        )}

        {activeType === "teachers" && (
          <AcademicForm title={bn ? "নতুন শিক্ষক" : "New Teacher"} onSubmit={handleCreateTeacher}>
            <div className="form-grid">
              <label>
                {bn ? "কর্মী কোড" : "Employee Code"}
                <input name="employeeCode" required />
              </label>
              <label>
                {bn ? "প্রদর্শিত নাম" : "Display Name"}
                <input name="displayName" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "Google ইমেইল (লগইন)" : "Google Email (Login)"}
                <input name="loginEmail" type="email" required />
                <span style={{ fontSize: "11px", color: "var(--warning)", display: "block", marginTop: "4px" }}>
                  {bn
                    ? "সতর্কতা: এটি শিক্ষকের পোর্টাল অ্যাকাউন্ট আইডি। এটি একবার তৈরি হলে এবং শিক্ষক তার Clerk আইডি দিয়ে দাবি করার পর পরিবর্তন করা যাবে না।"
                    : "Warning: This creates a reserved portal login credential. It cannot be changed after the teacher claims it."}
                </span>
              </label>
              <label>
                {bn ? "ফোন" : "Phone"}
                <input name="phone" required />
              </label>
            </div>
            <div className="form-grid">
              <label>
                {bn ? "যোগ্যতা (বাংলা)" : "Qualifications (Bangla)"}
                <input name="qualificationsBn" />
              </label>
              <label>
                Qualifications (English)
                <input name="qualificationsEn" />
              </label>
            </div>
            <label className="check-row">
              <input name="isPublic" type="checkbox" />
              <span>{bn ? "পাবলিক প্রোফাইল" : "Public Profile"}</span>
            </label>
            <button className="button button-primary" disabled={busy}>
              {bn ? "শিক্ষক ও অ্যাকাউন্ট তৈরি করুন" : "Create Teacher & Account"}
            </button>
          </AcademicForm>
        )}
      </div>
    </div>
  );
}
