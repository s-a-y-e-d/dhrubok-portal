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

interface BatchRecordEditorProps {
  locale: "bn" | "en";
  batchId: Id<"batches">;
  onArchiveSuccess?: () => void;
}

export function BatchRecordEditor({ locale, batchId, onArchiveSuccess }: BatchRecordEditorProps) {
  const bn = locale === "bn";
  const row = useQuery(api.academics.batches.get, { batchId });
  const update = useMutation(api.academics.batches.update);
  const archive = useMutation(api.academics.batches.archive);

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
    const roomBn = String(data.get("roomBn")) || undefined;
    const roomEn = String(data.get("roomEn")) || undefined;
    const startDate = String(data.get("startDate")) || undefined;
    const endDate = String(data.get("endDate")) || undefined;
    const capacity = Number(data.get("capacity")) || undefined;
    const status = String(data.get("status")) as "planned" | "active" | "completed";
    const admissionOpen = data.get("admissionOpen") === "on";
    const isPublic = data.get("isPublic") === "on";
    const publicSortOrder = Number(data.get("publicSortOrder") || 0);

    await executeMutation(
      () =>
        update({
          batchId,
          academicSessionId: row.academicSessionId,
          courseId: row.courseId,
          code,
          slug,
          nameBn,
          nameEn,
          roomBn,
          roomEn,
          startDate,
          endDate,
          capacity,
          status,
          admissionOpen,
          isPublic,
          publicSortOrder,
        }),
      setBusy,
      setFeedback,
      bn ? "ব্যাচ সংরক্ষিত হয়েছে।" : "Batch saved.",
      bn
    );
  };

  const handleArchive = async () => {
    setConfirming(false);
    const ok = await executeMutation(
      () => archive({ batchId }),
      setBusy,
      setFeedback,
      bn ? "ব্যাচ আর্কাইভ হয়েছে।" : "Batch archived.",
      bn
    );
    if (ok && onArchiveSuccess) {
      onArchiveSuccess();
    }
  };

  return (
    <>
      <AcademicForm
        title={bn ? "ব্যাচের বিবরণ সম্পাদনা" : "Edit batch details"}
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
            {bn ? "রুম (বাংলা)" : "Room (Bangla)"}
            <input name="roomBn" defaultValue={row.roomBn} />
          </label>
          <label>
            Room (English)
            <input name="roomEn" defaultValue={row.roomEn} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "শুরু" : "Start Date"}
            <input name="startDate" type="date" defaultValue={row.startDate} />
          </label>
          <label>
            {bn ? "শেষ" : "End Date"}
            <input name="endDate" type="date" defaultValue={row.endDate} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "ধারণক্ষমতা" : "Capacity"}
            <input name="capacity" type="number" min={1} defaultValue={row.capacity} />
          </label>
          <label>
            {bn ? "অবস্থা" : "Status"}
            <select name="status" defaultValue={row.status}>
              <option value="planned">planned</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            {bn ? "ক্রম" : "Sort Order"}
            <input name="publicSortOrder" type="number" min={0} defaultValue={row.publicSortOrder} />
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center" }}>
            <label className="check-row">
              <input name="admissionOpen" type="checkbox" defaultChecked={row.admissionOpen} />
              <span>{bn ? "ভর্তি চালু" : "Admission open"}</span>
            </label>
            <label className="check-row">
              <input name="isPublic" type="checkbox" defaultChecked={row.isPublic} />
              <span>{bn ? "পাবলিক" : "Public"}</span>
            </label>
          </div>
        </div>
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
          title={bn ? "ব্যাচ আর্কাইভ করবেন?" : "Archive batch?"}
          detail={
            bn
              ? "সক্রিয় শিক্ষক অ্যাসাইনমেন্ট, রুটিন বা শিক্ষার্থী ভর্তি থাকলে সিস্টেম এটি প্রত্যাখ্যান করবে।"
              : "The backend will reject archiving if assignments, routines, or student enrolments are active for this batch."
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
