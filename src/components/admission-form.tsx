"use client";

import Script from "next/script";
import { useAction, useQuery } from "convex/react";
import { useRef, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

declare global { interface Window { turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void } } }

export function AdmissionForm({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn"; const courses = useQuery(api.admissions.public.listOpenCourses); const preparation = useQuery(api.admissions.public.getPreparation);
  const [courseId, setCourseId] = useState<Id<"courses"> | "">(""); const batches = useQuery(api.admissions.public.listOpenBatches, courseId ? { courseId } : "skip");
  const submit = useAction(api.admissions.actions.submit); const [token, setToken] = useState(""); const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null); const [busy, setBusy] = useState(false);
  const submissionKey = useRef(crypto.randomUUID()); const turnstileBox = useRef<HTMLDivElement>(null); const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderTurnstile = () => { if (!siteKey || !window.turnstile || !turnstileBox.current || widgetId.current) return; widgetId.current = window.turnstile.render(turnstileBox.current, { sitekey: siteKey, action: "admission_submit", callback: (value: string) => setToken(value), "expired-callback": () => setToken(""), "error-callback": () => setToken("") }); };
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null); if (!courseId || !token) { setMessage({ kind: "error", text: bn ? "কোর্স, ব্যাচ ও নিরাপত্তা যাচাই সম্পন্ন করুন।" : "Complete course, batch, and security verification." }); return; }
    const form = event.currentTarget; const data = new FormData(form); setBusy(true);
    try {
      const result = await submit({
        submissionKey: submissionKey.current, turnstileToken: token, honeypot: String(data.get("website") || ""), locale,
        studentDisplayName: String(data.get("studentDisplayName") || ""), studentEmail: String(data.get("studentEmail") || ""), studentPhone: String(data.get("studentPhone") || "") || undefined,
        schoolCollege: String(data.get("schoolCollege") || ""), currentClass: String(data.get("currentClass") || ""), guardianName: String(data.get("guardianName") || ""), guardianPhone: String(data.get("guardianPhone") || ""),
        guardianRelationship: String(data.get("guardianRelationship") || ""), preferredSmsLocale: String(data.get("preferredSmsLocale")) === "en" ? "en" : "bn", requestedCourseId: courseId,
        motherName: String(data.get("motherName") || ""), motherPhone: String(data.get("motherPhone") || ""),
        requestedBatchId: String(data.get("batchId")) as Id<"batches">, applicantNote: String(data.get("applicantNote") || "") || undefined,
      });
      setMessage({ kind: "success", text: `${bn ? "আবেদন গ্রহণ করা হয়েছে। রেফারেন্স" : "Application received. Reference"}: ${result.applicationNumber}` });
      submissionKey.current = crypto.randomUUID(); form.reset(); setCourseId(""); setToken(""); if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    } catch (cause) { setMessage({ kind: "error", text: cause instanceof Error ? cause.message : (bn ? "আবেদন পাঠানো যায়নি।" : "Could not submit the application.") }); }
    finally { setBusy(false); }
  }

  if (preparation && !preparation.admissionsOpen) return <p className="empty-panel">{bn ? "অনলাইন ভর্তি আবেদন বর্তমানে বন্ধ আছে।" : "Online admission applications are currently closed."}</p>;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderTurnstile} onReady={renderTurnstile} /><form className="operation-form" onSubmit={onSubmit}>
    <fieldset><legend>{bn ? "শিক্ষার্থীর তথ্য" : "Student information"}</legend><div className="form-grid"><label>{bn ? "শিক্ষার্থীর নাম" : "Student name"}<input name="studentDisplayName" required maxLength={120} /></label><label>{bn ? "Google ইমেইল" : "Google email"}<input name="studentEmail" type="email" required maxLength={254} /></label><label>{bn ? "শিক্ষার্থীর ফোন (ঐচ্ছিক)" : "Student phone (optional)"}<input name="studentPhone" inputMode="tel" /></label><label>{bn ? "স্কুল/কলেজ" : "School/college"}<input name="schoolCollege" required maxLength={160} /></label><label>{bn ? "বর্তমান শ্রেণি" : "Current class"}<input name="currentClass" required maxLength={80} /></label></div></fieldset>
    <fieldset><legend>{bn ? "বাবা ও মায়ের তথ্য" : "Father and mother information"}</legend><div className="form-grid"><label>{bn ? "বাবার নাম" : "Father's name"}<input name="guardianName" required maxLength={120} /></label><label>{bn ? "বাবার মোবাইল নম্বর" : "Father's mobile number"}<input name="guardianPhone" required inputMode="tel" /></label><input name="guardianRelationship" type="hidden" value="father" /><label>{bn ? "মায়ের নাম" : "Mother's name"}<input name="motherName" required maxLength={120} /></label><label>{bn ? "মায়ের মোবাইল নম্বর" : "Mother's mobile number"}<input name="motherPhone" required inputMode="tel" /></label><label>{bn ? "SMS ভাষা" : "SMS language"}<select name="preferredSmsLocale" defaultValue={locale}><option value="bn">বাংলা</option><option value="en">English</option></select></label></div></fieldset>
    <fieldset><legend>{bn ? "কোর্স ও ব্যাচ" : "Course and batch"}</legend><div className="form-grid"><label>{bn ? "কোর্স" : "Course"}<select required value={courseId} onChange={(event) => setCourseId(event.target.value as Id<"courses"> || "")}><option value="">{bn ? "কোর্স নির্বাচন করুন" : "Select a course"}</option>{courses?.map((course) => <option value={course.courseId} key={course.courseId}>{bn ? course.nameBn : course.nameEn}</option>)}</select></label><label>{bn ? "ব্যাচ" : "Batch"}<select name="batchId" required disabled={!courseId}><option value="">{bn ? "ব্যাচ নির্বাচন করুন" : "Select a batch"}</option>{batches?.map((batch) => <option value={batch.batchId} key={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</option>)}</select></label></div><label>{bn ? "অতিরিক্ত তথ্য (ঐচ্ছিক)" : "Additional note (optional)"}<textarea name="applicantNote" maxLength={1000} rows={4} /></label></fieldset>
    <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    <label className="check-row"><input type="checkbox" required /> <span>{bn ? "আমি প্রদত্ত তথ্য প্রক্রিয়াকরণ এবং ভর্তি-সংক্রান্ত যোগাযোগে সম্মতি দিচ্ছি।" : "I consent to processing this information and admission-related communication."}</span></label>
    {siteKey ? <div ref={turnstileBox} className="turnstile-box" /> : <p className="form-message error">{bn ? "নিরাপত্তা যাচাই কনফিগার করা নেই।" : "Security verification is not configured."}</p>}
    {message && <p className={`form-message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</p>}
    <button className="button button-primary" type="submit" disabled={busy || !token}>{busy ? (bn ? "পাঠানো হচ্ছে…" : "Submitting…") : (bn ? "আবেদন পাঠান" : "Submit application")}</button>
  </form></>;
}
