"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";

export function ContentEditor({
  locale,
  role,
}: {
  locale: "bn" | "en";
  role: "owner" | "teacher";
}) {
  const bn = locale === "bn";
  const ownerScopes = useQuery(
    api.academics.options.contentScopes,
    role === "owner" ? {} : "skip",
  );
  const teacherScopes = useQuery(
    api.academics.readModels.teacherAssignedBatches,
    role === "teacher" ? {} : "skip",
  );
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const notices = useQuery(api.notices.functions.listManaged, { status });
  const createNotice = useMutation(api.notices.functions.create);
  const publishNotice = useMutation(api.notices.functions.publish);
  const [previewId, setPreviewId] = useState<Id<"notices"> | "">("");
  const preview = useQuery(
    api.notices.functions.previewSms,
    previewId ? { noticeId: previewId } : "skip",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const courses =
    role === "owner"
      ? (ownerScopes?.courses ?? [])
      : [
          ...new Map(
            (teacherScopes ?? []).map((scope) => [
              scope.courseId,
              {
                courseId: scope.courseId,
                nameBn: scope.courseNameBn,
                nameEn: scope.courseNameEn,
              },
            ]),
          ).values(),
        ];
  const batches =
    role === "owner"
      ? (ownerScopes?.batches ?? [])
      : (teacherScopes ?? []).map((scope) => ({
          batchId: scope.batchId,
          courseId: scope.courseId,
          nameBn: scope.nameBn,
          nameEn: scope.nameEn,
        }));

  if (
    (role === "owner" && ownerScopes === undefined) ||
    (role === "teacher" && teacherScopes === undefined)
  ) {
    return <PortalPageState state="loading" locale={locale} />;
  }

  async function execute(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage(success);
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Operation failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const audienceType = data.get("audienceType") as
      | "public"
      | "all_students"
      | "course"
      | "batch";
    const sendSms = data.get("sendSms") === "on";
    await execute(async () => {
      await createNotice({
        titleBn: String(data.get("titleBn")),
        titleEn: String(data.get("titleEn")),
        bodyBn: String(data.get("bodyBn")),
        bodyEn: String(data.get("bodyEn")),
        audienceType,
        courseId:
          audienceType === "course"
            ? (String(data.get("courseId")) as Id<"courses">)
            : undefined,
        batchId:
          audienceType === "batch"
            ? (String(data.get("batchId")) as Id<"batches">)
            : undefined,
        sendSms,
        publish: !sendSms && data.get("publish") === "on",
        confirmSms: false,
      });
      form.reset();
    }, bn ? "নোটিশ সংরক্ষিত হয়েছে।" : "Notice saved.");
  }

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "যোগাযোগ" : "Communication"}</p>
        <h1>{bn ? "নোটিশ ও SMS" : "Notices and SMS"}</h1>
        <p>
          {bn
            ? "শিক্ষক শুধু নির্ধারিত ব্যাচে নোটিশ প্রকাশ করতে পারেন; SMS নোটিশে সঠিক প্রাপক সংখ্যা প্রিভিউ করে নিশ্চিত করতে হবে।"
            : "Teachers can publish only to assigned batches; SMS notices require an exact recipient preview confirmation."}
        </p>
      </header>

      {message && (
        <p className="form-message success" role="status">
          {message}
        </p>
      )}

      <details className="editor-disclosure">
        <summary>{bn ? "নোটিশ তৈরি করুন" : "Create notice"}</summary>
        <form
          className="operation-form"
          onSubmit={(event) => void submitNotice(event)}
        >
          <fieldset>
            <legend>{bn ? "প্রাপক" : "Audience"}</legend>
            <div className="form-grid">
              <label>
                {bn ? "ধরন" : "Type"}
                <select
                  name="audienceType"
                  defaultValue={role === "teacher" ? "batch" : "public"}
                >
                  {role === "owner" && (
                    <>
                      <option value="public">Public</option>
                      <option value="all_students">All students</option>
                      <option value="course">Course</option>
                    </>
                  )}
                  <option value="batch">Batch</option>
                </select>
              </label>
              <label>
                {bn ? "কোর্স" : "Course"}
                <select name="courseId">
                  {courses.map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {bn ? course.nameBn : course.nameEn}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {bn ? "ব্যাচ" : "Batch"}
                <select name="batchId">
                  {batches.map((batch) => (
                    <option key={batch.batchId} value={batch.batchId}>
                      {bn ? batch.nameBn : batch.nameEn}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>{bn ? "বিষয়বস্তু" : "Content"}</legend>
            <div className="form-grid">
              <label>
                বাংলা শিরোনাম
                <input name="titleBn" required />
              </label>
              <label>
                English title
                <input name="titleEn" required />
              </label>
              <label>
                বাংলা বার্তা
                <textarea name="bodyBn" rows={6} required />
              </label>
              <label>
                English message
                <textarea name="bodyEn" rows={6} required />
              </label>
            </div>
          </fieldset>
          {role === "owner" && (
            <label className="check-row">
              <input name="sendSms" type="checkbox" />
              <span>{bn ? "অভিভাবককে SMS পাঠান" : "Send guardian SMS"}</span>
            </label>
          )}
          <label className="check-row">
            <input name="publish" type="checkbox" />
            <span>
              {bn
                ? "এখনই প্রকাশ করুন (SMS ছাড়া)"
                : "Publish now (without SMS)"}
            </span>
          </label>
          <button className="button button-primary" disabled={busy}>
            {bn ? "সংরক্ষণ" : "Save"}
          </button>
        </form>
      </details>

      <div className="status-filter">
        <button
          onClick={() => setStatus("draft")}
          aria-pressed={status === "draft"}
        >
          {bn ? "খসড়া" : "Drafts"}
        </button>
        <button
          onClick={() => setStatus("published")}
          aria-pressed={status === "published"}
        >
          {bn ? "প্রকাশিত" : "Published"}
        </button>
      </div>

      {notices === undefined ? (
        <PortalPageState state="loading" locale={locale} />
      ) : (
        <div className="notice-list">
          {notices.map((notice) => (
            <article key={notice._id}>
              <p className="meta-line">
                {notice.audienceType} · {notice.status}
              </p>
              <h2>{bn ? notice.titleBn : notice.titleEn}</h2>
              <p>{bn ? notice.bodyBn : notice.bodyEn}</p>
              {notice.status === "draft" && (
                <>
                  <div className="form-actions">
                    {notice.sendSms && role === "owner" ? (
                      <button
                        className="button button-secondary"
                        aria-expanded={previewId === notice._id}
                        onClick={() => setPreviewId(notice._id)}
                      >
                        {bn ? "SMS প্রিভিউ" : "SMS preview"}
                      </button>
                    ) : (
                      <button
                        className="button button-primary"
                        disabled={busy}
                        onClick={() =>
                          void execute(
                            () =>
                              publishNotice({
                                noticeId: notice._id,
                                confirmSms: false,
                              }),
                            bn ? "প্রকাশিত হয়েছে।" : "Published.",
                          )
                        }
                      >
                        {bn ? "প্রকাশ" : "Publish"}
                      </button>
                    )}
                  </div>
                  {previewId === notice._id && preview && (
                    <section
                      className="operation-form compact-form"
                      role="alertdialog"
                      aria-labelledby={`notice-sms-title-${notice._id}`}
                      aria-describedby={`notice-sms-detail-${notice._id}`}
                    >
                      <h3 id={`notice-sms-title-${notice._id}`}>
                        {bn
                          ? "SMS সহ নোটিশ প্রকাশ নিশ্চিত করুন"
                          : "Confirm notice publication with SMS"}
                      </h3>
                      <p id={`notice-sms-detail-${notice._id}`}>
                        <strong>{preview.recipientCount}</strong>{" "}
                        {bn
                          ? "জন শিক্ষার্থীর অভিভাবক প্রাপক। প্রকাশ করলে এই প্রাপক তালিকা স্থির হবে এবং SMS কিউ হবে।"
                          : "students have guardian recipients. Publishing freezes this recipient list and queues the SMS messages."}
                      </p>
                      <p>
                        {bn ? "বাংলা" : "Bangla"}: {preview.bangla.characterCount}{" "}
                        {bn ? "অক্ষর" : "characters"} · {preview.bangla.segmentCount}{" "}
                        {bn ? "সেগমেন্ট" : "segments"}
                      </p>
                      <p>
                        English: {preview.english.characterCount} characters ·{" "}
                        {preview.english.segmentCount} segments
                      </p>
                      {!preview.enabled && (
                        <p className="form-message error">
                          {bn
                            ? "SMS বর্তমানে নিষ্ক্রিয়; প্রকাশ করা যাবে না।"
                            : "SMS is currently disabled; publication cannot continue."}
                        </p>
                      )}
                      <div className="form-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => setPreviewId("")}
                        >
                          {bn ? "বাতিল" : "Cancel"}
                        </button>
                        <button
                          className="button button-primary"
                          type="button"
                          disabled={busy || !preview.enabled}
                          onClick={() => {
                            void execute(
                              () =>
                                publishNotice({
                                  noticeId: notice._id,
                                  confirmSms: true,
                                  expectedSmsRecipientCount:
                                    preview.recipientCount,
                                }),
                              bn
                                ? "প্রকাশ ও SMS কিউ হয়েছে।"
                                : "Published and SMS queued.",
                            ).then((ok) => {
                              if (ok) setPreviewId("");
                            });
                          }}
                        >
                          {preview.recipientCount}{" "}
                          {bn ? "শিক্ষার্থীর জন্য প্রকাশ" : "students — publish"}
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
