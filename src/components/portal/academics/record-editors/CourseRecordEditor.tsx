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

interface CourseRecordEditorProps {
  locale: "bn" | "en";
  courseId: Id<"courses">;
  onArchiveSuccess?: () => void;
}

export function CourseRecordEditor({ locale, courseId, onArchiveSuccess }: CourseRecordEditorProps) {
  const bn = locale === "bn";
  const row = useQuery(api.academics.courses.get, { courseId });
  const update = useMutation(api.academics.courses.update);
  const archive = useMutation(api.academics.courses.archive);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);

  if (row === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (row === null) return <PortalPageState state="empty" locale={locale} />;

  const handleSave = async (data: FormData) => {
    const code = String(data.get("code"));
    const slug = String(data.get("slug"));
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));
    const shortDescriptionBn = String(data.get("shortDescriptionBn"));
    const shortDescriptionEn = String(data.get("shortDescriptionEn"));
    const descriptionBn = String(data.get("descriptionBn"));
    const descriptionEn = String(data.get("descriptionEn"));
    const status = String(data.get("status")) as "draft" | "active" | "completed";
    const isPublic = data.get("isPublic") === "on";
    const publicSortOrder = Number(data.get("publicSortOrder") || 0);

    await executeMutation(
      () =>
        update({
          courseId,
          academicSessionId: row.academicSessionId,
          code,
          slug,
          nameBn,
          nameEn,
          shortDescriptionBn,
          shortDescriptionEn,
          descriptionBn,
          descriptionEn,
          status,
          isPublic,
          publicSortOrder,
          coverStorageId: row.coverStorageId,
        }),
      setBusy,
      setFeedback,
      bn ? "কোর্স সংরক্ষিত হয়েছে।" : "Course saved.",
      bn
    );
  };

  const handleArchive = async () => {
    setConfirming(false);
    const ok = await executeMutation(
      () => archive({ courseId }),
      setBusy,
      setFeedback,
      bn ? "কোর্স আর্কাইভ হয়েছে।" : "Course archived.",
      bn
    );
    if (ok && onArchiveSuccess) {
      onArchiveSuccess();
    }
  };

  return (
    <>
      <AcademicForm
        title={bn ? "কোর্সের বিবরণ সম্পাদনা" : "Edit course details"}
        onSubmit={(data) => void handleSave(data)}
      >
        <div className="form-grid">
          <label>
            {bn ? "কোড" : "Code"}
            <input name="code" defaultValue={row.code} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={row.slug} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "নাম (বাংলা)" : "Name (Bangla)"}
            <input name="nameBn" defaultValue={row.nameBn} required />
          </label>
          <label>
            {bn ? "নাম (ইংরেজি)" : "Name (English)"}
            <input name="nameEn" defaultValue={row.nameEn} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "সংক্ষিপ্ত বিবরণ (বাংলা)" : "Short description (Bangla)"}
            <input name="shortDescriptionBn" defaultValue={row.shortDescriptionBn} />
          </label>
          <label>
            {bn ? "সংক্ষিপ্ত বিবরণ (ইংরেজি)" : "Short description (English)"}
            <input name="shortDescriptionEn" defaultValue={row.shortDescriptionEn} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "বিস্তারিত বর্ণনা (বাংলা)" : "Detailed description (Bangla)"}
            <textarea name="descriptionBn" defaultValue={row.descriptionBn} rows={4} />
          </label>
          <label>
            {bn ? "বিস্তারিত বর্ণনা (ইংরেজি)" : "Detailed description (English)"}
            <textarea name="descriptionEn" defaultValue={row.descriptionEn} rows={4} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "অবস্থা" : "Status"}
            <select name="status" defaultValue={row.status}>
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
            </select>
          </label>
          <label>
            {bn ? "ক্রম" : "Sort Order"}
            <input name="publicSortOrder" type="number" min={0} defaultValue={row.publicSortOrder} />
          </label>
        </div>
        <label className="check-row">
          <input name="isPublic" type="checkbox" defaultChecked={row.isPublic} />
          <span>{bn ? "পাবলিক" : "Public"}</span>
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
          title={bn ? "কোর্স আর্কাইভ করবেন?" : "Archive course?"}
          detail={
            bn
              ? "সক্রিয় বা আর্কাইভ না হওয়া ব্যাচ থাকলে সিস্টেম এটি প্রত্যাখ্যান করবে।"
              : "The backend will reject archiving this course if active, planned, or completed batches exist."
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
