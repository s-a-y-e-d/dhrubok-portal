"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PortalPageState } from "./PortalPageState";

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({ label, name, required = false, type = "text", description }: { label: string; name: string; required?: boolean; type?: string; description?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`direct-${name}`}>{label}</FieldLabel>
      <Input id={`direct-${name}`} name={name} type={type} required={required} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

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
    event.preventDefault();
    if (!courseId || !batchId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const opt = (key: string) => String(data.get(key) || "").trim() || undefined;
    const minor = (key: string) => {
      const value = opt(key);
      return value ? Math.round(Number(value) * 100) : undefined;
    };
    setBusy(true);
    setMessage(null);
    try {
      await create({
        studentNumber: String(data.get("studentNumber")), admissionDate: String(data.get("admissionDate")),
        studentDisplayName: String(data.get("studentDisplayName")), studentNameBn: opt("studentNameBn"), studentNameEn: opt("studentNameEn"), studentEmail: String(data.get("studentEmail")),
        studentPhone: opt("studentPhone"), dateOfBirth: opt("dateOfBirth"), gender: opt("gender"), schoolCollege: String(data.get("schoolCollege")), currentClass: String(data.get("currentClass")), address: opt("address"),
        guardianName: String(data.get("guardianName")), guardianPhone: String(data.get("guardianPhone")), guardianRelationship: "father", alternateGuardianPhone: opt("alternateGuardianPhone"),
        motherName: String(data.get("motherName")), motherPhone: String(data.get("motherPhone")),
        preferredSmsLocale: data.get("preferredSmsLocale") === "en" ? "en" : "bn", courseId, batchId, feePlanId: opt("feePlanId") as Id<"feePlans"> | undefined,
        agreedMonthlyAmountMinor: minor("agreedMonthly"), initialAdmissionFeeMinor: minor("initialAdmissionFee"), internalNote: opt("internalNote"),
      });
      form.reset();
      setCourseId("");
      setBatchId("");
      setMessage({ ok: true, text: bn ? "শিক্ষার্থী সফলভাবে ভর্তি হয়েছে।" : "Student admitted successfully." });
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof Error ? cause.message : "Could not admit student" });
    } finally {
      setBusy(false);
    }
  }

  const filteredPlans = plans.filter((row) => (!row.courseId || row.courseId === courseId) && (!row.batchId || row.batchId === batchId));

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void submit(event)}>
      {message ? (
        <Alert variant={message.ok ? "default" : "destructive"} role={message.ok ? "status" : "alert"}>
          {message.ok ? <CheckCircle2 /> : <CircleAlert />}
          <AlertTitle>{message.ok ? (bn ? "ভর্তি সম্পন্ন" : "Admission complete") : (bn ? "ভর্তি সম্পন্ন হয়নি" : "Admission failed")}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection title={bn ? "শিক্ষার্থীর তথ্য" : "Student details"} description={bn ? "পরিচয়, যোগাযোগ ও বর্তমান শিক্ষাপ্রতিষ্ঠানের তথ্য।" : "Identity, contact, and current institution details."}>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <TextField label={bn ? "শিক্ষার্থী আইডি" : "Student ID"} name="studentNumber" required />
          <TextField label={bn ? "পুরো নাম" : "Full name"} name="studentDisplayName" required />
          <TextField label={bn ? "বাংলা নাম" : "Name in Bangla"} name="studentNameBn" />
          <TextField label={bn ? "ইংরেজি নাম" : "Name in English"} name="studentNameEn" />
          <TextField label={bn ? "Google ইমেইল" : "Google email"} name="studentEmail" required type="email" />
          <TextField label={bn ? "শিক্ষার্থীর ফোন" : "Student phone"} name="studentPhone" type="tel" />
          <TextField label={bn ? "জন্মতারিখ" : "Date of birth"} name="dateOfBirth" type="date" />
          <Field>
            <FieldLabel htmlFor="direct-gender">{bn ? "লিঙ্গ" : "Gender"}</FieldLabel>
            <Select name="gender">
              <SelectTrigger id="direct-gender"><SelectValue placeholder={bn ? "নির্বাচন করুন" : "Select"} /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="male">{bn ? "পুরুষ" : "Male"}</SelectItem><SelectItem value="female">{bn ? "নারী" : "Female"}</SelectItem><SelectItem value="other">{bn ? "অন্যান্য" : "Other"}</SelectItem></SelectGroup></SelectContent>
            </Select>
          </Field>
          <TextField label={bn ? "স্কুল বা কলেজ" : "School or college"} name="schoolCollege" required />
          <TextField label={bn ? "বর্তমান শ্রেণি" : "Current class"} name="currentClass" required />
          <TextField label={bn ? "ভর্তির তারিখ" : "Admission date"} name="admissionDate" required type="date" />
          <Field className="md:col-span-2"><FieldLabel htmlFor="direct-address">{bn ? "ঠিকানা" : "Address"}</FieldLabel><Textarea id="direct-address" name="address" rows={2} /></Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title={bn ? "অভিভাবকের তথ্য" : "Guardian details"} description={bn ? "বাবা ও মায়ের যোগাযোগের তথ্য এবং SMS ভাষা।" : "Father and mother contact details and SMS language."}>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <TextField label={bn ? "বাবার নাম" : "Father's name"} name="guardianName" required />
          <TextField label={bn ? "বাবার ফোন" : "Father's phone"} name="guardianPhone" required type="tel" />
          <TextField label={bn ? "মায়ের নাম" : "Mother's name"} name="motherName" required />
          <TextField label={bn ? "মায়ের ফোন" : "Mother's phone"} name="motherPhone" required type="tel" />
          <Field>
            <FieldLabel htmlFor="direct-sms-locale">{bn ? "SMS ভাষা" : "SMS language"}</FieldLabel>
            <Select name="preferredSmsLocale" defaultValue="bn">
              <SelectTrigger id="direct-sms-locale"><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="bn">বাংলা</SelectItem><SelectItem value="en">English</SelectItem></SelectGroup></SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection title={bn ? "কোর্স ও ফি" : "Course and fees"} description={bn ? "এনরোলমেন্ট, ফি পরিকল্পনা এবং প্রাথমিক চার্জ নির্ধারণ করুন।" : "Set the enrolment, fee plan, and initial charges."}>
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="direct-course">{bn ? "কোর্স" : "Course"}</FieldLabel>
            <Select required value={courseId} onValueChange={(value) => { setCourseId(value as Id<"courses">); setBatchId(""); }}>
              <SelectTrigger id="direct-course"><SelectValue placeholder={bn ? "কোর্স নির্বাচন করুন" : "Select a course"} /></SelectTrigger>
              <SelectContent><SelectGroup>{scopes.courses.map((row) => <SelectItem key={row.courseId} value={row.courseId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field data-disabled={!courseId}>
            <FieldLabel htmlFor="direct-batch">{bn ? "ব্যাচ" : "Batch"}</FieldLabel>
            <Select required disabled={!courseId} value={batchId} onValueChange={(value) => setBatchId(value as Id<"batches">)}>
              <SelectTrigger id="direct-batch"><SelectValue placeholder={bn ? "ব্যাচ নির্বাচন করুন" : "Select a batch"} /></SelectTrigger>
              <SelectContent><SelectGroup>{batches.map((row) => <SelectItem key={row.batchId} value={row.batchId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="direct-fee-plan">{bn ? "ফি পরিকল্পনা" : "Fee plan"}</FieldLabel>
            <Select name="feePlanId" disabled={!courseId || !batchId}>
              <SelectTrigger id="direct-fee-plan"><SelectValue placeholder={bn ? "ঐচ্ছিক" : "Optional"} /></SelectTrigger>
              <SelectContent><SelectGroup>{filteredPlans.map((row) => <SelectItem key={row.feePlanId} value={row.feePlanId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </Field>
          <TextField label={bn ? "ভর্তি ফি (৳)" : "Admission fee (BDT)"} name="initialAdmissionFee" type="number" />
          <TextField label={bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)"} name="agreedMonthly" type="number" />
          <Field className="md:col-span-2"><FieldLabel htmlFor="direct-internal-note">{bn ? "অভ্যন্তরীণ নোট" : "Internal note"}</FieldLabel><Textarea id="direct-internal-note" name="internalNote" rows={3} /></Field>
        </FieldGroup>
      </FormSection>

      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" type="button" onClick={onCancel}>{bn ? "বাতিল" : "Cancel"}</Button>
        <Button type="submit" disabled={busy || !courseId || !batchId}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {busy ? (bn ? "ভর্তি হচ্ছে…" : "Admitting…") : (bn ? "শিক্ষার্থী ভর্তি করুন" : "Admit student")}
        </Button>
      </div>
    </form>
  );
}
