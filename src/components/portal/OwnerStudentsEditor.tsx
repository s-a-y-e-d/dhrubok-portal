"use client";

/* eslint-disable @next/next/no-img-element -- Convex returns short-lived signed image URLs. */

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightLeft, ExternalLink, MoreHorizontal, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "./DatePicker";
import { PortalPageState } from "./PortalPageState";
import { ResponsiveDetailDrawer } from "./ResponsiveDetailDrawer";

const page = { numItems: 100, cursor: null } as const;

function money(minor: number, locale: "bn" | "en") {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency", currency: "BDT", maximumFractionDigits: 0,
  }).format(minor / 100);
}

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function OwnerStudentsEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const students = useQuery(api.students.owner.listStudents, { paginationOpts: page });
  const requests = useQuery(api.students.owner.listChangeRequests, { status: "pending", paginationOpts: page });
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const [selectedId, setSelectedId] = useState<Id<"students"> | null>(() => searchParams?.get("student") as Id<"students"> | null);
  const selected = useQuery(api.students.owner.getStudent, selectedId ? { studentId: selectedId } : "skip");
  const update = useMutation(api.students.owner.updateStudent);
  const review = useMutation(api.students.owner.reviewChangeRequest);
  const transfer = useMutation(api.students.owner.transferEnrolment);
  const generatePhotoUploadUrl = useMutation(api.students.owner.generatePhotoUploadUrl);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(dhakaToday());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (students?.page ?? []).filter((student) => {
      const matchesStatus = status === "all" || student.status === status;
      const matchesQuery = !needle || [student.displayName, student.studentNumber, student.guardianPhone, student.courseNameBn, student.courseNameEn, student.batchNameBn, student.batchNameEn]
        .some((value) => value?.toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [query, status, students]);

  const availableBatches = useMemo(() => scopes?.batches.filter((batch) => batch.courseId === courseId) ?? [], [courseId, scopes]);
  const activeEnrolment = selected?.enrolments.find((enrolment) => enrolment.status === "active");

  async function run(work: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage(null);
    try { await work(); setMessage({ ok: true, text: success }); return true; }
    catch (cause) { setMessage({ ok: false, text: cause instanceof Error ? cause.message : String(cause) }); return false; }
    finally { setBusy(false); }
  }

  function openTransfer() {
    if (!selected) return;
    const current = selected.enrolments.find((row) => row.status === "active");
    setCourseId(current?.courseId ?? "");
    setBatchId(current?.batchId ?? "");
    setMonthlyFee(current?.agreedMonthlyAmountMinor ? String(current.agreedMonthlyAmountMinor / 100) : "");
    setEffectiveDate(dhakaToday());
    setMessage(null);
    setTransferOpen(true);
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !courseId || !batchId) return;
    const amountMinor = Math.round(Number(monthlyFee) * 100);
    const ok = await run(() => transfer({ studentId: selected.studentId, courseId, batchId, agreedMonthlyAmountMinor: amountMinor, effectiveDate }), bn ? "কোর্স ও ব্যাচ পরিবর্তন হয়েছে।" : "Course and batch changed.");
    if (ok) setTransferOpen(false);
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const nullable = (key: string) => String(data.get(key) || "").trim() || null;
    const photo = data.get("photo");
    await run(async () => {
      let photoStorageId: Id<"_storage"> | undefined;
      if (photo instanceof File && photo.size > 0) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error("Choose a JPEG, PNG, or WebP image");
        if (photo.size > 8 * 1024 * 1024) throw new Error("Image must be 8 MB or smaller");
        const uploadUrl = await generatePhotoUploadUrl({});
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": photo.type }, body: photo });
        if (!response.ok) throw new Error("Could not upload the student image");
        photoStorageId = (await response.json()).storageId as Id<"_storage">;
      }
      await update({
        studentId: selected.studentId, ...(photoStorageId ? { photoStorageId } : {}),
        displayName: String(data.get("displayName")), loginEmail: String(data.get("loginEmail")),
        phone: nullable("phone"), schoolCollege: String(data.get("schoolCollege")), currentClass: String(data.get("currentClass")),
        address: nullable("address"), guardianName: String(data.get("guardianName")), guardianPhone: String(data.get("guardianPhone")),
        guardianRelationship: "father",
        ...(nullable("motherName") ? { motherName: String(data.get("motherName")) } : {}),
        ...(nullable("motherPhone") ? { motherPhone: String(data.get("motherPhone")) } : {}),
        smsRecipient: data.get("smsRecipient") === "mother" ? "mother" : data.get("smsRecipient") === "both" ? "both" : "father",
        preferredSmsLocale: data.get("preferredSmsLocale") === "en" ? "en" : "bn", internalNote: nullable("internalNote"),
      });
    }, bn ? "শিক্ষার্থীর তথ্য সংরক্ষিত হয়েছে।" : "Student details saved.");
  }

  function rowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, id: Id<"students">) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(id); }
  }

  if (!students || !requests || !scopes) return <PortalPageState state="loading" locale={locale} />;

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "শিক্ষার্থী রেকর্ড" : "Student records"}</p>
        <h1>{bn ? "শিক্ষার্থী" : "Students"}</h1>
        <p>{bn ? "কোর্স, ব্যাচ, বকেয়া ও প্রোফাইল এক জায়গা থেকে পরিচালনা করুন।" : "Manage course, batch, balance, and profile information from one workspace."}</p>
      </header>

      {message && <p className={`form-message ${message.ok ? "success" : "error"}`} role="status">{message.text}</p>}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--ink-mute)]" aria-hidden="true" />
            <Input className="ps-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={bn ? "নাম, আইডি, কোর্স বা ব্যাচ খুঁজুন" : "Search name, ID, course, or batch"} aria-label={bn ? "শিক্ষার্থী খুঁজুন" : "Search students"} />
          </div>
          <div className="flex gap-2" role="group" aria-label={bn ? "অবস্থা ফিল্টার" : "Status filter"}>
            {(["all", "active", "inactive"] as const).map((value) => <Button key={value} size="sm" variant={status === value ? "primary" : "secondary"} onClick={() => setStatus(value)}>{value === "all" ? (bn ? "সব" : "All") : value === "active" ? (bn ? "সক্রিয়" : "Active") : (bn ? "নিষ্ক্রিয়" : "Inactive")}</Button>)}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)]">
          <div className="hidden md:block"><Table>
            <TableHeader><TableRow>
              <TableHead>{bn ? "শিক্ষার্থী" : "Student"}</TableHead><TableHead>{bn ? "আইডি" : "ID"}</TableHead>
              <TableHead>{bn ? "কোর্স" : "Course"}</TableHead><TableHead>{bn ? "ব্যাচ" : "Batch"}</TableHead>
              <TableHead>{bn ? "শ্রেণি" : "Class"}</TableHead><TableHead>{bn ? "অভিভাবকের ফোন" : "Guardian phone"}</TableHead>
              <TableHead className="text-end">{bn ? "বকেয়া" : "Outstanding"}</TableHead><TableHead>{bn ? "অবস্থা" : "Status"}</TableHead><TableHead><span className="sr-only">{bn ? "অ্যাকশন" : "Actions"}</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>{filtered.map((student) => <TableRow key={student.studentId} tabIndex={0} role="button" className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus)]" onClick={() => setSelectedId(student.studentId)} onKeyDown={(event) => rowKeyDown(event, student.studentId)}>
              <TableCell><div className="flex min-w-44 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--canvas-subtle)] font-medium">{student.photoUrl ? <img className="size-full object-cover" src={student.photoUrl} alt="" /> : student.displayName.charAt(0)}</div><strong className="font-medium">{student.displayName}</strong></div></TableCell>
              <TableCell className="font-mono text-xs">{student.studentNumber}</TableCell>
              <TableCell>{bn ? student.courseNameBn : student.courseNameEn || "—"}</TableCell><TableCell>{bn ? student.batchNameBn : student.batchNameEn || "—"}</TableCell>
              <TableCell>{student.currentClass}</TableCell><TableCell>{student.guardianPhone}</TableCell>
              <TableCell className="text-end font-mono tabular-nums">{money(student.outstandingMinor, locale)}</TableCell>
              <TableCell><Badge variant={student.status === "active" ? "success" : "neutral"}>{student.status === "active" ? (bn ? "সক্রিয়" : "Active") : (bn ? "নিষ্ক্রিয়" : "Inactive")}</Badge></TableCell>
              <TableCell><Button size="icon" variant="ghost" aria-label={bn ? `${student.displayName} দেখুন` : `View ${student.displayName}`} onClick={(event) => { event.stopPropagation(); setSelectedId(student.studentId); }}><MoreHorizontal /></Button></TableCell>
            </TableRow>)}</TableBody>
          </Table></div>
          <div className="grid gap-3 p-4 md:hidden">
            {filtered.map((student) => <button key={student.studentId} type="button" className="flex min-h-44 w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]" onClick={() => setSelectedId(student.studentId)}>
              <span className="flex w-full items-start gap-3"><span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--canvas-subtle)] font-medium">{student.photoUrl ? <img className="size-full object-cover" src={student.photoUrl} alt="" /> : student.displayName.charAt(0)}</span><span className="min-w-0 flex-1"><strong className="block truncate">{student.displayName}</strong><span className="font-mono text-xs text-muted-foreground">{student.studentNumber}</span></span><Badge variant={student.status === "active" ? "success" : "neutral"}>{student.status === "active" ? (bn ? "সক্রিয়" : "Active") : (bn ? "নিষ্ক্রিয়" : "Inactive")}</Badge></span>
              <span className="grid w-full grid-cols-2 gap-3 text-sm"><span><span className="block text-xs text-muted-foreground">{bn ? "কোর্স" : "Course"}</span>{bn ? student.courseNameBn : student.courseNameEn || "—"}</span><span><span className="block text-xs text-muted-foreground">{bn ? "ব্যাচ" : "Batch"}</span>{bn ? student.batchNameBn : student.batchNameEn || "—"}</span><span><span className="block text-xs text-muted-foreground">{bn ? "শ্রেণি" : "Class"}</span>{student.currentClass}</span><span><span className="block text-xs text-muted-foreground">{bn ? "বকেয়া" : "Outstanding"}</span><span className="font-mono tabular-nums">{money(student.outstandingMinor, locale)}</span></span></span>
            </button>)}
          </div>
          {filtered.length === 0 && <p className="p-8 text-center text-sm text-[var(--ink-mute)]">{bn ? "কোনো শিক্ষার্থী পাওয়া যায়নি।" : "No students found."}</p>}
        </div>
      </section>

      <ResponsiveDetailDrawer
        open={Boolean(selectedId)}
        onOpenChange={(open) => { if (!open) { setSelectedId(null); setMessage(null); } }}
        title={selected?.displayName ?? (bn ? "শিক্ষার্থীর তথ্য" : "Student details")}
        description={selected ? <span className="inline-flex flex-wrap items-center gap-2">{selected.studentNumber}<Badge variant={selected.status === "active" ? "success" : "neutral"}>{selected.status === "active" ? (bn ? "সক্রিয়" : "Active") : (bn ? "নিষ্ক্রিয়" : "Inactive")}</Badge></span> : undefined}
        closeLabel={bn ? "বন্ধ করুন" : "Close"}
      >
          {selected === undefined ? <PortalPageState state="loading" locale={locale} /> : selected ? <form className="flex flex-col gap-6" onSubmit={submitProfile}>
            <div className="flex items-center gap-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--canvas-subtle)] text-lg font-medium">{selected.photoUrl ? <img className="size-full object-cover" src={selected.photoUrl} alt="" /> : selected.displayName.charAt(0)}</div><p className="text-sm text-[var(--ink-mute)]">{bn ? "শিক্ষার্থীর প্রোফাইল ও ভর্তি তথ্য" : "Student profile and enrolment details"}</p></div>

            <section className="flex flex-col gap-3"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{bn ? "কোর্স ও ব্যাচ" : "Course & batch"}</h2><p className="text-sm text-[var(--ink-mute)]">{activeEnrolment ? `${bn ? activeEnrolment.courseNameBn : activeEnrolment.courseNameEn} · ${bn ? activeEnrolment.batchNameBn : activeEnrolment.batchNameEn}` : (bn ? "কোনো সক্রিয় ভর্তি নেই" : "No active enrolment")}</p></div><Button variant="secondary" size="sm" onClick={openTransfer}><ArrowRightLeft data-icon="inline-start" />{activeEnrolment ? (bn ? "পরিবর্তন" : "Change") : (bn ? "ভর্তি করুন" : "Enrol")}</Button></div>{activeEnrolment && <dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[var(--canvas-soft)] p-3 text-sm"><div><dt className="text-[var(--ink-mute)]">{bn ? "সম্মত মাসিক" : "Agreed monthly"}</dt><dd className="font-mono">{activeEnrolment.agreedMonthlyAmountMinor ? money(activeEnrolment.agreedMonthlyAmountMinor, locale) : "—"}</dd></div><div><dt className="text-[var(--ink-mute)]">{bn ? "ভর্তির তারিখ" : "Enrolled on"}</dt><dd>{activeEnrolment.enrolledOn}</dd></div></dl>}</section>
            <Separator />

            <section className="flex flex-col gap-3"><h2 className="font-semibold">{bn ? "ব্যক্তিগত তথ্য" : "Personal information"}</h2><FieldGroup className="grid sm:grid-cols-2">
              <Field><FieldLabel htmlFor="student-image">{bn ? "ছবি" : "Image"}</FieldLabel><Input id="student-image" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><FieldDescription>{bn ? "সর্বোচ্চ ৮ MB" : "Up to 8 MB"}</FieldDescription></Field>
              <Field><FieldLabel htmlFor="student-name">{bn ? "অফিসিয়াল নাম" : "Official name"}</FieldLabel><Input id="student-name" name="displayName" defaultValue={selected.displayName} required /></Field>
              <Field><FieldLabel htmlFor="student-email">Google email</FieldLabel><Input id="student-email" name="loginEmail" type="email" defaultValue={selected.loginEmail} required /></Field>
              <Field><FieldLabel htmlFor="student-phone">{bn ? "ফোন" : "Phone"}</FieldLabel><Input id="student-phone" name="phone" defaultValue={selected.phone ?? ""} /></Field>
              <Field><FieldLabel htmlFor="student-school">{bn ? "স্কুল/কলেজ" : "School/college"}</FieldLabel><Input id="student-school" name="schoolCollege" defaultValue={selected.schoolCollege} required /></Field>
              <Field><FieldLabel htmlFor="student-class">{bn ? "শ্রেণি" : "Class"}</FieldLabel><Input id="student-class" name="currentClass" defaultValue={selected.currentClass} required /></Field>
              <Field className="sm:col-span-2"><FieldLabel htmlFor="student-address">{bn ? "ঠিকানা" : "Address"}</FieldLabel><Textarea id="student-address" name="address" defaultValue={selected.address ?? ""} /></Field>
            </FieldGroup></section>
            <Separator />

            <section className="flex flex-col gap-3"><h2 className="font-semibold">{bn ? "অভিভাবক ও SMS" : "Guardians & SMS"}</h2><FieldGroup className="grid sm:grid-cols-2">
              <Field><FieldLabel htmlFor="father-name">{bn ? "বাবার নাম" : "Father's name"}</FieldLabel><Input id="father-name" name="guardianName" defaultValue={selected.guardianName} required /></Field>
              <Field><FieldLabel htmlFor="father-phone">{bn ? "বাবার ফোন" : "Father's phone"}</FieldLabel><Input id="father-phone" name="guardianPhone" defaultValue={selected.guardianPhone} required /></Field>
              <Field><FieldLabel htmlFor="mother-name">{bn ? "মায়ের নাম" : "Mother's name"}</FieldLabel><Input id="mother-name" name="motherName" defaultValue={selected.motherName ?? ""} /><FieldDescription>{bn ? "পুরোনো রেকর্ডের জন্য ঐচ্ছিক" : "Optional for legacy records"}</FieldDescription></Field>
              <Field><FieldLabel htmlFor="mother-phone">{bn ? "মায়ের ফোন" : "Mother's phone"}</FieldLabel><Input id="mother-phone" name="motherPhone" defaultValue={selected.motherPhone ?? ""} /><FieldDescription>{bn ? "পুরোনো রেকর্ডের জন্য ঐচ্ছিক" : "Optional for legacy records"}</FieldDescription></Field>
              <Field><FieldLabel>{bn ? "SMS প্রাপক" : "SMS recipient"}</FieldLabel><Select name="smsRecipient" defaultValue={selected.smsRecipient}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="father">{bn ? "বাবা" : "Father"}</SelectItem><SelectItem value="mother">{bn ? "মা" : "Mother"}</SelectItem><SelectItem value="both">{bn ? "দুজনই" : "Both"}</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel>{bn ? "SMS ভাষা" : "SMS language"}</FieldLabel><Select name="preferredSmsLocale" defaultValue={selected.preferredSmsLocale}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="bn">বাংলা</SelectItem><SelectItem value="en">English</SelectItem></SelectGroup></SelectContent></Select></Field>
            </FieldGroup></section>
            <Separator />

            <section className="flex flex-col gap-3"><div className="flex items-center justify-between"><div><h2 className="font-semibold">{bn ? "ফি সারাংশ" : "Fee summary"}</h2><p className="text-sm text-[var(--ink-mute)]">{bn ? "বিস্তারিত আর্থিক কাজ Finance-এ পরিচালিত হয়।" : "Detailed financial work remains in Finance."}</p></div><Button variant="link" asChild><a href={`/${locale}/owner/finance?student=${selected.studentId}`}>{bn ? "Finance খুলুন" : "Open Finance"}<ExternalLink data-icon="inline-end" /></a></Button></div><dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-md)] bg-[var(--canvas-soft)] p-3 text-sm sm:grid-cols-3"><div><dt className="text-[var(--ink-mute)]">{bn ? "মোট চার্জ" : "Charged"}</dt><dd className="font-mono">{money(selected.financialSummary.totalChargedMinor, locale)}</dd></div><div><dt className="text-[var(--ink-mute)]">{bn ? "পরিশোধিত" : "Paid"}</dt><dd className="font-mono">{money(selected.financialSummary.totalPaidMinor, locale)}</dd></div><div><dt className="text-[var(--ink-mute)]">{bn ? "বকেয়া" : "Outstanding"}</dt><dd className="font-mono">{money(selected.financialSummary.outstandingMinor, locale)}</dd></div><div><dt className="text-[var(--ink-mute)]">{bn ? "মেয়াদোত্তীর্ণ" : "Overdue"}</dt><dd className="font-mono text-[var(--danger)]">{money(selected.financialSummary.overdueMinor, locale)}</dd></div><div><dt className="text-[var(--ink-mute)]">{bn ? "অগ্রিম" : "Advance"}</dt><dd className="font-mono">{money(selected.financialSummary.advanceCreditMinor, locale)}</dd></div></dl></section>
            <Separator />

            <section className="flex flex-col gap-3"><h2 className="font-semibold">{bn ? "পোর্টাল অ্যাক্সেস" : "Portal access"}</h2><div><Badge variant={selected.portalAccountStatus === "active" ? "success" : selected.portalAccountStatus === "reserved" ? "warning" : "neutral"}>{selected.portalAccountStatus ?? (bn ? "অ্যাকাউন্ট নেই" : "No account")}</Badge></div></section>
            <Separator />

            <section className="flex flex-col gap-3"><h2 className="font-semibold">{bn ? "ভর্তির ইতিহাস" : "Enrolment history"}</h2><div className="flex flex-col gap-2">{selected.enrolments.map((row) => <div key={row.enrolmentId} className="rounded-[var(--radius-md)] border border-[var(--border)] p-3 text-sm"><div className="flex justify-between gap-3"><strong>{bn ? row.courseNameBn : row.courseNameEn} · {bn ? row.batchNameBn : row.batchNameEn}</strong><Badge variant={row.status === "active" ? "success" : "neutral"}>{row.status}</Badge></div><p className="mt-1 text-[var(--ink-mute)]">{row.enrolledOn}{row.endedOn ? ` → ${row.endedOn}` : ""}</p></div>)}</div></section>
            <Separator />

            <Field><FieldLabel htmlFor="student-note">{bn ? "অভ্যন্তরীণ নোট" : "Internal notes"}</FieldLabel><Textarea id="student-note" name="internalNote" defaultValue={selected.internalNote ?? ""} /></Field>
            <SheetFooter className="sticky bottom-0 -mx-4 border-t border-[var(--border)] bg-[var(--canvas)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0"><Button type="submit" loading={busy}>{bn ? "পরিবর্তন সংরক্ষণ" : "Save changes"}</Button></SheetFooter>
          </form> : null}
      </ResponsiveDetailDrawer>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent><form className="flex flex-col gap-5" onSubmit={submitTransfer}>
          <DialogHeader><DialogTitle>{activeEnrolment ? (bn ? "কোর্স ও ব্যাচ পরিবর্তন" : "Change course and batch") : (bn ? "কোর্সে ভর্তি করুন" : "Enrol in a course")}</DialogTitle><DialogDescription>{activeEnrolment ? (bn ? "বর্তমান ভর্তি transferred হবে। আগের ফি, পেমেন্ট, উপস্থিতি ও ফলাফল অপরিবর্তিত থাকবে।" : "The current enrolment will be marked transferred. Previous fees, payments, attendance, and results remain unchanged.") : (bn ? "নতুন সক্রিয় ভর্তি তৈরি করুন।" : "Create a new active enrolment.")}</DialogDescription></DialogHeader>
          <FieldGroup>
            <Field><FieldLabel>{bn ? "কোর্স" : "Course"}</FieldLabel><Select value={courseId} onValueChange={(value) => { setCourseId(value as Id<"courses">); setBatchId(""); }}><SelectTrigger><SelectValue placeholder={bn ? "কোর্স নির্বাচন" : "Select course"} /></SelectTrigger><SelectContent><SelectGroup>{scopes.courses.map((course) => <SelectItem key={course.courseId} value={course.courseId}>{bn ? course.nameBn : course.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
            <Field><FieldLabel>{bn ? "ব্যাচ" : "Batch"}</FieldLabel><Select value={batchId} onValueChange={(value) => setBatchId(value as Id<"batches">)} disabled={!courseId}><SelectTrigger><SelectValue placeholder={bn ? "ব্যাচ নির্বাচন" : "Select batch"} /></SelectTrigger><SelectContent><SelectGroup>{availableBatches.map((batch) => <SelectItem key={batch.batchId} value={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
            <Field><FieldLabel htmlFor="transfer-monthly">{bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)"}</FieldLabel><Input id="transfer-monthly" type="number" min="0.01" step="0.01" required value={monthlyFee} onChange={(event) => setMonthlyFee(event.target.value)} /><FieldDescription>{bn ? "বর্তমান মাসিক ফি থেকে আগে থেকেই পূরণ করা হয়েছে।" : "Prefilled from the current monthly fee."}</FieldDescription></Field>
            <Field><FieldLabel htmlFor="transfer-date">{bn ? "কার্যকর তারিখ" : "Effective date"}</FieldLabel><DatePicker id="transfer-date" value={effectiveDate} onChange={setEffectiveDate} locale={locale} ariaLabel={bn ? "কার্যকর তারিখ বেছে নিন" : "Choose effective date"} required /></Field>
            {message && !message.ok && <FieldError>{message.text}</FieldError>}
          </FieldGroup>
          <DialogFooter><Button variant="secondary" onClick={() => setTransferOpen(false)}>{bn ? "বাতিল" : "Cancel"}</Button><Button type="submit" loading={busy} disabled={!courseId || !batchId || !monthlyFee}>{activeEnrolment ? (bn ? "পরিবর্তন নিশ্চিত করুন" : "Confirm change") : (bn ? "ভর্তি নিশ্চিত করুন" : "Confirm enrolment")}</Button></DialogFooter>
        </form></DialogContent>
      </Dialog>

      {requests.page.length > 0 && <section className="mt-8 flex flex-col gap-3"><h2 className="text-lg font-semibold">{bn ? "অপেক্ষমাণ প্রোফাইল অনুরোধ" : "Pending profile requests"}</h2>{requests.page.map((request) => <div key={request.requestId} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{request.fieldKey}</strong><p className="text-sm text-[var(--ink-mute)]">{request.oldValue} → {request.requestedValue}</p></div><div className="flex gap-2"><Button size="sm" loading={busy} onClick={() => void run(() => review({ requestId: request.requestId, decision: "approved" }), bn ? "অনুমোদিত হয়েছে।" : "Request approved.")}>{bn ? "অনুমোদন" : "Approve"}</Button><Button size="sm" variant="danger" loading={busy} onClick={() => void run(() => review({ requestId: request.requestId, decision: "rejected" }), bn ? "প্রত্যাখ্যাত হয়েছে।" : "Request rejected.")}>{bn ? "প্রত্যাখ্যান" : "Reject"}</Button></div></div>)}</section>}
    </>
  );
}
