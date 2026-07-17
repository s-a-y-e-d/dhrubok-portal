"use client";

import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import { DatePicker } from "@/components/portal/DatePicker";
import { OwnerReviewWorkspace } from "../review/OwnerReviewWorkspace";
import { OwnerMarksPanel } from "./OwnerMarksPanel";

type Locale = "bn" | "en";
type ExamMode = "mcq" | "written" | "both";
type SubjectDraft = {
  subjectId: Id<"subjects">;
  mode: ExamMode;
  mcqFull: string;
  writtenFull: string;
  pass: string;
  teacherId: string;
  sortOrder: number;
};

function copy(locale: Locale) {
  const bn = locale === "bn";
  return {
    exams: bn ? "পরীক্ষা" : "Exams",
    create: bn ? "পরীক্ষা তৈরি করুন" : "Create exam",
    description: bn
      ? "পরীক্ষার সময়সূচি, নম্বর ও ফলাফল এক জায়গা থেকে পরিচালনা করুন।"
      : "Manage schedules, marks, review, and publication from one place.",
  };
}

function formatMinutes(value?: number) {
  if (value === undefined) return "—";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function OwnerExamListPage({ locale }: { locale: Locale }) {
  const t = copy(locale);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const result = useQuery(api.exams.ownerWorkflow.listOwner, {
    paginationOpts: { numItems: 100, cursor: null },
    search: search || undefined,
    status: status || undefined,
  });
  return (
    <div className="flex flex-col gap-6">
      <header className="portal-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {locale === "bn" ? "অফলাইন পরীক্ষা" : "Offline exams"}
          </p>
          <h1 className="text-2xl font-semibold">{t.exams}</h1>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/owner/exams/create`}>
            <Plus data-icon="inline-start" />
            {t.create}
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "bn" ? "পরীক্ষার তালিকা" : "Exam list"}
          </CardTitle>
          <CardDescription>
            {locale === "bn"
              ? "নাম, নম্বর বা অবস্থা দিয়ে খুঁজুন।"
              : "Search by name or number and filter by status."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <Field>
              <FieldLabel className="sr-only" htmlFor="exam-search">
                {locale === "bn" ? "পরীক্ষা খুঁজুন" : "Search exams"}
              </FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exam-search"
                  className="ps-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    locale === "bn"
                      ? "নাম বা পরীক্ষার নম্বর"
                      : "Name or exam number"
                  }
                />
              </div>
            </Field>
            <Select
              value={status || "all"}
              onValueChange={(value) => setStatus(value === "all" ? "" : value)}
            >
              <SelectTrigger aria-label={locale === "bn" ? "অবস্থা" : "Status"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">
                    {locale === "bn" ? "সব অবস্থা" : "All statuses"}
                  </SelectItem>
                  <SelectItem value="scheduled">
                    {locale === "bn" ? "নির্ধারিত" : "Scheduled"}
                  </SelectItem>
                  <SelectItem value="marks_entry">
                    {locale === "bn" ? "নম্বর চলছে" : "Marks in progress"}
                  </SelectItem>
                  <SelectItem value="ready_for_review">
                    {locale === "bn"
                      ? "পর্যালোচনার জন্য প্রস্তুত"
                      : "Ready for review"}
                  </SelectItem>
                  <SelectItem value="published">
                    {locale === "bn" ? "প্রকাশিত" : "Published"}
                  </SelectItem>
                  <SelectItem value="reopened">
                    {locale === "bn" ? "পুনরায় খোলা" : "Reopened"}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {result === undefined ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : result.page.length ? (
            <><div className="hidden overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)] md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {locale === "bn" ? "পরীক্ষা" : "Exam"}
                    </TableHead>
                    <TableHead>{locale === "bn" ? "ব্যাচ" : "Batch"}</TableHead>
                    <TableHead>
                      {locale === "bn" ? "সময়" : "Schedule"}
                    </TableHead>
                    <TableHead>
                      {locale === "bn" ? "অবস্থা" : "Status"}
                    </TableHead>
                    <TableHead className="text-end">
                      {locale === "bn" ? "কাজ" : "Action"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.page.map(({ exam, batch, course }) => (
                    <TableRow key={exam._id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <strong>
                            {locale === "bn" ? exam.nameBn : exam.nameEn}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            {exam.examNumber} · {exam.subjectCount ?? 0}{" "}
                            {locale === "bn" ? "বিষয়" : "subjects"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>
                            {batch
                              ? locale === "bn"
                                ? batch.nameBn
                                : batch.nameEn
                              : "—"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {course
                              ? locale === "bn"
                                ? course.nameBn
                                : course.nameEn
                              : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {exam.examDate}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {formatMinutes(exam.startsAtMinutes)}–
                          {formatMinutes(exam.endsAtMinutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            exam.status === "published"
                              ? "info"
                              : exam.status === "ready_for_review"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {exam.status.replaceAll("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/${locale}/owner/exams/${exam._id}`}>
                            {locale === "bn" ? "খুলুন" : "Open"}
                            <ArrowRight data-icon="inline-end" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div><div className="grid gap-3 md:hidden">{result.page.map(({ exam, batch, course }) => <Link key={exam._id} href={`/${locale}/owner/exams/${exam._id}`} className="flex min-h-44 flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate">{locale === "bn" ? exam.nameBn : exam.nameEn}</strong><span className="font-mono text-xs text-muted-foreground">{exam.examNumber} · {exam.subjectCount ?? 0} {locale === "bn" ? "বিষয়" : "subjects"}</span></span><Badge variant={exam.status === "published" ? "info" : exam.status === "ready_for_review" ? "warning" : "neutral"}>{exam.status.replaceAll("_", " ")}</Badge></span><span className="grid grid-cols-2 gap-3 text-sm"><span><span className="block text-xs text-muted-foreground">{locale === "bn" ? "ব্যাচ" : "Batch"}</span>{batch ? (locale === "bn" ? batch.nameBn : batch.nameEn) : "—"}<span className="block text-xs text-muted-foreground">{course ? (locale === "bn" ? course.nameBn : course.nameEn) : ""}</span></span><span><span className="block text-xs text-muted-foreground">{locale === "bn" ? "সময়" : "Schedule"}</span>{exam.examDate}<span className="block text-xs text-muted-foreground">{formatMinutes(exam.startsAtMinutes)}–{formatMinutes(exam.endsAtMinutes)}</span></span></span><span className="mt-auto flex items-center justify-end gap-1 border-t border-[var(--border-muted)] pt-3 text-sm font-medium">{locale === "bn" ? "খুলুন" : "Open"}<ArrowRight /></span></Link>)}</div></>
          ) : (
            <EmptyState
              title={locale === "bn" ? "কোনো পরীক্ষা নেই" : "No exams yet"}
              description={
                locale === "bn"
                  ? "প্রথম পরীক্ষাটি সম্পূর্ণভাবে তৈরি করুন।"
                  : "Create the first complete scheduled exam."
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OwnerExamCreatePage({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [batchId, setBatchId] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [examType, setExamType] = useState("monthly");
  const [subjects, setSubjects] = useState<Record<string, SubjectDraft>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const options = useQuery(api.exams.ownerWorkflow.creationOptions, {
    batchId: batchId ? (batchId as Id<"batches">) : undefined,
  });
  const createExam = useMutation(api.exams.ownerWorkflow.createComplete);
  const selected = options?.selected;
  const selectedSubjects = Object.values(subjects).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const startMinutes = useMemo(() => {
    const [hours, minutes] = startTime.split(":").map(Number);
    return hours * 60 + minutes;
  }, [startTime]);
  const conflict = useQuery(
    api.exams.ownerWorkflow.previewConflict,
    batchId &&
      examDate &&
      Number.isInteger(startMinutes) &&
      Number(duration) >= 15
      ? {
          batchId: batchId as Id<"batches">,
          examDate,
          startsAtMinutes: startMinutes,
          durationMinutes: Number(duration),
        }
      : "skip",
  );

  function toggleSubject(
    row: NonNullable<typeof selected>["subjects"][number],
    checked: boolean,
  ) {
    setSubjects((current) => {
      const next = { ...current };
      if (!checked) delete next[row.subject._id];
      else
        next[row.subject._id] = {
          subjectId: row.subject._id,
          mode: "written",
          mcqFull: "",
          writtenFull: "100",
          pass: "40",
          teacherId: row.teachers[0]?.teacherId ?? "",
          sortOrder: row.sortOrder,
        };
      return next;
    });
  }

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const examId = await createExam({
        batchId: batchId as Id<"batches">,
        nameBn,
        nameEn,
        examDate,
        examType: examType as
          "weekly" | "monthly" | "model_test" | "term" | "final" | "other",
        startsAtMinutes: startMinutes,
        durationMinutes: Number(duration),
        excludedStudentIds: [...excluded] as Id<"students">[],
        subjects: selectedSubjects.map((subject) => {
          const mcq =
            subject.mode === "written"
              ? undefined
              : Number(subject.mcqFull) * 100;
          const written =
            subject.mode === "mcq"
              ? undefined
              : Number(subject.writtenFull) * 100;
          return {
            teacherId: subject.teacherId as Id<"teachers">,
            rule: {
              subjectId: subject.subjectId,
              mode: subject.mode,
              mcqFullMarksScaled: mcq,
              writtenFullMarksScaled: written,
              totalFullMarksScaled: (mcq ?? 0) + (written ?? 0),
              passMarksScaled: Number(subject.pass) * 100,
              isRequired: true,
              sortOrder: subject.sortOrder,
            },
          };
        }),
      });
      router.push(`/${locale}/owner/exams/${examId}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create exam",
      );
    } finally {
      setSaving(false);
    }
  }

  const canContinue =
    step === 1
      ? Boolean(
          batchId &&
          nameBn.trim() &&
          nameEn.trim() &&
          examDate &&
          Number(duration) >= 15 &&
          !conflict,
        )
      : step === 2
        ? selectedSubjects.length > 0 &&
          selectedSubjects.every((row) => {
            const mcq = row.mode === "written" ? 0 : Number(row.mcqFull);
            const written = row.mode === "mcq" ? 0 : Number(row.writtenFull);
            return (
              Boolean(row.teacherId) &&
              mcq + written > 0 &&
              Number(row.pass) >= 0 &&
              Number(row.pass) <= mcq + written
            );
          })
        : step === 3
          ? Boolean(
              selected?.candidates.length &&
              excluded.size < selected.candidates.length,
            )
          : true;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="portal-page-header flex flex-col gap-3">
        <Button asChild variant="ghost" className="self-start">
          <Link href={`/${locale}/owner/exams`}>
            <ArrowLeft data-icon="inline-start" />
            {locale === "bn" ? "পরীক্ষার তালিকা" : "Exam list"}
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">
            {locale === "bn" ? "পরীক্ষা তৈরি করুন" : "Create exam"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {locale === "bn"
              ? "সব তথ্য যাচাই করে একবারে পরীক্ষা তৈরি হবে।"
              : "Nothing is saved until you review and create the complete exam."}
          </p>
        </div>
        <Progress value={step * 25} aria-label={`Step ${step} of 4`} />
      </header>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {locale === "bn" ? "পরীক্ষা তৈরি হয়নি" : "Exam was not created"}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              1. {locale === "bn" ? "ব্যাচ ও সময়সূচি" : "Batch and schedule"}
            </CardTitle>
            <CardDescription>
              {locale === "bn"
                ? "কোর্স ব্যাচ থেকে নির্ধারিত হবে।"
                : "The course is derived from the batch."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>{locale === "bn" ? "ব্যাচ" : "Batch"}</FieldLabel>
                <Select
                  value={batchId}
                  onValueChange={(value) => {
                    setBatchId(value);
                    setSubjects({});
                    setExcluded(new Set());
                  }}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        locale === "bn"
                          ? "ব্যাচ নির্বাচন করুন"
                          : "Select a batch"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options?.batches.map(({ batch, course }) => (
                        <SelectItem key={batch._id} value={batch._id}>
                          {locale === "bn" ? batch.nameBn : batch.nameEn} ·{" "}
                          {locale === "bn" ? course.nameBn : course.nameEn}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="exam-name-bn">বাংলা নাম</FieldLabel>
                  <Input
                    id="exam-name-bn"
                    value={nameBn}
                    onChange={(event) => setNameBn(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="exam-name-en">English name</FieldLabel>
                  <Input
                    id="exam-name-en"
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <Field>
                  <FieldLabel>{locale === "bn" ? "ধরন" : "Type"}</FieldLabel>
                  <Select value={examType} onValueChange={setExamType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {[
                          "weekly",
                          "monthly",
                          "model_test",
                          "term",
                          "final",
                          "other",
                        ].map((value) => (
                          <SelectItem key={value} value={value}>
                            {value.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="exam-date">
                    {locale === "bn" ? "তারিখ" : "Date"}
                  </FieldLabel>
                  <DatePicker
                    id="exam-date"
                    value={examDate}
                    onChange={setExamDate}
                    locale={locale}
                    ariaLabel={locale === "bn" ? "পরীক্ষার তারিখ" : "Exam date"}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="exam-start">
                    {locale === "bn" ? "শুরুর সময়" : "Start time"}
                  </FieldLabel>
                  <Input
                    id="exam-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="exam-duration">
                    {locale === "bn" ? "সময়কাল (মিনিট)" : "Duration (minutes)"}
                  </FieldLabel>
                  <Input
                    id="exam-duration"
                    type="number"
                    min={15}
                    max={720}
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                  />
                </Field>
              </div>
              {conflict ? (
                <Alert variant="destructive">
                  <AlertTitle>
                    {locale === "bn"
                      ? "সময়সূচিতে সংঘর্ষ আছে"
                      : "Schedule conflict"}
                  </AlertTitle>
                  <AlertDescription>
                    {locale === "bn"
                      ? "এই ব্যাচের একই সময়ে আরেকটি ক্লাস বা পরীক্ষা আছে। সময় পরিবর্তন করুন।"
                      : `This batch already has a ${conflict.kind} during the selected time. Choose another time.`}
                  </AlertDescription>
                </Alert>
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              2.{" "}
              {locale === "bn"
                ? "বিষয়, নম্বর ও শিক্ষক"
                : "Subjects, marks, and teachers"}
            </CardTitle>
            <CardDescription>
              {locale === "bn"
                ? "এই ব্যাচের কোর্সে থাকা বিষয়গুলো থেকে নির্বাচন করুন।"
                : "Choose only from the batch course subjects."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {selected?.subjects.map((row) => {
              const draft = subjects[row.subject._id];
              return (
                <Card key={row.subject._id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={Boolean(draft)}
                        onCheckedChange={(value) =>
                          toggleSubject(row, value === true)
                        }
                        id={`subject-${row.subject._id}`}
                      />
                      <div>
                        <CardTitle className="text-base">
                          <label htmlFor={`subject-${row.subject._id}`}>
                            {locale === "bn"
                              ? row.subject.nameBn
                              : row.subject.nameEn}
                          </label>
                        </CardTitle>
                        <CardDescription>{row.subject.code}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {draft ? (
                    <CardContent>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>
                            {locale === "bn" ? "ধরন" : "Format"}
                          </FieldLabel>
                          <ToggleGroup
                            type="single"
                            value={draft.mode}
                            onValueChange={(value) =>
                              value &&
                              setSubjects((current) => ({
                                ...current,
                                [row.subject._id]: {
                                  ...draft,
                                  mode: value as ExamMode,
                                },
                              }))
                            }
                          >
                            <ToggleGroupItem value="mcq">MCQ</ToggleGroupItem>
                            <ToggleGroupItem value="written">
                              {locale === "bn" ? "লিখিত" : "Written"}
                            </ToggleGroupItem>
                            <ToggleGroupItem value="both">
                              {locale === "bn" ? "উভয়" : "Both"}
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                        <div className="grid gap-4 md:grid-cols-4">
                          {draft.mode !== "written" ? (
                            <Field>
                              <FieldLabel>
                                MCQ{" "}
                                {locale === "bn" ? "পূর্ণমান" : "full marks"}
                              </FieldLabel>
                              <Input
                                type="number"
                                min={1}
                                value={draft.mcqFull}
                                onChange={(event) =>
                                  setSubjects((current) => ({
                                    ...current,
                                    [row.subject._id]: {
                                      ...draft,
                                      mcqFull: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </Field>
                          ) : null}
                          {draft.mode !== "mcq" ? (
                            <Field>
                              <FieldLabel>
                                {locale === "bn"
                                  ? "লিখিত পূর্ণমান"
                                  : "Written full marks"}
                              </FieldLabel>
                              <Input
                                type="number"
                                min={1}
                                value={draft.writtenFull}
                                onChange={(event) =>
                                  setSubjects((current) => ({
                                    ...current,
                                    [row.subject._id]: {
                                      ...draft,
                                      writtenFull: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </Field>
                          ) : null}
                          <Field>
                            <FieldLabel>
                              {locale === "bn" ? "পাস নম্বর" : "Pass marks"}
                            </FieldLabel>
                            <Input
                              type="number"
                              min={0}
                              value={draft.pass}
                              onChange={(event) =>
                                setSubjects((current) => ({
                                  ...current,
                                  [row.subject._id]: {
                                    ...draft,
                                    pass: event.target.value,
                                  },
                                }))
                              }
                            />
                          </Field>
                          <Field>
                            <FieldLabel>
                              {locale === "bn"
                                ? "দায়িত্বপ্রাপ্ত শিক্ষক"
                                : "Responsible teacher"}
                            </FieldLabel>
                            <Select
                              value={draft.teacherId}
                              onValueChange={(value) =>
                                setSubjects((current) => ({
                                  ...current,
                                  [row.subject._id]: {
                                    ...draft,
                                    teacherId: value,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    locale === "bn"
                                      ? "শিক্ষক নেই"
                                      : "No teacher"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {row.teachers.map((teacher) => (
                                    <SelectItem
                                      key={teacher.teacherId}
                                      value={teacher.teacherId}
                                    >
                                      {teacher.displayName}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        {!row.teachers.length ? (
                          <Alert variant="destructive">
                            <AlertTitle>
                              {locale === "bn"
                                ? "শিক্ষক প্রয়োজন"
                                : "Teacher required"}
                            </AlertTitle>
                            <AlertDescription>
                              {locale === "bn"
                                ? "এই বিষয়ের জন্য আগে শিক্ষক নির্ধারণ করুন।"
                                : "Assign a teacher to this subject before creating the exam."}
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </FieldGroup>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              3. {locale === "bn" ? "শিক্ষার্থী" : "Students"}
            </CardTitle>
            <CardDescription>
              {selected
                ? `${selected.candidates.length - excluded.size} ${locale === "bn" ? "জন অন্তর্ভুক্ত" : "included"} · ${excluded.size} ${locale === "bn" ? "জন বাদ" : "excluded"}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {selected?.candidates.map(({ student }) => {
                const isExcluded = excluded.has(student._id);
                return (
                  <label
                    key={student._id}
                    className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas-soft)] p-3 transition-colors hover:bg-[var(--canvas-subtle)]"
                  >
                    <Checkbox
                      checked={!isExcluded}
                      onCheckedChange={(value) =>
                        setExcluded((current) => {
                          const next = new Set(current);
                          if (value === true) next.delete(student._id);
                          else next.add(student._id);
                          return next;
                        })
                      }
                    />
                    <span>
                      <strong>{student.displayName}</strong>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {student.studentNumber}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              4. {locale === "bn" ? "পর্যালোচনা ও তৈরি" : "Review and create"}
            </CardTitle>
            <CardDescription>
              {locale === "bn"
                ? "তৈরি করার আগে সব তথ্য যাচাই করুন।"
                : "Confirm the complete exam before creating it."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <strong>
                {locale === "bn" ? "ব্যাচ ও সময়" : "Batch and schedule"}
              </strong>
              <p className="text-sm text-muted-foreground">
                {selected
                  ? locale === "bn"
                    ? selected.batch.nameBn
                    : selected.batch.nameEn
                  : "—"}
                <br />
                {examDate} · {startTime} · {duration} min
              </p>
            </div>
            <div>
              <strong>
                {locale === "bn"
                  ? "বিষয় ও শিক্ষার্থী"
                  : "Subjects and students"}
              </strong>
              <p className="text-sm text-muted-foreground">
                {selectedSubjects.length}{" "}
                {locale === "bn" ? "বিষয়" : "subjects"}
                <br />
                {(selected?.candidates.length ?? 0) - excluded.size}{" "}
                {locale === "bn" ? "শিক্ষার্থী" : "students"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="secondary"
          disabled={step === 1 || saving}
          onClick={() => setStep((value) => Math.max(1, value - 1))}
        >
          <ArrowLeft data-icon="inline-start" />
          {locale === "bn" ? "পেছনে" : "Back"}
        </Button>
        {step < 4 ? (
          <Button
            disabled={!canContinue}
            onClick={() => setStep((value) => Math.min(4, value + 1))}
          >
            {locale === "bn" ? "চালিয়ে যান" : "Continue"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Check data-icon="inline-start" />
            )}
            {saving
              ? locale === "bn"
                ? "তৈরি হচ্ছে…"
                : "Creating…"
              : locale === "bn"
                ? "পরীক্ষা তৈরি করুন"
                : "Create exam"}
          </Button>
        )}
      </div>
    </div>
  );
}

export function OwnerExamDetailPage({
  locale,
  examId,
}: {
  locale: Locale;
  examId: Id<"exams">;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const detail = useQuery(api.exams.ownerWorkflow.ownerDetail, { examId });
  const tab = params.get("tab") ?? "overview";
  if (detail === undefined)
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  const activeSubject =
    (params.get("subject") as Id<"examSubjects"> | null) ??
    detail.subjects[0]?.subject._id;
  const setTab = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", value);
    router.replace(`?${next.toString()}`);
  };
  return (
    <div className="flex flex-col gap-6">
      <header className="portal-page-header flex flex-col gap-3">
        <Button asChild variant="ghost" className="self-start">
          <Link href={`/${locale}/owner/exams`}>
            <ArrowLeft data-icon="inline-start" />
            {locale === "bn" ? "পরীক্ষার তালিকা" : "Exam list"}
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {detail.exam.examNumber}
            </p>
            <h1 className="text-2xl font-semibold">
              {locale === "bn" ? detail.exam.nameBn : detail.exam.nameEn}
            </h1>
            <p className="text-sm text-muted-foreground">
              {locale === "bn" ? detail.batch?.nameBn : detail.batch?.nameEn} ·{" "}
              {detail.exam.examDate} ·{" "}
              {formatMinutes(detail.exam.startsAtMinutes)}–
              {formatMinutes(detail.exam.endsAtMinutes)}
            </p>
          </div>
          <Badge
            variant={
              detail.exam.status === "published"
                ? "info"
                : detail.exam.status === "ready_for_review"
                  ? "warning"
                  : detail.exam.status === "marks_entry"
                    ? "info"
                    : "neutral"
            }
          >
            {detail.exam.status.replaceAll("_", " ")}
          </Badge>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            {locale === "bn" ? "সংক্ষিপ্ত বিবরণ" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="marks">
            {locale === "bn" ? "নম্বর" : "Marks"}
          </TabsTrigger>
          <TabsTrigger value="review">
            {locale === "bn" ? "পর্যালোচনা" : "Review & publish"}
          </TabsTrigger>
          <TabsTrigger value="results">
            {locale === "bn" ? "ফলাফল" : "Results"}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {locale === "bn" ? "সময়সূচি" : "Schedule"}
                </CardTitle>
                <CardDescription>
                  {locale === "bn"
                    ? "সময়সূচি পাতায় এই পরীক্ষাটি দেখা যাবে।"
                    : "This exam appears on the owner Schedule."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CalendarDays className="size-5 text-muted-foreground" />
                  <span>
                    {detail.exam.examDate}
                    <br />
                    {formatMinutes(detail.exam.startsAtMinutes)}–
                    {formatMinutes(detail.exam.endsAtMinutes)} (
                    {detail.exam.durationMinutes} min)
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{locale === "bn" ? "পরিধি" : "Scope"}</CardTitle>
                <CardDescription>
                  {detail.candidateCount}{" "}
                  {locale === "bn" ? "শিক্ষার্থী" : "students"} ·{" "}
                  {detail.subjects.length}{" "}
                  {locale === "bn" ? "বিষয়" : "subjects"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {detail.subjects.map(({ subject, subjectRecord, teacher }) => (
                  <div
                    key={subject._id}
                    className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas-soft)] p-3"
                  >
                    <span>
                      {locale === "bn"
                        ? subjectRecord?.nameBn
                        : subjectRecord?.nameEn}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {teacher?.displayName ?? "—"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="marks">
          {activeSubject ? (
            <OwnerMarksPanel
              locale={locale}
              examId={examId}
              subjects={detail.subjects}
              activeSubjectId={activeSubject}
            />
          ) : (
            <EmptyState
              title={locale === "bn" ? "কোনো বিষয় নেই" : "No subjects"}
            />
          )}
        </TabsContent>
        <TabsContent value="review">
          <OwnerReviewWorkspace locale={locale} examId={examId} />
        </TabsContent>
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>
                {locale === "bn" ? "ফলাফল ও প্রতিবেদন" : "Results and reports"}
              </CardTitle>
              <CardDescription>
                {locale === "bn"
                  ? "প্রকাশের পর রিপোর্ট ও সংশোধনের ইতিহাস এখানে থাকবে।"
                  : "Published reports and correction history remain available here."}
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild variant="secondary">
                <Link
                  href={`/${locale}/owner/reports/exams/${examId}/result-sheet`}
                >
                  {locale === "bn" ? "ফলাফল শিট" : "Result sheet"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
