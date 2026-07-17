"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  BookOpen,
  CalendarDays,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ResponsiveDetailDrawer } from "@/components/portal/ResponsiveDetailDrawer";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/portal/DatePicker";

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
const batchStatusLabel = (status: string, bn: boolean) => {
  const labels: Record<string, [string, string]> = {
    active: ["সক্রিয়", "Active"],
    planned: ["পরিকল্পিত", "Planned"],
    completed: ["সম্পন্ন", "Completed"],
    archived: ["আর্কাইভ করা", "Archived"],
  };
  return labels[status]?.[bn ? 0 : 1] ?? status;
};
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
                {key === "startDate" ? (
                  <DatePicker
                    value={values.startDate}
                    onChange={(value) =>
                      setValues((current) => ({ ...current, startDate: value }))
                    }
                    locale={locale}
                    ariaLabel={
                      bn ? "শুরুর তারিখ নির্বাচন" : "Choose start date"
                    }
                    required
                  />
                ) : (
                  <Input
                    value={values[key]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    required
                  />
                )}
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

function EditBatchDialog({
  batchId,
  open,
  onOpenChange,
  locale,
}: {
  batchId: Id<"batches"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}) {
  const bn = locale === "bn";
  const details = useQuery(
    api.academics.batchWorkspace.getBatchDetails,
    batchId && open ? { batchId } : "skip",
  );
  const update = useMutation(api.academics.batchWorkspace.updateWithRoutine);
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [admissionOpen, setAdmissionOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [routine, setRoutine] = useState<Routine[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!details || loadedId === String(details.batch.batchId)) return;
    // Populate the draft once per opened batch; subsequent live query updates must not overwrite owner edits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadedId(String(details.batch.batchId));
    setNameBn(details.batch.nameBn);
    setNameEn(details.batch.nameEn);
    setCode(details.batch.code);
    setStartDate(details.batch.startDate);
    setEffectiveFrom(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
    setAdmissionOpen(details.batch.admissionOpen);
    setIsPublic(details.batch.isPublic);
    setRoutine(
      details.routine.map((row) => ({
        id: String(row.scheduleId),
        weekday: String(row.weekday),
        start: formatMinutes(row.startMinutes),
        end: formatMinutes(row.endMinutes),
        teacherId: String(row.teacherId),
        subjectId: row.subjectId ? String(row.subjectId) : "",
      })),
    );
  }, [details, loadedId]);
  const changeRow = (id: string, patch: Partial<Routine>) =>
    setRoutine((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!batchId) return;
    setError("");
    setBusy(true);
    try {
      await update({
        batchId,
        nameBn,
        nameEn,
        code,
        startDate,
        effectiveFrom,
        admissionOpen,
        isPublic,
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
      onOpenChange(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update batch",
      );
    } finally {
      setBusy(false);
    }
  }
  const teachers = details
    ? Array.from(
        new Map(
          details.assignments.map((row) => [
            String(row.teacherId),
            row.teacherName,
          ]),
        ).entries(),
      )
    : [];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setLoadedId(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{bn ? "ব্যাচ সম্পাদনা" : "Edit batch"}</DialogTitle>
          <DialogDescription>
            {bn
              ? "ব্যাচের তথ্য ও ভবিষ্যৎ সাপ্তাহিক রুটিন পরিবর্তন করুন।"
              : "Update batch details and the future weekly routine together."}
          </DialogDescription>
        </DialogHeader>
        {details && (
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label>
                {bn ? "বাংলা নাম" : "Bangla name"}
                <Input
                  value={nameBn}
                  onChange={(event) => setNameBn(event.target.value)}
                  required
                />
              </Label>
              <Label>
                {bn ? "ইংরেজি নাম" : "English name"}
                <Input
                  value={nameEn}
                  onChange={(event) => setNameEn(event.target.value)}
                  required
                />
              </Label>
              <Label>
                {bn ? "ব্যাচ কোড" : "Batch code"}
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                />
              </Label>
              <Label>
                {bn ? "শুরুর তারিখ" : "Start date"}
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  locale={locale}
                  ariaLabel={bn ? "শুরুর তারিখ নির্বাচন" : "Choose start date"}
                  required
                />
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="flex min-h-11 items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3">
                {bn ? "ভর্তি চালু" : "Admission open"}
                <Checkbox
                  checked={admissionOpen}
                  onCheckedChange={(checked) =>
                    setAdmissionOpen(checked === true)
                  }
                />
              </Label>
              <Label className="flex min-h-11 items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3">
                {bn ? "ওয়েবসাইটে প্রকাশিত" : "Published on website"}
                <Checkbox
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked === true)}
                />
              </Label>
            </div>
            <section className="grid gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {bn ? "সাপ্তাহিক রুটিন" : "Weekly routine"}
                  </h3>
                  <Label>
                    {bn ? "কার্যকর তারিখ" : "Effective from"}
                    <DatePicker
                      value={effectiveFrom}
                      onChange={setEffectiveFrom}
                      locale={locale}
                      ariaLabel={
                        bn ? "কার্যকর তারিখ নির্বাচন" : "Choose effective date"
                      }
                      required
                    />
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setRoutine((rows) => [...rows, emptyRoutine()])
                  }
                >
                  <Plus data-icon="inline-start" />
                  {bn ? "ক্লাস" : "Class"}
                </Button>
              </div>
              {routine.map((row) => {
                const subjects = details.assignments.filter(
                  (item) =>
                    String(item.teacherId) === row.teacherId && item.subjectId,
                );
                return (
                  <div
                    key={row.id}
                    className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-3 md:grid-cols-[1fr_1fr_1fr_1.3fr_1.3fr_auto]"
                  >
                    <Select
                      value={row.weekday}
                      onValueChange={(weekday) =>
                        changeRow(row.id, { weekday })
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
                      aria-label={bn ? "শুরুর সময়" : "Start time"}
                      type="time"
                      value={row.start}
                      onChange={(event) =>
                        changeRow(row.id, { start: event.target.value })
                      }
                      required
                    />
                    <Input
                      aria-label={bn ? "শেষ সময়" : "End time"}
                      type="time"
                      value={row.end}
                      onChange={(event) =>
                        changeRow(row.id, { end: event.target.value })
                      }
                      required
                    />
                    <Select
                      value={row.teacherId}
                      onValueChange={(teacherId) =>
                        changeRow(row.id, { teacherId, subjectId: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={bn ? "শিক্ষক" : "Teacher"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {teachers.map(([id, name]) => (
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
                        changeRow(row.id, {
                          subjectId: subjectId === "none" ? "" : subjectId,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={bn ? "বিষয়" : "Subject"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="none">
                            {bn ? "বিষয় ছাড়া" : "No subject"}
                          </SelectItem>
                          {subjects.map((item) => (
                            <SelectItem
                              key={item.assignmentId}
                              value={String(item.subjectId)}
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
            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                {bn ? "বাতিল" : "Cancel"}
              </Button>
              <Button type="submit" disabled={busy || !routine.length}>
                {busy
                  ? bn
                    ? "সংরক্ষণ হচ্ছে…"
                    : "Saving…"
                  : bn
                    ? "পরিবর্তন সংরক্ষণ"
                    : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BatchesWorkspace({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<
    "active" | "planned" | "completed" | "archived"
  >("active");
  const [courseId, setCourseId] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const linkedBatchId = searchParams?.get("batchId") as Id<"batches"> | null;
  const [selectedIdOverride, setSelectedId] = useState<
    Id<"batches"> | null | undefined
  >(undefined);
  const selectedId =
    selectedIdOverride === undefined ? linkedBatchId : selectedIdOverride;
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
                      {batchStatusLabel(item, bn)}
                    </SelectItem>
                  ),
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {batches.results.length ? (
          <><div className="hidden md:block"><Table>
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
                      {batchStatusLabel(batch.status, bn)}
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
          </Table></div><div className="grid gap-3 md:hidden">{batches.results.map((batch) => <button key={batch.batchId} type="button" onClick={() => setSelectedId(batch.batchId)} className="flex min-h-40 w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"><span className="flex w-full items-start justify-between gap-3"><span><strong className="block">{bn ? batch.nameBn : batch.nameEn}</strong><span className="font-mono text-xs text-[var(--ink-mute)]">{batch.code}</span></span><Badge variant={batch.status === "active" ? "success" : "neutral"}>{batchStatusLabel(batch.status, bn)}</Badge></span><span className="text-sm"><span className="block text-xs text-[var(--ink-mute)]">{bn ? "কোর্স" : "Course"}</span>{bn ? batch.courseNameBn : batch.courseNameEn}</span><span className="grid w-full grid-cols-3 gap-3 text-sm"><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "ক্লাস" : "Classes"}</span>{batch.routineCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "শিক্ষক" : "Teachers"}</span>{batch.teacherCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "শিক্ষার্থী" : "Students"}</span>{batch.activeEnrolmentCount}</span></span></button>)}</div></>
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
      <ResponsiveDetailDrawer
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        closeLabel={bn ? "বন্ধ করুন" : "Close"}
        title={
          details
            ? bn
              ? details.batch.nameBn
              : details.batch.nameEn
            : bn
              ? "ব্যাচ"
              : "Batch"
        }
        description={
          details
            ? `${details.batch.code} · ${bn ? details.batch.courseNameBn : details.batch.courseNameEn}`
            : undefined
        }
      >
        {details && (
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  details.batch.status === "active"
                    ? "success"
                    : details.batch.status === "completed"
                      ? "info"
                      : "neutral"
                }
              >
                {batchStatusLabel(details.batch.status, bn)}
              </Badge>
              <Badge variant={details.batch.admissionOpen ? "info" : "neutral"}>
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
            {details.batch.status !== "archived" && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditOpen(true)}>
                  <Pencil data-icon="inline-start" />
                  {bn ? "ব্যাচ সম্পাদনা" : "Edit batch"}
                </Button>
                <Button asChild variant="secondary">
                  <Link
                    href={`/${locale}/owner/schedule?batchId=${details.batch.batchId}`}
                  >
                    <CalendarDays data-icon="inline-start" />
                    {bn ? "সময়সূচি খুলুন" : "Open schedule"}
                  </Link>
                </Button>
              </div>
            )}
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
      </ResponsiveDetailDrawer>
      <EditBatchDialog
        batchId={selectedId}
        open={editOpen}
        onOpenChange={setEditOpen}
        locale={locale}
      />
    </div>
  );
}
