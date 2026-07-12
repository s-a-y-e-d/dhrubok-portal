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

interface SubjectRecordEditorProps {
  locale: "bn" | "en";
  subjectId: Id<"subjects">;
  onArchiveSuccess?: () => void;
}

export function SubjectRecordEditor({ locale, subjectId, onArchiveSuccess }: SubjectRecordEditorProps) {
  const bn = locale === "bn";
  const row = useQuery(api.academics.subjects.get, { subjectId });
  const update = useMutation(api.academics.subjects.update);
  const archive = useMutation(api.academics.subjects.archive);

  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);

  if (row === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (row === null) return <PortalPageState state="empty" locale={locale} />;

  const handleSave = async (data: FormData) => {
    const code = String(data.get("code"));
    const nameBn = String(data.get("nameBn"));
    const nameEn = String(data.get("nameEn"));

    await executeMutation(
      () => update({ subjectId, code, nameBn, nameEn }),
      setBusy,
      setFeedback,
      bn ? "বিষয় সংরক্ষিত হয়েছে।" : "Subject saved.",
      bn
    );
  };

  const handleArchive = async () => {
    setConfirming(false);
    const ok = await executeMutation(
      () => archive({ subjectId }),
      setBusy,
      setFeedback,
      bn ? "বিষয় আর্কাইভ হয়েছে।" : "Subject archived.",
      bn
    );
    if (ok && onArchiveSuccess) {
      onArchiveSuccess();
    }
  };

  return (
    <>
      <AcademicForm
        title={bn ? "বিষয়ের বিবরণ সম্পাদনা" : "Edit subject details"}
        onSubmit={(data) => void handleSave(data)}
      >
        <div className="form-grid">
          <label>
            {bn ? "কোড" : "Code"}
            <input name="code" defaultValue={row.code} required />
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
          title={bn ? "বিষয় আর্কাইভ করবেন?" : "Archive subject?"}
          detail={
            bn
              ? "কোনো কোর্সের সাথে যুক্ত থাকলে বিষয়টি আর্কাইভ করা যাবে না।"
              : "The backend will reject archiving if this subject is currently linked to any course."
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
