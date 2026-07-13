"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { PortalPageState } from "./PortalPageState";

export function DirectAdmissionForm({ locale, onCancel }: { locale: "bn" | "en"; onCancel: () => void }) {
  const bn = locale === "bn";
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const plans = useQuery(api.finance.functions.listFeePlans, {});
  const create = useMutation(api.admissions.owner.createDirectAdmission);
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const batches = useMemo(() => scopes?.batches.filter((row) => row.courseId === courseId) ?? [], [scopes, courseId]);
  if (!scopes || !plans) return <PortalPageState state="loading" locale={locale} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!courseId || !batchId) return;
    const form = event.currentTarget; const data = new FormData(form);
    const opt = (key: string) => String(data.get(key) || "").trim() || undefined;
    const minor = (key: string) => { const value = opt(key); return value ? Math.round(Number(value) * 100) : undefined; };
    setBusy(true); setMessage(null);
    try {
      await create({
        studentNumber: String(data.get("studentNumber")), rollNumber: opt("rollNumber"), admissionDate: String(data.get("admissionDate")),
        studentDisplayName: String(data.get("studentDisplayName")), studentNameBn: opt("studentNameBn"), studentNameEn: opt("studentNameEn"), studentEmail: String(data.get("studentEmail")),
        studentPhone: opt("studentPhone"), dateOfBirth: opt("dateOfBirth"), gender: opt("gender"), schoolCollege: String(data.get("schoolCollege")), currentClass: String(data.get("currentClass")), address: opt("address"),
        guardianName: String(data.get("guardianName")), guardianPhone: String(data.get("guardianPhone")), guardianRelationship: String(data.get("guardianRelationship")), alternateGuardianPhone: opt("alternateGuardianPhone"),
        motherName: String(data.get("motherName")), motherPhone: String(data.get("motherPhone")),
        preferredSmsLocale: data.get("preferredSmsLocale") === "en" ? "en" : "bn", courseId, batchId, feePlanId: opt("feePlanId") as Id<"feePlans"> | undefined,
        agreedMonthlyAmountMinor: minor("agreedMonthly"), agreedCourseAmountMinor: minor("agreedCourse"), initialAdmissionFeeMinor: minor("initialAdmissionFee"), internalNote: opt("internalNote"),
      });
      form.reset(); setCourseId(""); setBatchId(""); setMessage({ ok: true, text: bn ? "শিক্ষার্থী সফলভাবে ভর্তি হয়েছে।" : "Student admitted successfully." });
    } catch (cause) { setMessage({ ok: false, text: cause instanceof Error ? cause.message : "Could not admit student" }); }
    finally { setBusy(false); }
  }

  const field = (label: string, name: string, required = false, type = "text") => <label>{label}<input name={name} type={type} required={required} /></label>;
  return <section><div className="detail-title"><div><p className="eyebrow">{bn ? "সরাসরি ভর্তি" : "Direct admission"}</p><h2>{bn ? "নতুন শিক্ষার্থী যোগ করুন" : "Add a new student"}</h2></div></div>
    <p>{bn ? "কোনো পাবলিক আবেদন ছাড়াই শিক্ষার্থী ও তার এনরোলমেন্ট তৈরি করুন।" : "Create a student and enrolment without a public application."}</p>
    {message && <p className={`form-message ${message.ok ? "success" : "error"}`} role="status">{message.text}</p>}
    <form className="operation-form compact-form" onSubmit={(event) => void submit(event)}>
      <fieldset><legend>{bn ? "শিক্ষার্থীর তথ্য" : "Student details"}</legend><div className="form-grid">
        {field(bn ? "শিক্ষার্থী আইডি" : "Student ID", "studentNumber", true)}{field(bn ? "রোল" : "Roll", "rollNumber")}{field(bn ? "পুরো নাম" : "Full name", "studentDisplayName", true)}
        {field(bn ? "বাংলা নাম" : "Name in Bangla", "studentNameBn")}{field(bn ? "ইংরেজি নাম" : "Name in English", "studentNameEn")}{field(bn ? "Google ইমেইল" : "Google email", "studentEmail", true, "email")}
        {field(bn ? "শিক্ষার্থীর ফোন" : "Student phone", "studentPhone", false, "tel")}{field(bn ? "জন্মতারিখ" : "Date of birth", "dateOfBirth", false, "date")}
        <label>{bn ? "লিঙ্গ" : "Gender"}<select name="gender"><option value="">—</option><option value="male">{bn ? "পুরুষ" : "Male"}</option><option value="female">{bn ? "নারী" : "Female"}</option><option value="other">{bn ? "অন্যান্য" : "Other"}</option></select></label>
        {field(bn ? "স্কুল/কলেজ" : "School or college", "schoolCollege", true)}{field(bn ? "বর্তমান শ্রেণি" : "Current class", "currentClass", true)}{field(bn ? "ভর্তির তারিখ" : "Admission date", "admissionDate", true, "date")}
      </div><label>{bn ? "ঠিকানা" : "Address"}<textarea name="address" rows={2} /></label></fieldset>
      <fieldset><legend>{bn ? "অভিভাবকের তথ্য" : "Guardian details"}</legend><div className="form-grid">
        {field(bn ? "বাবার নাম" : "Father's name", "guardianName", true)}{field(bn ? "বাবার ফোন" : "Father's phone", "guardianPhone", true, "tel")}<input name="guardianRelationship" type="hidden" value="father" />{field(bn ? "মায়ের নাম" : "Mother's name", "motherName", true)}{field(bn ? "মায়ের ফোন" : "Mother's phone", "motherPhone", true, "tel")}
        <label>{bn ? "SMS ভাষা" : "SMS language"}<select name="preferredSmsLocale" defaultValue="bn"><option value="bn">বাংলা</option><option value="en">English</option></select></label>
      </div></fieldset>
      <fieldset><legend>{bn ? "কোর্স ও ফি" : "Course and fees"}</legend><div className="form-grid">
        <label>{bn ? "কোর্স" : "Course"}<select required value={courseId} onChange={(event) => { setCourseId(event.target.value as Id<"courses"> | ""); setBatchId(""); }}><option value="">—</option>{scopes.courses.map((row) => <option key={row.courseId} value={row.courseId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label>
        <label>{bn ? "ব্যাচ" : "Batch"}<select required value={batchId} onChange={(event) => setBatchId(event.target.value as Id<"batches"> | "")}><option value="">—</option>{batches.map((row) => <option key={row.batchId} value={row.batchId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label>
        <label>{bn ? "ফি পরিকল্পনা" : "Fee plan"}<select name="feePlanId"><option value="">—</option>{plans.filter((row) => (!row.courseId || row.courseId === courseId) && (!row.batchId || row.batchId === batchId)).map((row) => <option key={row.feePlanId} value={row.feePlanId}>{bn ? row.nameBn : row.nameEn}</option>)}</select></label>
        {field(bn ? "ভর্তি ফি (৳)" : "Admission fee (BDT)", "initialAdmissionFee", false, "number")}{field(bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)", "agreedMonthly", false, "number")}{field(bn ? "সম্মত কোর্স ফি (৳)" : "Agreed course fee (BDT)", "agreedCourse", false, "number")}
      </div><label>{bn ? "অভ্যন্তরীণ নোট" : "Internal note"}<textarea name="internalNote" rows={3} /></label></fieldset>
      <div className="form-actions"><button className="button button-primary" disabled={busy || !courseId || !batchId}>{busy ? (bn ? "ভর্তি হচ্ছে…" : "Admitting…") : (bn ? "শিক্ষার্থী ভর্তি করুন" : "Admit student")}</button><button className="button button-ghost" type="button" onClick={onCancel}>{bn ? "আবেদনে ফিরুন" : "Back to applications"}</button></div>
    </form></section>;
}
