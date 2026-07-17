"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, CircleAlert, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DirectAdmissionForm } from "./DirectAdmissionForm";
import { DatePicker } from "./DatePicker";
import { useSearchParams } from "next/navigation";
import { PortalPageState } from "./PortalPageState";

const pagination = { numItems: 100, cursor: null } as const;

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function AdmissionsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"new" | "under_review">("new");
  const [directAdmission, setDirectAdmission] = useState(() => searchParams?.get("add") === "true");
  useEffect(() => {
    if (searchParams?.get("add") !== "true") return;
    const timeoutId = setTimeout(() => setDirectAdmission(true), 0);
    return () => clearTimeout(timeoutId);
  }, [searchParams]);
  const applications = useQuery(api.admissions.owner.listApplications, { status, paginationOpts: pagination });
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const feePlans = useQuery(api.finance.functions.listFeePlans, {});
  const [selectedId, setSelectedId] = useState<Id<"admissionApplications"> | "">("");
  const detail = useQuery(api.admissions.owner.getApplication, selectedId ? { applicationId: selectedId } : "skip");
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [admissionDate, setAdmissionDate] = useState(dhakaToday());
  const [decision, setDecision] = useState<"reject" | "withdraw" | null>(null);
  const [reason, setReason] = useState("");
  const review = useMutation(api.admissions.owner.setReviewState);
  const accept = useMutation(api.admissions.owner.acceptApplication);
  const reject = useMutation(api.admissions.owner.rejectApplication);
  const withdraw = useMutation(api.admissions.owner.withdrawApplication);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const batches = useMemo(() => scopes?.batches.filter((batch) => !courseId || batch.courseId === courseId) ?? [], [scopes, courseId]);
  const courseNames = useMemo(() => new Map(scopes?.courses.map((row) => [row.courseId, bn ? row.nameBn : row.nameEn]) ?? []), [scopes, bn]);
  const batchNames = useMemo(() => new Map(scopes?.batches.map((row) => [row.batchId, bn ? row.nameBn : row.nameEn]) ?? []), [scopes, bn]);

  if (!applications || !scopes || !feePlans) return <PortalPageState state="loading" locale={locale} />;

  function choose(applicationId: Id<"admissionApplications">) {
    setSelectedId(applicationId);
    setFeedback(null);
    setDecision(null);
    setReason("");
    setCourseId("");
    setBatchId("");
    setAdmissionDate(dhakaToday());
  }

  async function execute(work: () => Promise<unknown>, closeAfter = false) {
    setBusy(true);
    setFeedback(null);
    try {
      await work();
      setFeedback({ ok: true, text: bn ? "আবেদন আপডেট হয়েছে।" : "Application updated." });
      setDecision(null);
      setReason("");
      if (closeAfter) setSelectedId("");
    } catch (cause) {
      setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Operation failed" });
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const data = new FormData(event.currentTarget);
    const confirmedCourseId = (courseId || detail.requestedCourseId) as Id<"courses">;
    const confirmedBatchId = (batchId || detail.requestedBatchId) as Id<"batches">;
    const initialCharge = Math.round(Number(data.get("initialCharge") || 0) * 100);
    const monthly = String(data.get("agreedMonthly") || "");
    const feePlanId = String(data.get("feePlanId") || "");
    await execute(() => accept({
      applicationId: detail.applicationId,
      conversionKey: crypto.randomUUID(),
      studentNumber: String(data.get("studentNumber")),
      admissionDate: String(data.get("admissionDate")),
      confirmedCourseId,
      confirmedBatchId,
      feePlanId: feePlanId ? (feePlanId as Id<"feePlans">) : undefined,
      agreedMonthlyAmountMinor: monthly ? Math.round(Number(monthly) * 100) : undefined,
      internalNote: String(data.get("internalNote") || "") || undefined,
      discounts: [],
      initialCharges: initialCharge > 0 ? [{ type: "admission", descriptionBn: "ভর্তি ফি", descriptionEn: "Admission fee", amountMinor: initialCharge, dueDate: String(data.get("admissionDate")) }] : [],
    }), true);
  }

  const dateFormatter = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "ভর্তি ইনবক্স" : "Admission inbox"}</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1>{bn ? "আবেদন পর্যালোচনা ও ভর্তি" : "Review and admit applicants"}</h1>
            <p>{bn ? "নতুন আবেদন যাচাই করুন, ডুপ্লিকেট সতর্কতা দেখুন এবং এক ধাপে ভর্তি সম্পন্ন করুন।" : "Review new applications, check duplicate warnings, and complete admission in one workflow."}</p>
          </div>
          <Button onClick={() => { setSelectedId(""); setDirectAdmission(true); }}>
            <Plus data-icon="inline-start" />
            {bn ? "শিক্ষার্থী যোগ করুন" : "Add student"}
          </Button>
        </div>
      </header>

      {feedback ? (
        <Alert variant={feedback.ok ? "default" : "destructive"} role={feedback.ok ? "status" : "alert"} className="mb-4">
          {feedback.ok ? <CheckCircle2 /> : <CircleAlert />}
          <AlertTitle>{feedback.ok ? (bn ? "আপডেট হয়েছে" : "Updated") : (bn ? "আপডেট হয়নি" : "Update failed")}</AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-[var(--border)] bg-[var(--canvas)] shadow-none">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{bn ? "আবেদনসমূহ" : "Applications"}</CardTitle>
            <CardDescription>{bn ? "একটি সারি নির্বাচন করলে পর্যালোচনার ড্রয়ার খুলবে।" : "Select a row to open its review drawer."}</CardDescription>
          </div>
          <ToggleGroup type="single" value={status} onValueChange={(value) => { if (!value) return; setStatus(value as "new" | "under_review"); setSelectedId(""); }} variant="outline" aria-label={bn ? "আবেদনের অবস্থা" : "Application status"}>
            <ToggleGroupItem value="new">{bn ? "নতুন" : "New"}</ToggleGroupItem>
            <ToggleGroupItem value="under_review">{bn ? "পর্যালোচনায়" : "Under review"}</ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {applications.page.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>{bn ? "আবেদনকারী" : "Applicant"}</TableHead><TableHead>{bn ? "অভিভাবক" : "Guardian"}</TableHead><TableHead>{bn ? "পছন্দ" : "Requested"}</TableHead><TableHead>{bn ? "জমা হয়েছে" : "Submitted"}</TableHead><TableHead>{bn ? "অবস্থা" : "Status"}</TableHead></TableRow></TableHeader>
              <TableBody>
                {applications.page.map((application) => (
                  <TableRow
                    key={application.applicationId}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]"
                    onClick={() => choose(application.applicationId)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(application.applicationId); } }}
                  >
                    <TableCell><div className="flex min-w-48 flex-col gap-1"><strong>{application.studentDisplayName}</strong><span className="text-xs text-muted-foreground">{application.applicationNumber} · {application.studentEmail}</span></div></TableCell>
                    <TableCell><div className="flex min-w-40 flex-col gap-1"><span>{application.guardianName}</span><span className="text-xs text-muted-foreground">{application.guardianPhone}</span></div></TableCell>
                    <TableCell><div className="flex min-w-36 flex-col gap-1"><span>{courseNames.get(application.requestedCourseId) ?? "—"}</span><span className="text-xs text-muted-foreground">{batchNames.get(application.requestedBatchId) ?? "—"}</span></div></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{dateFormatter.format(application.submittedAt)}</TableCell>
                    <TableCell><Badge variant={application.status === "new" ? "info" : "warning"}>{application.status === "new" ? (bn ? "নতুন" : "New") : (bn ? "পর্যালোচনায়" : "Under review")}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6"><EmptyState title={bn ? "এই অবস্থায় কোনো আবেদন নেই" : "No applications in this state"} description={bn ? "অন্য অবস্থা নির্বাচন করে দেখুন।" : "Try selecting the other status."} /></div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) { setSelectedId(""); setDecision(null); } }}>
        <SheetContent className="w-[min(760px,calc(100%-24px))] gap-6 p-0">
          {selectedId && detail === undefined ? (
            <div className="p-6"><SheetTitle className="sr-only">{bn ? "আবেদন লোড হচ্ছে" : "Loading application"}</SheetTitle><PortalPageState state="loading" locale={locale} /></div>
          ) : detail ? (
            <>
              <SheetHeader className="border-b border-[var(--border)] p-6 pe-14">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={detail.status === "new" ? "info" : "warning"}>{detail.status === "new" ? (bn ? "নতুন" : "New") : (bn ? "পর্যালোচনায়" : "Under review")}</Badge><span className="text-sm text-muted-foreground">{detail.applicationNumber}</span></div>
                <SheetTitle>{detail.studentDisplayName}</SheetTitle>
                <SheetDescription>{bn ? "আবেদনের তথ্য যাচাই করে পরবর্তী পদক্ষেপ নিন।" : "Verify the application details and choose the next action."}</SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 px-6 pb-6">
                <section className="flex flex-col gap-3">
                  <h3 className="text-base font-semibold">{bn ? "আবেদনকারীর তথ্য" : "Applicant details"}</h3>
                  <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                    <div><dt className="text-xs text-muted-foreground">{bn ? "Google ইমেইল" : "Google email"}</dt><dd className="mt-1 text-sm font-medium">{detail.studentEmail}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "শিক্ষার্থীর ফোন" : "Student phone"}</dt><dd className="mt-1 text-sm font-medium">{detail.studentPhone || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "স্কুল বা কলেজ" : "School or college"}</dt><dd className="mt-1 text-sm font-medium">{detail.schoolCollege}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "বর্তমান শ্রেণি" : "Current class"}</dt><dd className="mt-1 text-sm font-medium">{detail.currentClass}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "বাবা" : "Father"}</dt><dd className="mt-1 text-sm font-medium">{detail.guardianName} · {detail.guardianPhone}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "মা" : "Mother"}</dt><dd className="mt-1 text-sm font-medium">{detail.motherName || "—"} · {detail.motherPhone || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "পছন্দের কোর্স" : "Requested course"}</dt><dd className="mt-1 text-sm font-medium">{courseNames.get(detail.requestedCourseId) ?? "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{bn ? "পছন্দের ব্যাচ" : "Requested batch"}</dt><dd className="mt-1 text-sm font-medium">{batchNames.get(detail.requestedBatchId) ?? "—"}</dd></div>
                  </dl>
                  {detail.applicantNote ? <p className="rounded-lg border p-4 text-sm"><span className="font-medium">{bn ? "আবেদনকারীর নোট:" : "Applicant note:"}</span> {detail.applicantNote}</p> : null}
                </section>

                {detail.duplicateCandidates.length ? (
                  <Alert><CircleAlert /><AlertTitle>{bn ? "সম্ভাব্য ডুপ্লিকেট" : "Possible duplicates"}</AlertTitle><AlertDescription><ul className="mt-2 list-disc ps-5">{detail.duplicateCandidates.map((candidate) => <li key={`${candidate.kind}:${candidate.id}`}>{candidate.kind}: {candidate.reference} · {candidate.displayName} · {candidate.status}</li>)}</ul></AlertDescription></Alert>
                ) : null}

                <Separator />

                <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
                  <div className="flex flex-col gap-1"><h3 className="text-base font-semibold">{bn ? "অভ্যন্তরীণ ভর্তি তথ্য" : "Internal admission details"}</h3><p className="text-sm text-muted-foreground">{bn ? "গ্রহণ করলে শিক্ষার্থী, এনরোলমেন্ট, চার্জ ও সংরক্ষিত পোর্টাল অ্যাকাউন্ট তৈরি হবে।" : "Acceptance creates the student, enrolment, charges, and reserved portal account."}</p></div>
                  <FieldGroup className="grid gap-5 sm:grid-cols-2">
                    <Field><FieldLabel htmlFor="review-student-number">{bn ? "শিক্ষার্থী আইডি" : "Student ID"}</FieldLabel><Input id="review-student-number" name="studentNumber" required placeholder="ST-2026-0001" /></Field>
                    <Field>
                      <FieldLabel htmlFor="review-admission-date">{bn ? "ভর্তির তারিখ" : "Admission date"}</FieldLabel>
                      <DatePicker
                        id="review-admission-date"
                        value={admissionDate}
                        onChange={setAdmissionDate}
                        locale={locale}
                        ariaLabel={bn ? "ভর্তির তারিখ নির্বাচন করুন" : "Choose admission date"}
                        required
                      />
                      <input type="hidden" name="admissionDate" value={admissionDate} />
                    </Field>
                    <Field><FieldLabel htmlFor="review-initial-charge">{bn ? "প্রাথমিক ভর্তি ফি (৳)" : "Initial admission fee (BDT)"}</FieldLabel><Input id="review-initial-charge" name="initialCharge" type="number" min="0" step="0.01" defaultValue="0" /></Field>
                    <Field><FieldLabel htmlFor="review-course">{bn ? "নিশ্চিত কোর্স" : "Confirmed course"}</FieldLabel><Select value={courseId || detail.requestedCourseId} onValueChange={(value) => { setCourseId(value as Id<"courses">); setBatchId(""); }}><SelectTrigger id="review-course"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{scopes.courses.map((row) => <SelectItem key={row.courseId} value={row.courseId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                    <Field><FieldLabel htmlFor="review-batch">{bn ? "নিশ্চিত ব্যাচ" : "Confirmed batch"}</FieldLabel><Select value={batchId || detail.requestedBatchId} onValueChange={(value) => setBatchId(value as Id<"batches">)}><SelectTrigger id="review-batch"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{batches.map((row) => <SelectItem key={row.batchId} value={row.batchId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                    <Field><FieldLabel htmlFor="review-fee-plan">{bn ? "ফি পরিকল্পনা" : "Fee plan"}</FieldLabel><Select name="feePlanId"><SelectTrigger id="review-fee-plan"><SelectValue placeholder={bn ? "ঐচ্ছিক" : "Optional"} /></SelectTrigger><SelectContent><SelectGroup>{feePlans.map((row) => <SelectItem key={row.feePlanId} value={row.feePlanId}>{bn ? row.nameBn : row.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
                    <Field><FieldLabel htmlFor="review-monthly">{bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)"}</FieldLabel><Input id="review-monthly" name="agreedMonthly" type="number" min="0" step="0.01" /></Field>
                    <Field className="sm:col-span-2"><FieldLabel htmlFor="review-note">{bn ? "অভ্যন্তরীণ নোট" : "Internal note"}</FieldLabel><Textarea id="review-note" name="internalNote" rows={3} /><FieldDescription>{bn ? "শুধু অভ্যন্তরীণ ব্যবহারের জন্য।" : "For internal use only."}</FieldDescription></Field>
                  </FieldGroup>
                  <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-background py-4 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button variant="ghost" type="button" disabled={busy} onClick={() => setDecision("withdraw")}>{bn ? "প্রত্যাহার" : "Withdraw"}</Button>
                    <Button variant="danger" type="button" disabled={busy} onClick={() => setDecision("reject")}>{bn ? "প্রত্যাখ্যান" : "Reject"}</Button>
                    <Button variant="secondary" type="button" disabled={busy || detail.status === "under_review"} onClick={() => void execute(() => review({ applicationId: detail.applicationId, status: "under_review" }))}>{bn ? "পর্যালোচনায় রাখুন" : "Mark under review"}</Button>
                    <Button type="submit" disabled={busy}>{busy ? <Spinner data-icon="inline-start" /> : null}{bn ? "গ্রহণ ও ভর্তি করুন" : "Accept and admit"}</Button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="p-6"><SheetTitle className="sr-only">{bn ? "আবেদন পাওয়া যায়নি" : "Application not found"}</SheetTitle><EmptyState title={bn ? "আবেদন পাওয়া যায়নি" : "Application not found"} /></div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={directAdmission} onOpenChange={setDirectAdmission}>
        <SheetContent className="w-[min(760px,calc(100%-24px))] gap-0 p-0">
          <SheetHeader className="border-b border-[var(--border)] p-6 pe-14"><SheetTitle>{bn ? "নতুন শিক্ষার্থী ভর্তি" : "Admit a new student"}</SheetTitle><SheetDescription>{bn ? "পাবলিক আবেদন ছাড়াই শিক্ষার্থী ও এনরোলমেন্ট তৈরি করুন।" : "Create a student and enrolment without a public application."}</SheetDescription></SheetHeader>
          <div className="px-6 pb-6 pt-5"><DirectAdmissionForm locale={locale} onCancel={() => setDirectAdmission(false)} /></div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(decision)} onOpenChange={(open) => { if (!open) { setDecision(null); setReason(""); } }}>
        <AlertDialogContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); if (!detail || !decision || !reason.trim()) return; void execute(() => decision === "reject" ? reject({ applicationId: detail.applicationId, reason: reason.trim() }) : withdraw({ applicationId: detail.applicationId, reason: reason.trim() }), true); }}>
            <AlertDialogHeader><AlertDialogTitle>{decision === "reject" ? (bn ? "প্রত্যাখ্যান নিশ্চিত করুন" : "Confirm rejection") : (bn ? "প্রত্যাহার নিশ্চিত করুন" : "Confirm withdrawal")}</AlertDialogTitle><AlertDialogDescription>{bn ? "এই সিদ্ধান্তের কারণ লিখুন। আবেদনটি বর্তমান ইনবক্স থেকে সরিয়ে দেওয়া হবে।" : "Provide a reason for this decision. The application will leave the current inbox."}</AlertDialogDescription></AlertDialogHeader>
            <Field><FieldLabel htmlFor="decision-reason">{bn ? "কারণ" : "Reason"}</FieldLabel><Textarea id="decision-reason" required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
            <AlertDialogFooter><AlertDialogCancel type="button" disabled={busy}>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel><AlertDialogAction type="submit" disabled={busy || !reason.trim()}>{busy ? <Spinner data-icon="inline-start" /> : null}{decision === "reject" ? (bn ? "প্রত্যাখ্যান করুন" : "Reject") : (bn ? "প্রত্যাহার করুন" : "Withdraw")}</AlertDialogAction></AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
