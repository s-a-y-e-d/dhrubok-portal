"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { DirectAdmissionForm } from "./DirectAdmissionForm";

const pagination = { numItems: 100, cursor: null } as const;

export function AdmissionsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const [status, setStatus] = useState<"new" | "under_review">("new");
  const [directAdmission, setDirectAdmission] = useState(false);
  const applications = useQuery(api.admissions.owner.listApplications, { status, paginationOpts: pagination });
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const feePlans = useQuery(api.finance.functions.listFeePlans, {});
  const [selectedId, setSelectedId] = useState<Id<"admissionApplications"> | "">("");
  const detail = useQuery(api.admissions.owner.getApplication, selectedId ? { applicationId: selectedId } : "skip");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [decision, setDecision] = useState<"reject" | "withdraw" | null>(null);
  const review = useMutation(api.admissions.owner.setReviewState);
  const accept = useMutation(api.admissions.owner.acceptApplication);
  const reject = useMutation(api.admissions.owner.rejectApplication);
  const withdraw = useMutation(api.admissions.owner.withdrawApplication);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const batches = useMemo(() => scopes?.batches.filter((batch) => !courseId || batch.courseId === courseId) ?? [], [scopes, courseId]);
  if (!applications || !scopes || !feePlans) return <PortalPageState state="loading" locale={locale} />;

  function choose(applicationId: Id<"admissionApplications">) {
    setSelectedId(applicationId); setFeedback(null); setDecision(null); setCourseId(""); setBatchId("");
  }
  async function execute(work: () => Promise<unknown>) {
    setBusy(true); setFeedback(null);
    try { await work(); setFeedback({ ok: true, text: bn ? "আবেদন আপডেট হয়েছে।" : "Application updated." }); setDecision(null); }
    catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Operation failed" }); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return; const data = new FormData(event.currentTarget);
    const confirmedCourseId = (courseId || detail.requestedCourseId) as Id<"courses">;
    const confirmedBatchId = (batchId || detail.requestedBatchId) as Id<"batches">;
    const initialCharge = Math.round(Number(data.get("initialCharge") || 0) * 100);
    const monthly = String(data.get("agreedMonthly") || ""); const course = String(data.get("agreedCourse") || ""); const feePlanId = String(data.get("feePlanId") || "");
    await execute(() => accept({ applicationId: detail.applicationId, conversionKey: crypto.randomUUID(), studentNumber: String(data.get("studentNumber")), rollNumber: String(data.get("rollNumber") || "") || undefined, admissionDate: String(data.get("admissionDate")), confirmedCourseId, confirmedBatchId, feePlanId: feePlanId ? feePlanId as Id<"feePlans"> : undefined, agreedMonthlyAmountMinor: monthly ? Math.round(Number(monthly) * 100) : undefined, agreedCourseAmountMinor: course ? Math.round(Number(course) * 100) : undefined, internalNote: String(data.get("internalNote") || "") || undefined, discounts: [], initialCharges: initialCharge > 0 ? [{ type: "admission", descriptionBn: "ভর্তি ফি", descriptionEn: "Admission fee", amountMinor: initialCharge, dueDate: String(data.get("admissionDate")) }] : [] }));
  }

  return <><header className="portal-page-header"><p className="eyebrow">{bn ? "ভর্তি ইনবক্স" : "Admission inbox"}</p><h1>{bn ? "আবেদন পর্যালোচনা ও ভর্তি" : "Review and admit applicants"}</h1><p>{bn ? "ডুপ্লিকেট সতর্কতা যাচাই করে এক লেনদেনে শিক্ষার্থী, এনরোলমেন্ট, চার্জ ও সংরক্ষিত পোর্টাল অ্যাকাউন্ট তৈরি করুন।" : "Check duplicate warnings, then create the student, enrolment, charge, and reserved portal account in one transaction."}</p></header>
    <div className="form-actions"><button className="button button-primary" onClick={() => setDirectAdmission(true)}>{bn ? "শিক্ষার্থী যোগ করুন" : "Add student"}</button></div>
    {directAdmission ? <DirectAdmissionForm locale={locale} onCancel={() => setDirectAdmission(false)} /> : <>
    {feedback && <p className={`form-message ${feedback.ok ? "success" : "error"}`} role="status">{feedback.text}</p>}
    <div className="status-filter"><button aria-pressed={status === "new"} onClick={() => setStatus("new")}>{bn ? "নতুন" : "New"}</button><button aria-pressed={status === "under_review"} onClick={() => setStatus("under_review")}>{bn ? "পর্যালোচনায়" : "Under review"}</button></div>
    <div className="master-detail"><section><h2>{bn ? "আবেদন" : "Applications"}</h2>{applications.page.length ? <div className="selection-list">{applications.page.map((application) => <button key={application.applicationId} className={selectedId === application.applicationId ? "selected" : ""} onClick={() => choose(application.applicationId)}><strong>{application.studentDisplayName}</strong><span>{application.applicationNumber} · {application.studentEmail}</span></button>)}</div> : <p className="empty-panel">{bn ? "এই অবস্থায় কোনো আবেদন নেই।" : "No applications in this state."}</p>}</section><section>
      {selectedId && detail === undefined ? <PortalPageState state="loading" locale={locale} /> : detail ? <><div className="detail-title"><div><p className="eyebrow">{detail.applicationNumber}</p><h2>{detail.studentDisplayName}</h2></div><span className="status-pill queued">{detail.status}</span></div><dl className="detail-list"><div><dt>{bn ? "Google ইমেইল" : "Google email"}</dt><dd>{detail.studentEmail}</dd></div><div><dt>{bn ? "অভিভাবক" : "Guardian"}</dt><dd>{detail.guardianName} · {detail.guardianPhone}</dd></div><div><dt>{bn ? "স্কুল/শ্রেণি" : "School/class"}</dt><dd>{detail.schoolCollege} · {detail.currentClass}</dd></div></dl>
        {detail.duplicateCandidates.length > 0 && <div className="warning-panel"><strong>{bn ? "সম্ভাব্য ডুপ্লিকেট" : "Possible duplicates"}</strong><ul>{detail.duplicateCandidates.map((candidate) => <li key={`${candidate.kind}:${candidate.id}`}>{candidate.kind}: {candidate.reference} · {candidate.displayName} · {candidate.status}</li>)}</ul></div>}
        <form className="operation-form compact-form" onSubmit={(event) => void submit(event)}><fieldset><legend>{bn ? "অভ্যন্তরীণ ভর্তি তথ্য" : "Internal admission details"}</legend><div className="form-grid"><label>{bn ? "শিক্ষার্থী আইডি" : "Student ID"}<input name="studentNumber" required placeholder="ST-2026-0001" /></label><label>{bn ? "রোল" : "Roll"}<input name="rollNumber" /></label><label>{bn ? "ভর্তির তারিখ" : "Admission date"}<input name="admissionDate" type="date" required /></label><label>{bn ? "প্রাথমিক ভর্তি ফি (৳)" : "Initial admission fee (BDT)"}<input name="initialCharge" type="number" min="0" step="0.01" defaultValue="0" /></label><label>{bn ? "নিশ্চিত কোর্স" : "Confirmed course"}<select value={courseId || detail.requestedCourseId} onChange={(event) => { setCourseId(event.target.value as Id<"courses">); setBatchId(""); }}>{scopes.courses.map((row) => <option key={row.courseId} value={row.courseId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label><label>{bn ? "নিশ্চিত ব্যাচ" : "Confirmed batch"}<select value={batchId || detail.requestedBatchId} onChange={(event) => setBatchId(event.target.value as Id<"batches">)}>{batches.map((row) => <option key={row.batchId} value={row.batchId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label><label>{bn ? "ফি পরিকল্পনা" : "Fee plan"}<select name="feePlanId"><option value="">—</option>{feePlans.map((row) => <option key={row.feePlanId} value={row.feePlanId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label><label>{bn ? "সম্মত মাসিক (৳)" : "Agreed monthly"}<input name="agreedMonthly" type="number" min="0" step="0.01" /></label><label>{bn ? "সম্মত কোর্স ফি (৳)" : "Agreed course fee"}<input name="agreedCourse" type="number" min="0" step="0.01" /></label></div><label>{bn ? "অভ্যন্তরীণ নোট" : "Internal note"}<textarea name="internalNote" rows={3} /></label></fieldset><div className="form-actions"><button className="button button-primary" disabled={busy}>{bn ? "গ্রহণ ও ভর্তি করুন" : "Accept and admit"}</button><button className="button button-secondary" type="button" disabled={busy} onClick={() => void execute(() => review({ applicationId: detail.applicationId, status: "under_review" }))}>{bn ? "পর্যালোচনায় রাখুন" : "Mark under review"}</button><button className="button button-danger" type="button" disabled={busy} onClick={() => setDecision("reject")}>{bn ? "প্রত্যাখ্যান" : "Reject"}</button><button className="button button-ghost" type="button" disabled={busy} onClick={() => setDecision("withdraw")}>{bn ? "প্রত্যাহার" : "Withdraw"}</button></div></form>
        {decision && <form className="operation-form compact-form" role="alertdialog" aria-labelledby="admission-decision-title" onSubmit={(event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason")); void execute(() => decision === "reject" ? reject({ applicationId: detail.applicationId, reason }) : withdraw({ applicationId: detail.applicationId, reason })); }}><fieldset><legend id="admission-decision-title">{decision === "reject" ? (bn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm rejection") : (bn ? "প্রত্যাহার নিশ্চিত করুন" : "Confirm withdrawal")}</legend><label>{bn ? "কারণ" : "Reason"}<textarea name="reason" required rows={3} /></label><div className="form-actions"><button className="button button-danger" disabled={busy}>{bn ? "নিশ্চিত করুন" : "Confirm"}</button><button className="button button-ghost" type="button" onClick={() => setDecision(null)}>{bn ? "বাতিল" : "Cancel"}</button></div></fieldset></form>}
      </> : <p className="empty-panel">{bn ? "বিস্তারিত দেখতে একটি আবেদন নির্বাচন করুন।" : "Select an application to view details."}</p>}
    </section></div></>}
  </>;
}
