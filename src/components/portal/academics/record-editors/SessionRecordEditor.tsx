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

interface SessionRecordEditorProps {
  locale: "bn" | "en";
  sessionId: Id<"academicSessions">;
  onArchiveSuccess?: () => void;
}

export function SessionRecordEditor({ locale, sessionId, onArchiveSuccess }: SessionRecordEditorProps) {
  const bn = locale === "bn";
  const row = useQuery(api.academics.sessions.get, { sessionId });
  const update = useMutation(api.academics.sessions.update);
  const archive = useMutation(api.academics.sessions.archive);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);

  if (row === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (row === null) return <PortalPageState state="empty" locale={locale} />;

  const handleSave = async (data: FormData) => {
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));
    const startDate = String(data.get("startDate"));
    const endDate = String(data.get("endDate"));
    const status = String(data.get("status")) as "planned" | "active" | "completed";

    await executeMutation(
      () => update({ sessionId, nameBn, nameEn, startDate, endDate, status }),
      setBusy,
      setFeedback,
      bn ? "সেশন সংরক্ষিত হয়েছে।" : "Session saved.",
      bn
    );
  };

  const handleArchive = async () => {
    setConfirming(false);
    const ok = await executeMutation(
      () => archive({ sessionId }),
      setBusy,
      setFeedback,
      bn ? "সেশন আর্কাইভ হয়েছে।" : "Session archived.",
      bn
    );
    if (ok && onArchiveSuccess) {
      onArchiveSuccess();
    }
  };

  return (
    <>
      <AcademicForm
        title={bn ? "সেশনের বিবরণ সম্পাদনা" : "Edit session details"}
        onSubmit={(data) => void handleSave(data)}
      >
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
            {bn ? "শুরুর তারিখ" : "Start Date"}
            <input name="startDate" type="date" defaultValue={row.startDate} required />
          </label>
          <label>
            {bn ? "শেষের তারিখ" : "End Date"}
            <input name="endDate" type="date" defaultValue={row.endDate} required />
          </label>
        </div>
        <label>
          {bn ? "অবস্থা" : "Status"}
          <select name="status" defaultValue={row.status}>
            <option value="planned">planned</option>
            <option value="active">active</option>
            <option value="completed">completed</option>
          </select>
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
          title={bn ? "সেশন আর্কাইভ করবেন?" : "Archive academic session?"}
          detail={
            bn
              ? "সক্রিয় বা অসম্পূর্ণ কোর্স বা ব্যাচ থাকলে সিস্টেম এটি প্রত্যাখ্যান করবে।"
              : "The backend will reject archiving if active/planned courses or batches exist in this session."
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
