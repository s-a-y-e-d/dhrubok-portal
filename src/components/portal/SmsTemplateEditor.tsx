"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareText, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

type EditableKey = "attendance_late" | "attendance_absent" | "payment_posted" | "result_published" | "due_reminder";
type TemplateRow = {
  templateId: string; key: string; name: string; bodyBn: string; bodyEn: string;
  enabled: boolean; variables: string[]; updatedAt: number;
};

const META: Record<EditableKey, { titleEn: string; titleBn: string; variables: string[] }> = {
  attendance_late: { titleEn: "Attendance — Late", titleBn: "উপস্থিতি — বিলম্ব", variables: ["brand", "studentName", "classDate", "attendanceStatus", "batchName"] },
  attendance_absent: { titleEn: "Attendance — Absent", titleBn: "উপস্থিতি — অনুপস্থিত", variables: ["brand", "studentName", "classDate", "attendanceStatus", "batchName"] },
  payment_posted: { titleEn: "Payment — Received", titleBn: "পেমেন্ট — গ্রহণ করা হয়েছে", variables: ["brand", "studentName", "amount", "receiptNumber", "collectionDate"] },
  due_reminder: { titleEn: "Finance — Due reminder", titleBn: "ফাইন্যান্স — বকেয়া স্মরণ", variables: ["brand", "studentName", "amount"] },
  result_published: { titleEn: "Exam result — Published", titleBn: "পরীক্ষার ফল — প্রকাশিত", variables: ["brand", "examName", "studentName", "totalScore", "fullMarks", "resultStatus", "meritPosition"] },
};
const SAMPLE: Record<string, string> = {
  brand: "Dhrubok", studentName: "Rahim Ahmed", classDate: "2026-07-20",
  attendanceStatus: "absent", batchName: "Class 10 — Evening", amount: "3000.00",
  receiptNumber: "RCPT-2026-001024", collectionDate: "2026-07-20",
  examName: "Monthly Assessment", totalScore: "75", fullMarks: "100", resultStatus: "Passed", meritPosition: "Course merit: 3/42",
};

function segmentInfo(body: string) {
  const unicode = /[^\x00-\x7F]/.test(body);
  const length = [...body].length;
  const single = unicode ? 70 : 160;
  const multipart = unicode ? 67 : 153;
  return { length, encoding: unicode ? "UCS-2" : "GSM", segments: length <= single ? 1 : Math.ceil(length / multipart) };
}

function preview(body: string) {
  return body.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, key: string) => SAMPLE[key] ?? `{${key}}`);
}

function TemplateCard({ locale, row, templateKey }: { locale: "bn" | "en"; row: TemplateRow; templateKey: EditableKey }) {
  const bn = locale === "bn";
  const save = useMutation(api.messaging.templateFunctions.save);
  const restore = useMutation(api.messaging.templateFunctions.restoreDefault);
  const [bodyBn, setBodyBn] = useState(row.bodyBn);
  const [bodyEn, setBodyEn] = useState(row.bodyEn);
  const [enabled, setEnabled] = useState(row.enabled);
  const [busy, setBusy] = useState(false);
  const bodyPreview = preview(bn ? bodyBn : bodyEn);
  const info = segmentInfo(bodyPreview);

  async function saveTemplate() {
    setBusy(true);
    try {
      await save({ key: templateKey, name: META[templateKey].titleEn, bodyBn, bodyEn, enabled });
      toast.success(bn ? "SMS টেমপ্লেট সংরক্ষিত হয়েছে।" : "SMS template saved.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save template");
    } finally { setBusy(false); }
  }

  async function restoreTemplate() {
    setBusy(true);
    try {
      await restore({ key: templateKey });
      toast.success(bn ? "ডিফল্ট টেমপ্লেট পুনরুদ্ধার হয়েছে।" : "Default template restored.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not restore template");
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{bn ? META[templateKey].titleBn : META[templateKey].titleEn}</CardTitle>
        <CardDescription>{bn ? "শিক্ষার্থীর নির্বাচিত SMS ভাষা অনুযায়ী একটি সংস্করণ পাঠানো হবে।" : "The student’s preferred SMS locale determines which version is sent."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field orientation="horizontal">
          <Checkbox id={`${templateKey}-enabled`} checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={`${templateKey}-enabled`}>{bn ? "এই SMS চালু রাখুন" : "Enable this SMS"}</FieldLabel>
            <FieldDescription>{bn ? "বন্ধ করলে মূল কাজ সম্পন্ন হবে, কিন্তু SMS তৈরি হবে না।" : "When disabled, the operation still completes but no SMS is created."}</FieldDescription>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2" aria-label={bn ? "অনুমোদিত ভেরিয়েবল" : "Allowed variables"}>
          {META[templateKey].variables.map((variable) => <Badge key={variable} variant="neutral">{`{${variable}}`}</Badge>)}
        </div>
        <FieldGroup className="grid gap-5 lg:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${templateKey}-bn`}>বাংলা</FieldLabel>
            <Textarea id={`${templateKey}-bn`} value={bodyBn} onChange={(event) => setBodyBn(event.target.value)} maxLength={2000} lang="bn" />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${templateKey}-en`}>English</FieldLabel>
            <Textarea id={`${templateKey}-en`} value={bodyEn} onChange={(event) => setBodyEn(event.target.value)} maxLength={2000} lang="en" />
          </Field>
        </FieldGroup>
        <Alert>
          <AlertTitle>{bn ? "লাইভ প্রিভিউ" : "Live preview"}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>{bodyPreview}</span>
            <span>{info.length} {bn ? "অক্ষর" : "characters"} · {info.encoding} · {info.segments} {bn ? "সেগমেন্ট" : `segment${info.segments === 1 ? "" : "s"}`}</span>
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void saveTemplate()}><Save data-icon="inline-start" />{bn ? "টেমপ্লেট সংরক্ষণ" : "Save template"}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void restoreTemplate()}><RotateCcw data-icon="inline-start" />{bn ? "ডিফল্ট পুনরুদ্ধার" : "Restore default"}</Button>
      </CardFooter>
    </Card>
  );
}

function SmsDeliveryControl({ locale, settings }: {
  locale: "bn" | "en";
  settings: { smsEnabled: boolean; smsConfigured: boolean; smsSenderIdConfigured: boolean; updatedAt: number };
}) {
  const bn = locale === "bn";
  const update = useMutation(api.settings.setSmsEnabled);
  const [enabled, setEnabled] = useState(settings.smsEnabled);
  const [busy, setBusy] = useState(false);
  async function saveDeliverySetting() {
    setBusy(true);
    try {
      await update({ enabled, expectedUpdatedAt: settings.updatedAt });
      toast.success(enabled ? (bn ? "SMS ডেলিভারি চালু হয়েছে।" : "SMS delivery enabled.") : (bn ? "SMS ডেলিভারি বন্ধ হয়েছে।" : "SMS delivery disabled."));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not update SMS delivery");
    } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2"><MessageSquareText />{bn ? "SMS ডেলিভারি" : "SMS Delivery"}</CardTitle>
            <CardDescription>{bn ? "ভর্তি, অনুপস্থিতি/বিলম্ব এবং পেমেন্টের স্বয়ংক্রিয় অভিভাবক SMS নিয়ন্ত্রণ করুন।" : "Control automatic guardian SMS for admissions, absence/late attendance, and payments."}</CardDescription>
          </div>
          <Badge variant={settings.smsEnabled ? "success" : "neutral"}>{settings.smsEnabled ? (bn ? "চালু" : "Enabled") : (bn ? "বন্ধ" : "Disabled")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <Checkbox id="sms-delivery-enabled" checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="sms-delivery-enabled">{bn ? "স্বয়ংক্রিয় SMS পাঠান" : "Send automatic SMS"}</FieldLabel>
            <FieldDescription>{bn ? "বন্ধ থাকলে ভর্তি, উপস্থিতি ও পেমেন্ট সম্পন্ন হবে, কিন্তু কোনো SMS পাঠানো হবে না।" : "When disabled, admission, attendance, and payments still complete, but no SMS is sent."}</FieldDescription>
          </div>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Badge variant={settings.smsConfigured ? "success" : "danger"}>{settings.smsConfigured ? (bn ? "API কী কনফিগার করা" : "API key configured") : (bn ? "API কী নেই" : "API key missing")}</Badge>
          <Badge variant={settings.smsSenderIdConfigured ? "success" : "danger"}>{settings.smsSenderIdConfigured ? (bn ? "সেন্ডার আইডি কনফিগার করা" : "Sender ID configured") : (bn ? "সেন্ডার আইডি নেই" : "Sender ID missing")}</Badge>
        </div>
        {enabled && (!settings.smsConfigured || !settings.smsSenderIdConfigured) ? <Alert variant="destructive"><AlertTitle>{bn ? "কনফিগারেশন অসম্পূর্ণ" : "Configuration incomplete"}</AlertTitle><AlertDescription>{bn ? "BulkSMSBD API কী এবং অনুমোদিত সেন্ডার আইডি দুটোই Convex environment-এ সেট করুন।" : "Set both the BulkSMSBD API key and approved sender ID in the Convex environment."}</AlertDescription></Alert> : null}
      </CardContent>
      <CardFooter><Button type="button" disabled={busy || enabled === settings.smsEnabled} onClick={() => void saveDeliverySetting()}><Save data-icon="inline-start" />{bn ? "ডেলিভারি সেটিং সংরক্ষণ" : "Save delivery setting"}</Button></CardFooter>
    </Card>
  );
}

function AutomaticDueReminderControl({ locale, settings }: {
  locale: "bn" | "en";
  settings: { automaticDueRemindersEnabled?: boolean; automaticDueReminderDay?: number; updatedAt: number };
}) {
  const bn = locale === "bn";
  const save = useMutation(api.settings.setAutomaticDueReminders);
  const [enabled, setEnabled] = useState(settings.automaticDueRemindersEnabled ?? false);
  const [day, setDay] = useState(String(settings.automaticDueReminderDay ?? 15));
  const [busy, setBusy] = useState(false);
  const hasChanges =
    enabled !== (settings.automaticDueRemindersEnabled ?? false) ||
    Number(day) !== (settings.automaticDueReminderDay ?? 15);
  async function submit() {
    setBusy(true);
    try {
      await save({ enabled, day: Number(day), expectedUpdatedAt: settings.updatedAt });
      toast.success(bn ? "স্বয়ংক্রিয় বকেয়া SMS সেটিং সংরক্ষিত হয়েছে।" : "Automatic due reminder setting saved.");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Could not save automatic reminder setting"); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>{bn ? "স্বয়ংক্রিয় বকেয়া SMS" : "Automatic due SMS"}</CardTitle><CardDescription>{bn ? "প্রতি মাসে নির্বাচিত তারিখে সন্ধ্যা ৭টায় বকেয়া থাকা শিক্ষার্থীদের অভিভাবককে SMS পাঠানো হবে। একই মাসে দ্বিতীয়বার পাঠানো হবে না।" : "At 7:00 PM on the selected day each month, guardians of students with overdue fees receive an SMS. A guardian is never reminded twice in one month."}</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-4"><Field orientation="horizontal"><Checkbox id="automatic-due-enabled" checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} /><div className="flex flex-col gap-1"><FieldLabel htmlFor="automatic-due-enabled">{bn ? "স্বয়ংক্রিয় বকেয়া SMS চালু করুন" : "Enable automatic due SMS"}</FieldLabel><FieldDescription>{bn ? "মূল SMS ডেলিভারি বন্ধ থাকলে কোনো SMS পাঠানো হবে না।" : "The main SMS Delivery switch remains the final master control."}</FieldDescription></div></Field><Field><FieldLabel htmlFor="automatic-due-day">{bn ? "মাসের দিন (১–২৮)" : "Day of month (1–28)"}</FieldLabel><Input id="automatic-due-day" type="number" min="1" max="28" value={day} onChange={(event) => setDay(event.target.value)} /></Field></CardContent>
    <CardFooter><Button type="button" disabled={busy || !hasChanges} onClick={() => void submit()}><Save data-icon="inline-start" />{bn ? "সেটিং সংরক্ষণ" : "Save setting"}</Button></CardFooter>
  </Card>;
}

export function SmsTemplateEditor({ locale, settings }: {
  locale: "bn" | "en";
  settings: { smsEnabled: boolean; smsConfigured: boolean; smsSenderIdConfigured: boolean; automaticDueRemindersEnabled?: boolean; automaticDueReminderDay?: number; updatedAt: number };
}) {
  const bn = locale === "bn";
  const templates = useQuery(api.messaging.templateFunctions.list, {});
  const seed = useMutation(api.messaging.templateFunctions.seedDefaults);
  if (!Array.isArray(templates)) return null;
  const byKey = new Map(templates.map((row) => [row.key, row]));
  const missing = (["attendance_late", "attendance_absent", "payment_posted", "result_published", "due_reminder"] as EditableKey[]).some((key) => !byKey.has(key));
  if (missing) return <div className="flex flex-col gap-4">
    <SmsDeliveryControl key={settings.updatedAt} locale={locale} settings={settings} />
    <AutomaticDueReminderControl key={`automatic-${settings.updatedAt}`} locale={locale} settings={settings} />
    <Card>
      <CardHeader><CardTitle>{bn ? "SMS টেমপ্লেট" : "SMS templates"}</CardTitle><CardDescription>{bn ? "সম্পাদনার আগে ডিফল্ট টেমপ্লেট তৈরি করুন।" : "Create the default templates before editing them."}</CardDescription></CardHeader>
      <CardFooter><Button type="button" onClick={() => void seed({})}>{bn ? "ডিফল্ট তৈরি করুন" : "Create defaults"}</Button></CardFooter>
    </Card>
  </div>;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="sms-template-heading">
      <SmsDeliveryControl key={settings.updatedAt} locale={locale} settings={settings} />
      <AutomaticDueReminderControl key={`automatic-${settings.updatedAt}`} locale={locale} settings={settings} />
      <div><h2 id="sms-template-heading" className="text-xl font-semibold">{bn ? "SMS টেমপ্লেট" : "SMS templates"}</h2><p className="text-sm text-muted-foreground">{bn ? "উপস্থিতি ও পেমেন্ট বার্তার বাংলা এবং ইংরেজি সংস্করণ পরিচালনা করুন।" : "Manage Bangla and English attendance and payment messages."}</p></div>
      <Tabs defaultValue="attendance">
        <TabsList><TabsTrigger value="attendance">{bn ? "উপস্থিতি" : "Attendance"}</TabsTrigger><TabsTrigger value="exams">{bn ? "পরীক্ষা" : "Exams"}</TabsTrigger><TabsTrigger value="payment">{bn ? "পেমেন্ট" : "Payment"}</TabsTrigger><TabsTrigger value="finance">{bn ? "ফাইন্যান্স" : "Finance"}</TabsTrigger></TabsList>
        <TabsContent value="attendance" className="grid gap-4 lg:grid-cols-2">
          {(["attendance_late", "attendance_absent"] as EditableKey[]).map((key) => <TemplateCard key={`${key}:${byKey.get(key)!.updatedAt}`} locale={locale} row={byKey.get(key)! as TemplateRow} templateKey={key} />)}
        </TabsContent>
        <TabsContent value="exams"><TemplateCard key={`result_published:${byKey.get("result_published")!.updatedAt}`} locale={locale} row={byKey.get("result_published")! as TemplateRow} templateKey="result_published" /></TabsContent>
        <TabsContent value="payment"><TemplateCard key={`payment_posted:${byKey.get("payment_posted")!.updatedAt}`} locale={locale} row={byKey.get("payment_posted")! as TemplateRow} templateKey="payment_posted" /></TabsContent>
        <TabsContent value="finance"><TemplateCard key={`due_reminder:${byKey.get("due_reminder")!.updatedAt}`} locale={locale} row={byKey.get("due_reminder")! as TemplateRow} templateKey="due_reminder" /></TabsContent>
      </Tabs>
    </section>
  );
}
