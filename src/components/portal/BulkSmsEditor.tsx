"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, Send, Users } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PortalPageState } from "./PortalPageState";

type Audience = "all_students" | "course" | "batch" | "individual_students";
type Recipient = "guardian" | "student";

const smsCost = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
  }).format(minor / 100);

export function BulkSmsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const students = useQuery(api.bulkSms.functions.listActiveStudents, {});
  const queue = useMutation(api.bulkSms.functions.queue);
  const [audience, setAudience] = useState<Audience>("all_students");
  const [recipient, setRecipient] = useState<Recipient>("guardian");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Id<"students">[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const scopeReady = audience === "all_students" || (audience === "course" && Boolean(courseId)) || (audience === "batch" && Boolean(batchId)) || (audience === "individual_students" && selectedStudentIds.length > 0);
  const input = {
    audience,
    recipient,
    courseId: audience === "course" ? courseId || undefined : undefined,
    batchId: audience === "batch" ? batchId || undefined : undefined,
    studentIds: audience === "individual_students" ? selectedStudentIds : undefined,
    message,
  };
  const preview = useQuery(api.bulkSms.functions.previewRecipients, confirmationOpen && scopeReady && message.trim() ? input : "skip");
  const matchingStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (students ?? []).filter((student) => !term || `${student.displayName} ${student.studentNumber}`.toLocaleLowerCase().includes(term)).slice(0, 20);
  }, [search, students]);

  if (scopes === undefined || students === undefined) return <PortalPageState state="loading" locale={locale} />;

  function chooseAudience(value: string) {
    if (!value) return;
    setAudience(value as Audience);
    setCourseId("");
    setBatchId("");
  }

  function toggleStudent(studentId: Id<"students">, checked: boolean) {
    setSelectedStudentIds((current) => checked ? [...current, studentId] : current.filter((id) => id !== studentId));
  }

  async function queueSms() {
    if (!preview) return;
    setBusy(true);
    try {
      const queued = await queue({ ...input, expectedRecipientCount: preview.recipientCount, expectedConfirmationFingerprint: preview.confirmationFingerprint });
      setConfirmationOpen(false);
      setMessage("");
      setSelectedStudentIds([]);
      setResult(bn ? `${queued.queuedCount}টি SMS কিউ করা হয়েছে।` : `${queued.queuedCount} SMS message${queued.queuedCount === 1 ? "" : "s"} queued.`);
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : (bn ? "SMS কিউ করা যায়নি।" : "Unable to queue SMS."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">SMS</p>
        <h1>{bn ? "বাল্ক SMS পাঠান" : "Send bulk SMS"}</h1>
        <p>{bn ? "একটি বার্তা নির্বাচন করা শিক্ষার্থী বা তাদের পছন্দের অভিভাবকের কাছে পাঠান।" : "Send one message to selected students or to each student’s preferred guardian contact."}</p>
      </header>

      {result ? <Alert className="mb-5" role="status"><CheckCircle2 data-icon="inline-start" /><AlertTitle>{bn ? "SMS আপডেট" : "SMS update"}</AlertTitle><AlertDescription>{result}</AlertDescription></Alert> : null}

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>{bn ? "বার্তা তৈরি করুন" : "Compose message"}</CardTitle>
          <CardDescription>{bn ? "পাঠানোর আগে প্রাপক, SMS অংশ এবং আনুমানিক খরচ পর্যালোচনা করুন।" : "Review recipients, SMS segments, and the estimated cost before queuing."}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>{bn ? "যাদের পাঠাবেন" : "Audience"}</FieldLabel>
              <ToggleGroup type="single" value={audience} onValueChange={chooseAudience} className="w-full flex-wrap justify-start" aria-label={bn ? "প্রাপকের ধরন" : "Audience type"}>
                <ToggleGroupItem value="all_students">{bn ? "সব শিক্ষার্থী" : "All students"}</ToggleGroupItem>
                <ToggleGroupItem value="course">{bn ? "কোর্স" : "Course"}</ToggleGroupItem>
                <ToggleGroupItem value="batch">{bn ? "ব্যাচ" : "Batch"}</ToggleGroupItem>
                <ToggleGroupItem value="individual_students">{bn ? "নির্বাচিত" : "Selected"}</ToggleGroupItem>
              </ToggleGroup>
            </Field>

            {audience === "course" ? <Field>
              <FieldLabel>{bn ? "কোর্স নির্বাচন করুন" : "Choose course"}</FieldLabel>
              <Select value={courseId} onValueChange={(value) => setCourseId(value as Id<"courses">)}><SelectTrigger><SelectValue placeholder={bn ? "কোর্স বেছে নিন" : "Select a course"} /></SelectTrigger><SelectContent><SelectGroup>{scopes.courses.map((course) => <SelectItem key={course.courseId} value={course.courseId}>{bn ? course.nameBn : course.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select>
            </Field> : null}

            {audience === "batch" ? <Field>
              <FieldLabel>{bn ? "ব্যাচ নির্বাচন করুন" : "Choose batch"}</FieldLabel>
              <Select value={batchId} onValueChange={(value) => setBatchId(value as Id<"batches">)}><SelectTrigger><SelectValue placeholder={bn ? "ব্যাচ বেছে নিন" : "Select a batch"} /></SelectTrigger><SelectContent><SelectGroup>{scopes.batches.map((batch) => <SelectItem key={batch.batchId} value={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select>
            </Field> : null}

            {audience === "individual_students" ? <Field>
              <FieldLabel>{bn ? "শিক্ষার্থী নির্বাচন করুন" : "Select students"}</FieldLabel>
              <div className="flex flex-wrap items-center gap-2"><Badge variant="info">{selectedStudentIds.length} {bn ? "নির্বাচিত" : "selected"}</Badge><FieldDescription>{bn ? "নাম বা শিক্ষার্থী নম্বর দিয়ে খুঁজুন।" : "Search by name or student number."}</FieldDescription></div>
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={bn ? "শিক্ষার্থী খুঁজুন" : "Search students"} />
                <div className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {matchingStudents.map((student) => { const checked = selectedStudentIds.includes(student.studentId); return <label key={student.studentId} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-2 hover:bg-[var(--canvas-subtle)]"><Checkbox checked={checked} onCheckedChange={(value) => toggleStudent(student.studentId, value === true)} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{student.displayName}</span><span className="block font-mono text-xs text-muted-foreground">{student.studentNumber}</span></span></label>; })}
                  {!matchingStudents.length ? <p className="px-2 py-3 text-sm text-muted-foreground">{bn ? "কোনো শিক্ষার্থী পাওয়া যায়নি।" : "No students found."}</p> : null}
                </div>
              </div>
            </Field> : null}

            <Field>
              <FieldLabel>{bn ? "ফোনের প্রাপক" : "Phone recipient"}</FieldLabel>
              <ToggleGroup type="single" value={recipient} onValueChange={(value) => value && setRecipient(value as Recipient)} aria-label={bn ? "ফোনের প্রাপক" : "Phone recipient"}>
                <ToggleGroupItem value="guardian">{bn ? "অভিভাবক" : "Guardians"}</ToggleGroupItem>
                <ToggleGroupItem value="student">{bn ? "শিক্ষার্থী" : "Students"}</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>{recipient === "guardian" ? (bn ? "প্রতিটি শিক্ষার্থীর সংরক্ষিত পছন্দের অভিভাবক নম্বরে পাঠানো হবে; ‘উভয়’ হলে দুটি নম্বরেই যাবে।" : "Uses each student’s saved guardian preference; a preference of ‘both’ sends to both contacts.") : (bn ? "শিক্ষার্থীর নিজের ফোন নম্বরে পাঠানো হবে। নম্বর না থাকলে তাকে বাদ দেওয়া হবে।" : "Sends to the student’s own phone number. Students without one are excluded.")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="bulk-sms-message">{bn ? "SMS বার্তা" : "SMS message"}</FieldLabel>
              <Textarea id="bulk-sms-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={bn ? "আপনার বার্তা লিখুন" : "Write your message"} maxLength={1000} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end"><Button disabled={!scopeReady || !message.trim()} onClick={() => { setResult(null); setConfirmationOpen(true); }}><Users data-icon="inline-start" />{bn ? "পাঠানোর আগে পর্যালোচনা" : "Review before sending"}</Button></CardFooter>
      </Card>

      <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{bn ? "SMS কিউ করার আগে পর্যালোচনা" : "Review before queuing SMS"}</DialogTitle><DialogDescription>{bn ? "কিউ করার পর SMS প্রোভাইডারের কাছে পাঠানোর জন্য নির্ধারিত হবে।" : "Queuing schedules these messages for delivery through the SMS provider."}</DialogDescription></DialogHeader>
          {preview === undefined ? <PortalPageState state="loading" locale={locale} /> : <div className="flex flex-col gap-4">
            {!preview.enabled ? <Alert variant="destructive"><AlertTitle>{bn ? "SMS বন্ধ আছে" : "SMS is disabled"}</AlertTitle><AlertDescription>{bn ? "সেটিংস থেকে SMS ডেলিভারি চালু করুন।" : "Enable SMS delivery in Settings before queuing."}</AlertDescription></Alert> : null}
            <div className="rounded-[var(--radius-md)] bg-[var(--canvas-subtle)] p-4 text-sm whitespace-pre-wrap">{preview.body}</div>
            <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted-foreground">{bn ? "শিক্ষার্থী" : "Students"}</dt><dd className="mt-1 font-medium">{preview.studentCount}</dd></div><div><dt className="text-muted-foreground">{bn ? "SMS প্রাপক" : "SMS recipients"}</dt><dd className="mt-1 font-medium">{preview.recipientCount}</dd></div><div><dt className="text-muted-foreground">{bn ? "অক্ষর / অংশ" : "Characters / segments"}</dt><dd className="mt-1 font-medium">{preview.characterCount} / {preview.segmentCount}</dd></div><div><dt className="text-muted-foreground">{bn ? "আনুমানিক খরচ" : "Estimated cost"}</dt><dd className="mt-1 font-mono font-medium tabular-nums">{smsCost(preview.estimatedCostMinor, locale)}</dd></div></dl>
            {preview.excludedStudentCount ? <Alert><AlertTitle>{bn ? "কিছু শিক্ষার্থী বাদ যাবে" : "Some students will be excluded"}</AlertTitle><AlertDescription>{preview.excludedStudentCount} {bn ? "জনের নির্বাচিত ফোন নম্বর নেই বা বৈধ নয়।" : "student(s) have no valid phone number for this recipient choice."}</AlertDescription></Alert> : null}
            {!preview.recipientCount ? <Alert variant="destructive"><AlertTitle>{bn ? "কোনো বৈধ প্রাপক নেই" : "No eligible recipients"}</AlertTitle><AlertDescription>{bn ? "প্রাপক নির্বাচন বা শিক্ষার্থীর ফোন নম্বর পরীক্ষা করুন।" : "Check the recipient choice or students’ phone numbers."}</AlertDescription></Alert> : null}
            {preview.recipientLimitExceeded ? <Alert variant="destructive"><AlertTitle>{bn ? "প্রাপকের সীমা অতিক্রম করেছে" : "Recipient limit exceeded"}</AlertTitle><AlertDescription>{bn ? "একটি বাল্ক SMS প্রচারণায় সর্বোচ্চ ১,০০০টি ফোন নম্বরে পাঠানো যায়। ছোট একটি গ্রুপ নির্বাচন করুন।" : "A bulk SMS campaign can send to at most 1,000 phone numbers. Choose a smaller group."}</AlertDescription></Alert> : null}
          </div>}
          <DialogFooter><Button variant="secondary" disabled={busy} onClick={() => setConfirmationOpen(false)}>{bn ? "ফিরে যান" : "Back"}</Button><Button disabled={busy || !preview?.enabled || !preview.recipientCount || preview.recipientLimitExceeded} onClick={() => void queueSms()}>{busy ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}{preview?.recipientCount ?? 0} {bn ? "টি SMS কিউ করুন" : "SMS — queue"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
