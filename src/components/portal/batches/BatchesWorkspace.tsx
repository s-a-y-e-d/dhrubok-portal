"use client";

import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  BookOpen,
  CalendarDays,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Locale = "bn" | "en";
type Routine = {
  id: string;
  weekday: string;
  start: string;
  end: string;
  teacherId: string;
  subjectId: string;
};
const weekdaysEn = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const weekdaysBn = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];
const emptyRoutine = (): Routine => ({
  id: crypto.randomUUID(),
  weekday: "0",
  start: "",
  end: "",
  teacherId: "",
  subjectId: "",
});
const toMinutes = (value: string) => {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
};
const formatMinutes = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

function CreateBatchDialog({
  open,
  onOpenChange,
  locale,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  onCreated: (id: Id<"batches">) => void;
}) {
  const bn = locale === "bn";
  const options = useQuery(api.academics.options.ownerWorkspace, {});
  const create = useMutation(api.academics.batchWorkspace.createWithRoutine);
  const [courseId, setCourseId] = useState("");
  const [values, setValues] = useState({
    nameBn: "",
    nameEn: "",
    code: "",
    startDate: "",
  });
  const [routine, setRoutine] = useState<Routine[]>([emptyRoutine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const details = useQuery(
    api.academics.courseWorkspace.getCourseDetails,
    courseId ? { courseId: courseId as Id<"courses"> } : "skip",
  );
  const reset = () => {
    setCourseId("");
    setValues({ nameBn: "", nameEn: "", code: "", startDate: "" });
    setRoutine([emptyRoutine()]);
    setError(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (
      !courseId ||
      Object.values(values).some((value) => !value.trim()) ||
      routine.some(
        (row) =>
          !row.start ||
          !row.end ||
          !row.teacherId ||
          toMinutes(row.end) <= toMinutes(row.start),
      )
    ) {
      setError(
        bn
          ? "সব আবশ্যক তথ্য ও সঠিক সময় দিন।"
          : "Complete all required fields with valid times.",
      );
      return;
    }
    setBusy(true);
    try {
      const id = await create({
        courseId: courseId as Id<"courses">,
        ...values,
        routine: routine.map((row) => ({
          weekday: Number(row.weekday),
          startMinutes: toMinutes(row.start),
          endMinutes: toMinutes(row.end),
          teacherId: row.teacherId as Id<"teachers">,
          subjectId: row.subjectId
            ? (row.subjectId as Id<"subjects">)
            : undefined,
        })),
      });
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(780px,calc(100%-24px))]">
        <DialogHeader>
          <DialogTitle>{bn ? "নতুন ব্যাচ" : "Create batch"}</DialogTitle>
          <DialogDescription>
            {bn
              ? "কোর্সের ডিফল্ট শিক্ষক নিয়ে প্রথম সাপ্তাহিক রুটিন তৈরি করুন।"
              : "Copy course teacher defaults and create the first weekly routine."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <Label>{bn ? "কোর্স" : "Course"}</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={bn ? "কোর্স নির্বাচন" : "Select course"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {options?.courses.map((course) => (
                      <SelectItem key={course.courseId} value={course.courseId}>
                        {bn ? course.nameBn : course.nameEn}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
            {(["nameBn", "nameEn", "code", "startDate"] as const).map((key) => (
              <label key={key} className="grid gap-1.5">
                <Label>
                  {key === "nameBn"
                    ? bn
                      ? "বাংলা নাম"
                      : "Bangla name"
                    : key === "nameEn"
                      ? bn
                        ? "ইংরেজি নাম"
                        : "English name"
                      : key === "code"
                        ? bn
                          ? "ব্যাচ কোড"
                          : "Batch code"
                        : bn
                          ? "শুরুর তারিখ"
                          : "Start date"}
                </Label>
                <Input
                  type={key === "startDate" ? "date" : "text"}
                  value={values[key]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  required
                />
              </label>
            ))}
          </div>
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {bn ? "সাপ্তাহিক রুটিন" : "Weekly routine"}
                </h3>
                <p className="text-sm text-[var(--ink-mute)]">
                  {details
                    ? `${details.defaults.length} ${bn ? "টি কোর্স ডিফল্ট" : "course defaults"}`
                    : bn
                      ? "প্রথমে কোর্স নির্বাচন করুন"
                      : "Select a course first"}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRoutine((rows) => [...rows, emptyRoutine()])}
              >
                <Plus data-icon="inline-start" />
                {bn ? "ক্লাস" : "Class"}
              </Button>
            </div>
            {routine.map((row) => {
              const allowed =
                details?.defaults.filter(
                  (item) => item.teacherId === row.teacherId,
                ) ?? [];
              return (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 md:grid-cols-[1fr_1fr_1fr_1.3fr_1.3fr_auto]"
                >
                  <Select
                    value={row.weekday}
                    onValueChange={(weekday) =>
                      setRoutine((rows) =>
                        rows.map((item) =>
                          item.id === row.id ? { ...item, weekday } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(bn ? weekdaysBn : weekdaysEn).map((day, index) => (
                          <SelectItem key={day} value={String(index)}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={bn ? "শুরুর সময়" : "Start time"}
                    type="time"
                    value={row.start}
                    onChange={(event) =>
                      setRoutine((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, start: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={bn ? "শেষ সময়" : "End time"}
                    type="time"
                    value={row.end}
                    onChange={(event) =>
                      setRoutine((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, end: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Select
                    value={row.teacherId}
                    onValueChange={(teacherId) =>
                      setRoutine((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, teacherId, subjectId: "" }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={bn ? "শিক্ষক" : "Teacher"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {Array.from(
                          new Map(
                            details?.defaults.map((item) => [
                              item.teacherId,
                              item.teacherName,
                            ]),
                          ).entries(),
                        ).map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.subjectId || "none"}
                    onValueChange={(subjectId) =>
                      setRoutine((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? {
                                ...item,
                                subjectId:
                                  subjectId === "none" ? "" : subjectId,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          bn ? "বিষয় (ঐচ্ছিক)" : "Subject (optional)"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">
                          {bn ? "বিষয় ছাড়া" : "No subject"}
                        </SelectItem>
                        {allowed.map((item) => (
                          <SelectItem
                            key={item.subjectId}
                            value={item.subjectId}
                          >
                            {bn ? item.subjectNameBn : item.subjectNameEn}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={routine.length === 1}
                    aria-label={bn ? "সারি সরান" : "Remove row"}
                    onClick={() =>
                      setRoutine((rows) =>
                        rows.filter((item) => item.id !== row.id),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </section>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {bn ? "বাতিল" : "Cancel"}
            </Button>
            <Button type="submit" disabled={busy || !details}>
              {busy
                ? bn
                  ? "তৈরি হচ্ছে…"
                  : "Creating…"
                : bn
                  ? "ব্যাচ তৈরি"
                  : "Create batch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BatchesWorkspace({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const [status, setStatus] = useState<
    "active" | "planned" | "completed" | "archived"
  >("active");
  const [courseId, setCourseId] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"batches"> | null>(null);
  const options = useQuery(api.academics.options.ownerWorkspace, {});
  const batches = usePaginatedQuery(
    api.academics.batchWorkspace.listBatches,
    {
      status,
      courseId: courseId ? (courseId as Id<"courses">) : undefined,
      query,
    },
    { initialNumItems: 20 },
  );
  const details = useQuery(
    api.academics.batchWorkspace.getBatchDetails,
    selectedId ? { batchId: selectedId } : "skip",
  );
  return (
    <div className="grid gap-5">
      <header className="portal-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{bn ? "একাডেমিক" : "Academics"}</p>
          <h1>{bn ? "ব্যাচ" : "Batches"}</h1>
          <p>
            {bn
              ? "সব কোর্সের আলাদা ইনটেক, শিক্ষক ও সাপ্তাহিক রুটিন পরিচালনা করুন।"
              : "Manage every course intake, its teachers, and weekly routine."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          {bn ? "নতুন ব্যাচ" : "New batch"}
        </Button>
      </header>
      <section className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <label className="relative">
            <span className="sr-only">
              {bn ? "ব্যাচ খুঁজুন" : "Search batches"}
            </span>
            <Search className="pointer-events-none absolute start-3 top-3 size-4 text-[var(--ink-mute)]" />
            <Input
              className="ps-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                bn ? "ব্যাচ, কোর্স বা কোড" : "Batch, course, or code"
              }
            />
          </label>
          <Select
            value={courseId || "all"}
            onValueChange={(value) => setCourseId(value === "all" ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব কোর্স" : "All courses"}
                </SelectItem>
                {options?.courses.map((course) => (
                  <SelectItem key={course.courseId} value={course.courseId}>
                    {bn ? course.nameBn : course.nameEn}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as typeof status)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(["active", "planned", "completed", "archived"] as const).map(
                  (item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ),
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {batches.results.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{bn ? "ব্যাচ" : "Batch"}</TableHead>
                <TableHead>{bn ? "কোর্স" : "Course"}</TableHead>
                <TableHead>{bn ? "অবস্থা" : "Status"}</TableHead>
                <TableHead>{bn ? "ক্লাস" : "Classes"}</TableHead>
                <TableHead>{bn ? "শিক্ষক" : "Teachers"}</TableHead>
                <TableHead>{bn ? "শিক্ষার্থী" : "Students"}</TableHead>
                <TableHead>{bn ? "ভর্তি" : "Admission"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.results.map((batch) => (
                <TableRow
                  key={batch.batchId}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(batch.batchId)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(batch.batchId);
                      }}
                    >
                      <strong className="block">
                        {bn ? batch.nameBn : batch.nameEn}
                      </strong>
                      <small>{batch.code}</small>
                    </button>
                  </TableCell>
                  <TableCell>
                    {bn ? batch.courseNameBn : batch.courseNameEn}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        batch.status === "active" ? "success" : "neutral"
                      }
                    >
                      {batch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{batch.routineCount}</TableCell>
                  <TableCell>{batch.teacherCount}</TableCell>
                  <TableCell>{batch.activeEnrolmentCount}</TableCell>
                  <TableCell>
                    <Badge variant={batch.admissionOpen ? "info" : "neutral"}>
                      {batch.admissionOpen
                        ? bn
                          ? "চালু"
                          : "Open"
                        : bn
                          ? "বন্ধ"
                          : "Closed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title={bn ? "কোনো ব্যাচ নেই" : "No batches found"}
            description={
              bn
                ? "প্রথম ব্যাচ তৈরি করে শুরু করুন।"
                : "Create the first batch to get started."
            }
            action={
              <Button onClick={() => setCreateOpen(true)}>
                {bn ? "ব্যাচ তৈরি" : "Create batch"}
              </Button>
            }
          />
        )}
        {batches.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => batches.loadMore(20)}>
            {bn ? "আরও দেখুন" : "Load more"}
          </Button>
        )}
      </section>
      <CreateBatchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locale={locale}
        onCreated={setSelectedId}
      />
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="w-[min(560px,calc(100%-24px))]">
          <SheetHeader>
            <SheetTitle>
              {details
                ? bn
                  ? details.batch.nameBn
                  : details.batch.nameEn
                : bn
                  ? "ব্যাচ"
                  : "Batch"}
            </SheetTitle>
            <SheetDescription>
              {details
                ? `${details.batch.code} · ${bn ? details.batch.courseNameBn : details.batch.courseNameEn}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {details && (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{details.batch.status}</Badge>
                <Badge
                  variant={details.batch.admissionOpen ? "info" : "neutral"}
                >
                  {details.batch.admissionOpen
                    ? bn
                      ? "ভর্তি চালু"
                      : "Admission open"
                    : bn
                      ? "ভর্তি বন্ধ"
                      : "Admission closed"}
                </Badge>
                <Badge variant={details.batch.isPublic ? "info" : "neutral"}>
                  {details.batch.isPublic
                    ? bn
                      ? "পাবলিক"
                      : "Public"
                    : bn
                      ? "প্রাইভেট"
                      : "Private"}
                </Badge>
              </div>
              <p>
                <CalendarDays className="me-2 inline size-4" />
                {details.batch.startDate}
              </p>
              <section>
                <h3 className="mb-2 font-semibold">
                  <Users className="me-2 inline size-4" />
                  {bn ? "শিক্ষক ও বিষয়" : "Teachers and subjects"}
                </h3>
                {details.assignments.map((row) => (
                  <div
                    key={row.assignmentId}
                    className="flex justify-between border-b border-[var(--border)] py-2"
                  >
                    <span>{row.teacherName}</span>
                    <span>
                      {row.subjectId
                        ? bn
                          ? row.subjectNameBn
                          : row.subjectNameEn
                        : "—"}
                    </span>
                  </div>
                ))}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">
                  <BookOpen className="me-2 inline size-4" />
                  {bn ? "সাপ্তাহিক রুটিন" : "Weekly routine"}
                </h3>
                {details.routine.map((row) => (
                  <div
                    key={row.scheduleId}
                    className="grid grid-cols-[1fr_auto] gap-2 border-b border-[var(--border)] py-2"
                  >
                    <span>
                      {(bn ? weekdaysBn : weekdaysEn)[row.weekday]} ·{" "}
                      {row.teacherName}
                    </span>
                    <span>
                      {formatMinutes(row.startMinutes)}–
                      {formatMinutes(row.endMinutes)}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
