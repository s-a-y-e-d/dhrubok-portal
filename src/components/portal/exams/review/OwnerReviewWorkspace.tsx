"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../../PortalPageState";
import { DialogModal } from "../../DialogModal";

export function OwnerReviewWorkspace({
  locale,
  examId,
}: {
  locale: "bn" | "en";
  examId: Id<"exams">;
}) {
  const bn = locale === "bn";
  const summary = useQuery(api.exams.review.summary, { examId });
  const progress = useQuery(api.exams.review.progress, { examId });
  const history = useQuery(api.exams.publication.history, { examId });
  const preview = useQuery(
    api.exams.publication.preview,
    summary?.exam.status === "ready_for_review" ? { examId } : "skip",
  );
  const meritList = useQuery(
    api.exams.publication.prePublicationMeritList,
    summary?.exam.status === "ready_for_review" ? { examId } : "skip",
  );
  const ready = useMutation(api.exams.review.markReadyForPublication);
  const publish = useMutation(api.exams.publication.publish);
  const reopen = useMutation(api.exams.publication.reopen);
  const archive = useMutation(api.exams.exams.archiveDraft);
  const returnAssignment = useMutation(api.exams.marks.returnAssignment);
  const [confirm, setConfirm] = useState(false);
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnAssignmentId, setReturnAssignmentId] =
    useState<Id<"examTeacherAssignments"> | null>(null);
  const [exceptionFilter, setExceptionFilter] = useState<
    "failures" | "absences" | "changed"
  >("failures");
  const [previewStudentId, setPreviewStudentId] =
    useState<Id<"students"> | null>(null);
  const exceptions = useQuery(api.exams.review.exceptions, {
    examId,
    filter: exceptionFilter,
  });
  const studentPreview = useQuery(
    api.exams.review.individualPreview,
    previewStudentId ? { examId, studentId: previewStudentId } : "skip",
  );
  if (!summary || !progress || !history)
    return <PortalPageState state="loading" locale={locale} />;
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage(bn ? "পরীক্ষা আপডেট হয়েছে।" : "Exam updated.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="exam-review-workspace">
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <div className="metric-grid exam-review-metrics">
        <article className="metric-card">
          <p>{bn ? "প্রার্থী" : "Candidates"}</p>
          <strong>{summary.candidateCount}</strong>
        </article>
        <article
          className={`metric-card ${summary.contactProblemCount ? "warning" : ""}`}
        >
          <p>
            {bn
              ? "SMS প্রাপক / যোগাযোগ সমস্যা"
              : "SMS recipients / contact issues"}
          </p>
          <strong>
            {summary.guardianRecipientCount} / {summary.contactProblemCount}
          </strong>
        </article>
        <article className={`metric-card ${summary.missing ? "danger" : ""}`}>
          <p>{bn ? "অসম্পূর্ণ" : "Missing"}</p>
          <strong>{summary.missing}</strong>
        </article>
        <article className="metric-card">
          <p>{bn ? "পাস / ফেল" : "Pass / fail"}</p>
          <strong>
            {summary.passed} / {summary.failed}
          </strong>
        </article>
      </div>
      <div className="table-wrap review-progress-table">
        <table>
          <thead>
            <tr>
              <th>{bn ? "বিষয়" : "Subject"}</th>
              <th>{bn ? "ব্যাচ" : "Batch"}</th>
              <th>{bn ? "শিক্ষক" : "Teacher"}</th>
              <th>{bn ? "সম্পূর্ণ" : "Complete"}</th>
              <th>{bn ? "অসম্পূর্ণ" : "Missing"}</th>
              <th>{bn ? "অবস্থা" : "State"}</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((row) => (
              <tr key={row.assignment._id}>
                <td>
                  {row.subjectDoc
                    ? row.subjectDoc.nameEn
                    : "—"}
                </td>
                <td>
                  {row.batch
                    ? bn
                      ? row.batch.nameBn
                      : row.batch.nameEn
                    : bn
                      ? "সব ব্যাচ"
                      : "All batches"}
                </td>
                <td>{row.teacher?.displayName ?? "—"}</td>
                <td>{row.complete}</td>
                <td>{row.missing}</td>
                <td>
                  {row.assignment.status}
                  {row.assignment.status === "submitted" && (
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => setReturnAssignmentId(row.assignment._id)}
                    >
                      {bn ? "ফেরত" : "Return"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="editor-disclosure review-section">
        <h3>{bn ? "পর্যালোচনার ব্যতিক্রম" : "Review exceptions"}</h3>
        <div
          className="status-filter"
          role="group"
          aria-label={bn ? "ব্যতিক্রম ফিল্টার" : "Exception filters"}
        >
          {(
            [
              "failures",
              "absences",
              "changed",
            ] as const
          ).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={exceptionFilter === filter}
              onClick={() => setExceptionFilter(filter)}
            >
              {filter.replace("_", " / ")}
            </button>
          ))}
        </div>
        {!exceptions ? (
          <PortalPageState state="loading" locale={locale} />
        ) : exceptions.length ? (
          <div className="selection-list">
            {exceptions.map((row) => (
              <button
                key={row.candidate._id}
                type="button"
                onClick={() => setPreviewStudentId(row.student._id)}
              >
                <strong>{row.student.displayName}</strong>
                <span>
                  {row.student.studentNumber} ·{" "}
                  {row.aggregate.grandTotalScaled / 100}/
                  {row.aggregate.grandFullMarksScaled / 100} ·{" "}
                  {row.aggregate.passed ? "Pass" : "Fail"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-panel">
            {bn
              ? "এই ফিল্টারে কোনো ব্যতিক্রম নেই।"
              : "No exceptions for this filter."}
          </p>
        )}
      </section>
      {summary.exam.status === "ready_for_review" && (
        <section className="editor-disclosure review-section">
          <h3>{bn ? "সরকারি মেধাতালিকা" : "Official merit list"}</h3>
          <p className="form-hint">
            {bn
              ? "প্রকাশের সময় SMS-এ যে সরকারি মেধাস্থান পাঠানো হবে।"
              : "The official merit position that will be sent in each result SMS when published."}
          </p>
          {!meritList ? (
            <PortalPageState state="loading" locale={locale} />
          ) : !meritList.meritEnabled ? (
            <p className="empty-panel">
              {bn
                ? "এই পরীক্ষার জন্য মেধাস্থান চালু নেই।"
                : "Merit positions are not enabled for this exam."}
            </p>
          ) : !meritList.rows.length ? (
            <p className="empty-panel">
              {bn
                ? "মেধাতালিকার জন্য কোনো যোগ্য শিক্ষার্থী নেই।"
                : "No students are eligible for the merit list."}
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{bn ? "মেধাস্থান" : "Position"}</th>
                    <th>{bn ? "শিক্ষার্থী" : "Student"}</th>
                    <th>{bn ? "নম্বর" : "Score"}</th>
                    <th>{bn ? "ফল" : "Result"}</th>
                  </tr>
                </thead>
                <tbody>
                  {meritList.rows.map((row) => (
                    <tr key={row.studentId}>
                      <td>{row.position}</td>
                      <td>
                        {row.studentName}
                        {row.studentNumber && ` · ${row.studentNumber}`}
                      </td>
                      <td>
                        {row.totalScoreScaled / 100} / {row.fullMarksScaled / 100}
                      </td>
                      <td>{row.passed ? (bn ? "পাস" : "Pass") : bn ? "ফেল" : "Fail"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <DialogModal
        isOpen={previewStudentId !== null && studentPreview !== undefined}
        onClose={() => setPreviewStudentId(null)}
        title={studentPreview?.student.displayName ?? ""}
        size="form"
      >
        {studentPreview && (
          <>
            <p style={{ marginBottom: "16px", color: "var(--ink-mute)" }}>
              {studentPreview.student.studentNumber} ·{" "}
              {studentPreview.aggregate
                ? `${studentPreview.aggregate.grandTotalScaled / 100}/${studentPreview.aggregate.grandFullMarksScaled / 100}`
                : bn
                  ? "অসম্পূর্ণ"
                  : "Incomplete"}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{bn ? "বিষয়" : "Subject"}</th>
                    <th>MCQ</th>
                    <th>CQ</th>
                    <th>{bn ? "মোট" : "Total"}</th>
                    <th>{bn ? "ফল" : "Result"}</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPreview.rows.map((row) => {
                    const subject = studentPreview.subjectDetails.find(
                      (item) => item.subject._id === row.examSubjectId,
                    )?.subjectDoc;
                    return (
                      <tr key={row._id}>
                        <td>
                          {subject ? subject.nameEn : "—"}
                        </td>
                        <td>
                          {row.mcqScoreScaled === undefined
                            ? "—"
                            : row.mcqScoreScaled / 100}
                        </td>
                        <td>
                          {row.writtenScoreScaled === undefined
                            ? "—"
                            : row.writtenScoreScaled / 100}
                        </td>
                        <td>
                          {row.totalScoreScaled === undefined
                            ? "—"
                            : row.totalScoreScaled / 100}
                        </td>
                        <td>
                          {row.passed === undefined
                            ? "—"
                            : row.passed
                              ? "Pass"
                              : "Fail"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setPreviewStudentId(null)}
              >
                {bn ? "বন্ধ" : "Close"}
              </button>
            </div>
          </>
        )}
      </DialogModal>
      <div className="form-actions exam-actions review-actions">
        {summary.exam.status === "draft" && (
          <button
            className="button button-danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  bn ? "এই খসড়া আর্কাইভ করবেন?" : "Archive this draft?",
                )
              )
                void run(() => archive({ examId }));
            }}
          >
            {bn ? "খসড়া আর্কাইভ" : "Archive draft"}
          </button>
        )}
        {(summary.exam.status === "marks_entry" ||
          summary.exam.status === "reopened") && (
          <button
            className="button button-secondary"
            disabled={busy || !summary.ready}
            onClick={() => void run(() => ready({ examId }))}
          >
            {bn ? "প্রকাশের জন্য প্রস্তুত" : "Mark ready for publication"}
          </button>
        )}
        {summary.exam.status === "ready_for_review" && (
          <button
            className="button button-primary"
            onClick={() => setConfirm(true)}
          >
            {bn ? "প্রকাশনা পর্যালোচনা" : "Review publication"}
          </button>
        )}
        {summary.exam.status === "published" && (
          <form
            className="compact-inline"
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(
                new FormData(event.currentTarget).get("reason"),
              );
              void run(() => reopen({ examId, reason }));
            }}
          >
            <input
              name="reason"
              required
              placeholder={bn ? "সংশোধনের কারণ" : "Correction reason"}
            />
            <button className="button button-danger" disabled={busy}>
              {bn ? "পুনরায় খুলুন" : "Reopen"}
            </button>
          </form>
        )}
      </div>
      {history.publications.length > 0 && (
        <details className="editor-disclosure review-section">
          <summary>
            {bn
              ? "প্রকাশনা ও সংশোধন ইতিহাস"
              : "Publication and correction history"}
          </summary>
          <ol className="clean-list">
            {history.publications.map((row) => (
              <li key={row._id}>
                <strong>
                  v{row.version} · {row.status}
                </strong>
                <span>
                  {new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Dhaka",
                  }).format(row.publishedAt)}
                  {row.reopenReason
                    ? ` · ${bn ? "পুনরায় খোলার কারণ" : "Reopen reason"}: ${row.reopenReason}`
                    : ""}
                </span>
              </li>
            ))}
          </ol>
          <p>
            {bn ? "ফলাফল SMS" : "Result SMS"}: {history.smsMessages.length} ·{" "}
            {bn ? "ব্যর্থ" : "Failed"}:{" "}
            {
              history.smsMessages.filter((row) => row.status === "failed")
                .length
            }
          </p>
          <ol className="clean-list">
            {history.events.map((event) => (
              <li key={event._id}>
                <strong>{event.eventType.replaceAll("_", " ")}</strong>
                <span>
                  {event.reason ?? ""} ·{" "}
                  {new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Dhaka",
                  }).format(event.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
      <DialogModal
        isOpen={confirm && preview !== undefined}
        onClose={() => setConfirm(false)}
        title={bn ? "প্রকাশনা নিশ্চিত করুন" : "Confirm publication"}
        size="complex"
      >
        {preview && (
          <div className="publication-panel exam-publication-panel">
            <dl className="detail-list">
              <div>
                <dt>{bn ? "সংস্করণ" : "Version"}</dt>
                <dd>v{preview.publicationVersion}</dd>
              </div>
              <div>
                <dt>{bn ? "ফল" : "Results"}</dt>
                <dd>{preview.candidateCount}</dd>
              </div>
              <div>
                <dt>{bn ? "পাস / ফেল / অনুপস্থিত" : "Pass / fail / absent"}</dt>
                <dd>
                  {preview.passCount} / {preview.failCount} /{" "}
                  {preview.absentCount}
                </dd>
              </div>
              <div>
                <dt>{bn ? "SMS প্রাপক" : "SMS recipients"}</dt>
                <dd>{preview.recipientCount}</dd>
              </div>
              <div>
                <dt>{bn ? "বাদ পড়া যোগাযোগ" : "Skipped contacts"}</dt>
                <dd>{preview.skippedContacts.length}</dd>
              </div>
              <div>
                <dt>
                  {bn
                    ? "আনুমানিক SMS অংশ (বাংলা / ইংরেজি)"
                    : "Estimated SMS segments (BN / EN)"}
                </dt>
                <dd>
                  {preview.estimatedSegmentsBn} / {preview.estimatedSegmentsEn}
                </dd>
              </div>
              <div>
                <dt>{bn ? "মেধার জনসংখ্যা" : "Merit population"}</dt>
                <dd>{preview.officialPopulation}</dd>
              </div>
            </dl>
            {preview.willQueueSms && <>
            <p className="sms-preview" lang="bn" style={{ marginBottom: "8px" }}>
              {preview.sampleBn}
            </p>
            <p className="sms-preview" lang="en" style={{ marginBottom: "16px" }}>
              {preview.sampleEn}
            </p>
            </>}
            <label className="check-row" style={{ marginBottom: "16px" }}>
              <input
                type="checkbox"
                checked={ack}
                onChange={(event) => setAck(event.target.checked)}
              />
              <span>
                {preview.willQueueSms
                  ? bn
                    ? "আমি বুঝেছি শিক্ষার্থীরা ফল দেখবে এবং অভিভাবক SMS কিউ হবে।"
                    : "I understand students will see these results and guardian SMS will be queued."
                  : bn
                    ? "আমি বুঝেছি শিক্ষার্থীরা ফল দেখবে, কিন্তু SMS সেটিং বন্ধ থাকায় কোনো অভিভাবক SMS পাঠানো হবে না।"
                    : "I understand students will see these results, but no guardian SMS will be sent while result SMS is disabled."}
              </span>
            </label>
            <div className="form-actions" style={{ justifyContent: "flex-end" }}>
              <button
                className="button button-secondary"
                onClick={() => setConfirm(false)}
              >
                {bn ? "বাতিল" : "Cancel"}
              </button>
              <button
                className="button button-primary"
                disabled={busy || !ack}
                onClick={() =>
                  void run(() => publish({ examId, acknowledged: ack })).then(
                    () => setConfirm(false),
                  )
                }
              >
                {bn
                  ? `${preview.candidateCount} ফল প্রকাশ ও ${preview.recipientCount} SMS কিউ`
                  : preview.willQueueSms
                    ? `Publish ${preview.candidateCount} results and queue ${preview.recipientCount} SMS`
                    : `Publish ${preview.candidateCount} results`}
              </button>
            </div>
          </div>
        )}
      </DialogModal>

      <DialogModal
        isOpen={returnAssignmentId !== null}
        onClose={() => setReturnAssignmentId(null)}
        title={bn ? "অ্যাসাইনমেন্ট ফেরত দিন" : "Return assignment"}
        size="standard"
      >
        <form
          className="operation-form compact-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!returnAssignmentId) return;
            const reason = String(
              new FormData(event.currentTarget).get("reason"),
            );
            void run(() =>
              returnAssignment({
                assignmentId: returnAssignmentId,
                reason,
              }),
            ).then(() => setReturnAssignmentId(null));
          }}
        >
          <label>
            {bn ? "ফেরতের কারণ" : "Return reason"}
            <input
              name="reason"
              required
              aria-label={bn ? "ফেরতের কারণ" : "Return reason"}
              placeholder={bn ? "ফেরতের কারণ লিখুন..." : "Enter return reason..."}
            />
          </label>
          <div className="form-actions" style={{ justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setReturnAssignmentId(null)}
            >
              {bn ? "বাতিল" : "Cancel"}
            </button>
            <button className="button button-danger" disabled={busy}>
              {bn ? "ফেরত" : "Return"}
            </button>
          </div>
        </form>
      </DialogModal>
    </section>
  );
}
