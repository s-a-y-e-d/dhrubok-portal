"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../../PortalPageState";
import { AcademicForm } from "../shared/AcademicForm";
import { ConfirmModal } from "../shared/ConfirmModal";
import { FeedbackMessage, type Feedback } from "../shared/FeedbackMessage";
import { executeMutation } from "../shared/utils";

interface TeacherRecordEditorProps {
  locale: "bn" | "en";
  teacherId: Id<"teachers">;
  onArchiveSuccess?: () => void;
}

export function TeacherRecordEditor({ locale, teacherId, onArchiveSuccess }: TeacherRecordEditorProps) {
  const bn = locale === "bn";
  const result = useQuery(api.academics.teachers.get, { teacherId });
  const update = useMutation(api.academics.teachers.update);
  const archive = useMutation(api.academics.teachers.archive);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);

  if (result === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (result === null) return <PortalPageState state="empty" locale={locale} />;

  const { teacher, accountStatus } = result;
  const isEmailLocked = accountStatus !== "reserved";

  const handleSave = async (data: FormData) => {
    const employeeCode = String(data.get("employeeCode"));
    const displayName = String(data.get("displayName"));
    const nameBn = String(data.get("nameBn")) || undefined;
    const nameEn = String(data.get("nameEn")) || undefined;
    // If email is locked, pass the original value to the mutation
    const loginEmail = isEmailLocked ? teacher.loginEmail : String(data.get("loginEmail"));
    const phone = String(data.get("phone"));
    const qualificationsBn = String(data.get("qualificationsBn") || "");
    const qualificationsEn = String(data.get("qualificationsEn") || "");
    const bioBn = String(data.get("bioBn") || "");
    const bioEn = String(data.get("bioEn") || "");
    const status = String(data.get("status")) as "active" | "inactive";
    const isPublic = data.get("isPublic") === "on";
    const publicSortOrder = Number(data.get("publicSortOrder") || 0);

    await executeMutation(
      () =>
        update({
          teacherId,
          employeeCode,
          displayName,
          nameBn,
          nameEn,
          loginEmail,
          phone,
          qualificationsBn,
          qualificationsEn,
          bioBn,
          bioEn,
          status,
          isPublic,
          publicSortOrder,
          photoStorageId: teacher.photoStorageId,
          joinedAt: teacher.joinedAt,
        }),
      setBusy,
      setFeedback,
      bn ? "শিক্ষকের প্রোফাইল সংরক্ষিত হয়েছে।" : "Teacher profile saved.",
      bn
    );
  };

  const handleArchive = async () => {
    setConfirming(false);
    const ok = await executeMutation(
      () => archive({ teacherId }),
      setBusy,
      setFeedback,
      bn ? "শিক্ষক আর্কাইভ হয়েছে।" : "Teacher archived.",
      bn
    );
    if (ok && onArchiveSuccess) {
      onArchiveSuccess();
    }
  };

  return (
    <>
      <AcademicForm
        title={bn ? "শিক্ষকের বিবরণ সম্পাদনা" : "Edit teacher details"}
        onSubmit={(data) => void handleSave(data)}
      >
        <div className="form-grid">
          <label>
            {bn ? "কর্মী কোড" : "Employee Code"}
            <input name="employeeCode" defaultValue={teacher.employeeCode} required />
          </label>
          <label>
            {bn ? "প্রদর্শিত নাম" : "Display Name"}
            <input name="displayName" defaultValue={teacher.displayName} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "বাংলা নাম" : "Bangla Name"}
            <input name="nameBn" defaultValue={teacher.nameBn || ""} />
          </label>
          <label>
            {bn ? "ইংরেজি নাম" : "English Name"}
            <input name="nameEn" defaultValue={teacher.nameEn || ""} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "Google ইমেইল (লগইন আইডি)" : "Google Email (Login ID)"}
            <input
              name="loginEmail"
              type="email"
              defaultValue={teacher.loginEmail}
              disabled={isEmailLocked}
              required
            />
            {isEmailLocked ? (
              <span style={{ fontSize: "11px", color: "var(--ink-mute)", display: "block", marginTop: "4px" }}>
                {bn
                  ? "আইডিটি দাবি করা হয়েছে, তাই ইমেইল পরিবর্তন করা যাবে না।"
                  : "Account has been claimed; login email is locked."}
              </span>
            ) : (
              <span style={{ fontSize: "11px", color: "var(--warning)", display: "block", marginTop: "4px" }}>
                {bn
                  ? "গুরুত্বপূর্ণ: এই ইমেইলটি পোর্টালে প্রবেশের জন্য ব্যবহৃত হবে।"
                  : "Important: This email acts as the portal login credential."}
              </span>
            )}
          </label>
          <label>
            {bn ? "ফোন" : "Phone"}
            <input name="phone" defaultValue={teacher.phone} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "যোগ্যতা (বাংলা)" : "Qualifications (Bangla)"}
            <textarea name="qualificationsBn" defaultValue={teacher.qualificationsBn} rows={3} />
          </label>
          <label>
            {bn ? "যোগ্যতা (ইংরেজি)" : "Qualifications (English)"}
            <textarea name="qualificationsEn" defaultValue={teacher.qualificationsEn} rows={3} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "জীবনী (বাংলা)" : "Bio (Bangla)"}
            <textarea name="bioBn" defaultValue={teacher.bioBn} rows={3} />
          </label>
          <label>
            {bn ? "জীবনী (ইংরেজি)" : "Bio (English)"}
            <textarea name="bioEn" defaultValue={teacher.bioEn} rows={3} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "অবস্থা" : "Status"}
            <select name="status" defaultValue={teacher.status}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label>
            {bn ? "ক্রম" : "Sort Order"}
            <input name="publicSortOrder" type="number" min={0} defaultValue={teacher.publicSortOrder} />
          </label>
        </div>
        <label className="check-row">
          <input name="isPublic" type="checkbox" defaultChecked={teacher.isPublic} />
          <span>{bn ? "পাবলিক প্রোফাইল" : "Public profile"}</span>
        </label>

        <FeedbackMessage value={feedback} />
        <div className="form-actions">
          <button className="button button-primary" disabled={busy}>
            {bn ? "সংরক্ষণ" : "Save"}
          </button>
          <button
            className="button button-tertiary"
            type="button"
            onClick={() => setConfirming(true)}
          >
            {bn ? "আর্কাইভ" : "Archive"}
          </button>
        </div>
      </AcademicForm>

      {confirming && (
        <ConfirmModal
          title={bn ? "শিক্ষক আর্কাইভ করবেন?" : "Archive teacher?"}
          detail={
            bn
              ? "সক্রিয় অ্যাসাইনমেন্ট বা সাপ্তাহিক রুটিন থাকলে সিস্টেম এটি প্রত্যাখ্যান করবে এবং পোর্টাল অ্যাকাউন্টও বাতিল হয়ে যাবে।"
              : "The backend will reject archiving if assignments or schedules are active. Portal access will also be revoked."
          }
          danger
          locale={locale}
          onCancel={() => setConfirming(false)}
          onConfirm={handleArchive}
        />
      )}
    </>
  );
}
