"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DatePicker } from "@/components/portal/DatePicker";
import { cn } from "@/lib/utils";

type Locale = "bn" | "en";
type Session = FunctionReturnType<
  typeof api.academics.scheduleWorkspace.listWeek
>[number];
type Options = FunctionReturnType<
  typeof api.academics.scheduleWorkspace.getOptions
>;
type StatusFilter = "all" | "scheduled" | "open" | "submitted" | "cancelled";
type MutationMode = "extra" | "reschedule" | "cancel" | null;
const DAY_MS = 86_400_000;
const weekdaysEn = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];
const weekdaysBn = [
  "শনিবার",
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
];

function localDate(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(timestamp);
}
function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}
function saturdayFor(date: string) {
  const day = new Date(`${date}T12:00:00+06:00`).getUTCDay();
  return addDays(date, -((day + 1) % 7));
}
function timestamp(date: string, time: string) {
  return Date.parse(`${date}T${time}:00+06:00`);
}
function inputTime(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}
function displayTime(value: number, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}
function displayDate(
  date: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
) {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    ...options,
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${date}T12:00:00+06:00`));
}
function statusVariant(status: Session["status"]) {
  return status === "submitted"
    ? "success"
    : status === "open"
      ? "warning"
      : status === "cancelled"
        ? "neutral"
        : "info";
}
function statusLabel(status: Session["status"], bn: boolean) {
  const labels = bn
    ? {
        scheduled: "নির্ধারিত",
        open: "উপস্থিতি চালু",
        submitted: "সম্পন্ন",
        cancelled: "বাতিল",
      }
    : {
        scheduled: "Scheduled",
        open: "Attendance open",
        submitted: "Completed",
        cancelled: "Cancelled",
      };
  return labels[status];
}

function ConflictAlert({
  conflicts,
  locale,
}: {
  conflicts: FunctionReturnType<
    typeof api.academics.scheduleWorkspace.previewConflict
  >;
  locale: Locale;
}) {
  if (!conflicts.length) return null;
  const bn = locale === "bn";
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>
        {bn ? "এই সময়টি ব্যবহার করা যাবে না" : "This time is unavailable"}
      </AlertTitle>
      <AlertDescription>
        <ul className="list-disc ps-5">
          {conflicts.map((item) => (
            <li key={`${item.kind}-${item.sessionId}`}>
              {item.kind === "teacher"
                ? bn
                  ? "শিক্ষক"
                  : "Teacher"
                : bn
                  ? "ব্যাচ"
                  : "Batch"}
              : {item.batchName} · {item.teacherName} ·{" "}
              {displayTime(item.startsAt, locale)}–
              {displayTime(item.endsAt, locale)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function SessionBadges({ row, locale }: { row: Session; locale: Locale }) {
  const bn = locale === "bn";
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant={statusVariant(row.status)}>
        {statusLabel(row.status, bn)}
      </Badge>
      {row.occurrenceType === "extra" && (
        <Badge variant="info">{bn ? "অতিরিক্ত" : "Extra"}</Badge>
      )}
      {row.isOneOffOverride && (
        <Badge variant="warning">{bn ? "পুনঃনির্ধারিত" : "Rescheduled"}</Badge>
      )}
    </div>
  );
}

function ClassFormDialog({
  mode,
  row,
  options,
  locale,
  onClose,
  onCreated,
}: {
  mode: Exclude<MutationMode, "cancel" | null>;
  row: Session | null;
  options: Options;
  locale: Locale;
  onClose: () => void;
  onCreated: (id?: Id<"classSessions">) => void;
}) {
  const bn = locale === "bn";
  const createExtra = useMutation(api.academics.scheduleWorkspace.createExtra);
  const reschedule = useMutation(api.academics.scheduleWorkspace.reschedule);
  const [batchId, setBatchId] = useState(
    row?.batchId ?? options.batches[0]?.id ?? "",
  );
  const [teacherId, setTeacherId] = useState(row?.teacherId ?? "");
  const [subjectId, setSubjectId] = useState<Id<"subjects"> | "none">(
    row?.subjectId ?? "none",
  );
  const [date, setDate] = useState(row?.sessionDate ?? localDate());
  const [start, setStart] = useState(row ? inputTime(row.startsAt) : "10:00");
  const [end, setEnd] = useState(row ? inputTime(row.endsAt) : "11:00");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignments = options.assignments.filter(
    (item) => item.batchId === batchId,
  );
  const teacherIds = [...new Set(assignments.map((item) => item.teacherId))];
  const subjectIds = assignments
    .filter((item) => item.teacherId === teacherId && item.subjectId)
    .map((item) => item.subjectId!);
  const [renderedAt] = useState(Date.now);
  const startsAt = date && start ? timestamp(date, start) : 0;
  const endsAt = date && end ? timestamp(date, end) : 0;
  const conflictArgs =
    startsAt && endsAt > startsAt && batchId && teacherId
      ? {
          sessionId: row?.sessionId,
          batchId: batchId as Id<"batches">,
          teacherId: teacherId as Id<"teachers">,
          sessionDate: date,
          startsAt,
          endsAt,
        }
      : null;
  const conflicts =
    useQuery(
      api.academics.scheduleWorkspace.previewConflict,
      conflictArgs ?? "skip",
    ) ?? [];
  const valid = Boolean(
    batchId &&
    teacherId &&
    date &&
    startsAt > renderedAt &&
    endsAt > startsAt &&
    !conflicts.length,
  );
  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "extra") {
        const id = await createExtra({
          batchId: batchId as Id<"batches">,
          teacherId: teacherId as Id<"teachers">,
          subjectId: subjectId === "none" ? undefined : subjectId,
          sessionDate: date,
          startsAt,
          endsAt,
          reason: reason.trim() || undefined,
        });
        onCreated(id);
      } else if (row) {
        await reschedule({
          sessionId: row.sessionId,
          sessionDate: date,
          startsAt,
          endsAt,
          reason: reason.trim() || undefined,
        });
        onCreated(row.sessionId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save class");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "extra"
              ? bn
                ? "অতিরিক্ত ক্লাস যোগ করুন"
                : "Add extra class"
              : bn
                ? "এই ক্লাস পুনঃনির্ধারণ করুন"
                : "Reschedule this class"}
          </DialogTitle>
          <DialogDescription>
            {mode === "extra"
              ? bn
                ? "ব্যাচের সক্রিয় শিক্ষক ও বিষয় থেকে নির্বাচন করুন।"
                : "Choose from the batch's active teacher and subject assignments."
              : bn
                ? "শুধু এই ক্লাসের তারিখ ও সময় বদলাবে। ভবিষ্যৎ রুটিন বদলাবে না।"
                : "Only this class's date and time will change. The future routine will not change."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {mode === "extra" && (
            <>
              <Field>
                <FieldLabel htmlFor="schedule-batch">
                  {bn ? "ব্যাচ" : "Batch"}
                </FieldLabel>
                <Select
                  value={batchId}
                  onValueChange={(value) => {
                    setBatchId(value as Id<"batches">);
                    setTeacherId("");
                    setSubjectId("none");
                  }}
                >
                  <SelectTrigger id="schedule-batch">
                    <SelectValue
                      placeholder={bn ? "ব্যাচ নির্বাচন" : "Select batch"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.batches.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {bn ? item.nameBn : item.nameEn} · {item.code}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={Boolean(batchId && !teacherIds.length)}>
                <FieldLabel htmlFor="schedule-teacher">
                  {bn ? "শিক্ষক" : "Teacher"}
                </FieldLabel>
                <Select
                  value={teacherId}
                  onValueChange={(value) => {
                    setTeacherId(value as Id<"teachers">);
                    setSubjectId("none");
                  }}
                >
                  <SelectTrigger
                    id="schedule-teacher"
                    aria-invalid={Boolean(batchId && !teacherIds.length)}
                  >
                    <SelectValue
                      placeholder={bn ? "শিক্ষক নির্বাচন" : "Select teacher"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.teachers
                        .filter((item) => teacherIds.includes(item.id))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {batchId && !teacherIds.length && (
                  <FieldError>
                    {bn
                      ? "এই ব্যাচে কোনো সক্রিয় শিক্ষক নেই।"
                      : "This batch has no active assigned teacher."}
                  </FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-subject">
                  {bn ? "বিষয় (ঐচ্ছিক)" : "Subject (optional)"}
                </FieldLabel>
                <Select
                  value={subjectId}
                  onValueChange={(value) =>
                    setSubjectId(value as Id<"subjects"> | "none")
                  }
                >
                  <SelectTrigger id="schedule-subject">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">
                        {bn ? "কোনো বিষয় নয়" : "No subject"}
                      </SelectItem>
                      {options.subjects
                        .filter((item) => subjectIds.includes(item.id))
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {bn ? item.nameBn : item.nameEn}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="schedule-date">
                {bn ? "তারিখ" : "Date"}
              </FieldLabel>
              <DatePicker
                id="schedule-date"
                value={date}
                onChange={setDate}
                locale={locale}
                ariaLabel={bn ? "তারিখ নির্বাচন" : "Choose date"}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="schedule-start">
                {bn ? "শুরুর সময়" : "Start time"}
              </FieldLabel>
              <Input
                id="schedule-start"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field data-invalid={Boolean(end && endsAt <= startsAt)}>
              <FieldLabel htmlFor="schedule-end">
                {bn ? "শেষের সময়" : "End time"}
              </FieldLabel>
              <Input
                id="schedule-end"
                type="time"
                value={end}
                aria-invalid={Boolean(end && endsAt <= startsAt)}
                onChange={(event) => setEnd(event.target.value)}
              />
              {end && endsAt <= startsAt && (
                <FieldError>
                  {bn ? "শেষের সময় পরে হতে হবে।" : "End time must be later."}
                </FieldError>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="schedule-reason">
              {bn ? "কারণ বা নোট (ঐচ্ছিক)" : "Reason or note (optional)"}
            </FieldLabel>
            <Textarea
              id="schedule-reason"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
            />
            <FieldDescription>{reason.length}/300</FieldDescription>
          </Field>
          <ConflictAlert conflicts={conflicts} locale={locale} />
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>
                {bn ? "সংরক্ষণ করা যায়নি" : "Could not save"}
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {bn ? "বন্ধ করুন" : "Cancel"}
          </Button>
          <Button disabled={!valid || busy} onClick={submit}>
            {busy
              ? bn
                ? "সংরক্ষণ হচ্ছে…"
                : "Saving…"
              : mode === "extra"
                ? bn
                  ? "ক্লাস যোগ করুন"
                  : "Add class"
                : bn
                  ? "পুনঃনির্ধারণ করুন"
                  : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  row,
  locale,
  onClose,
}: {
  row: Session;
  locale: Locale;
  onClose: () => void;
}) {
  const bn = locale === "bn";
  const cancel = useMutation(api.academics.scheduleWorkspace.cancel);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await cancel({
        sessionId: row.sessionId,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to cancel class",
      );
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {bn ? "এই ক্লাস বাতিল করবেন?" : "Cancel this class?"}
          </DialogTitle>
          <DialogDescription>
            {bn
              ? "শুধু নির্বাচিত ক্লাসটি বাতিল হবে। ব্যাচের সাপ্তাহিক রুটিন অপরিবর্তিত থাকবে।"
              : "Only the selected class will be cancelled. The batch's weekly routine remains unchanged."}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cancel-reason">
              {bn ? "কারণ (ঐচ্ছিক)" : "Reason (optional)"}
            </FieldLabel>
            <Textarea
              id="cancel-reason"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {bn ? "ফিরে যান" : "Keep class"}
          </Button>
          <Button variant="danger" disabled={busy} onClick={submit}>
            {busy
              ? bn
                ? "বাতিল হচ্ছে…"
                : "Cancelling…"
              : bn
                ? "ক্লাস বাতিল করুন"
                : "Cancel class"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeekCalendar({
  rows,
  startDate,
  locale,
  onSelect,
}: {
  rows: Session[];
  startDate: string;
  locale: Locale;
  onSelect: (row: Session) => void;
}) {
  const bn = locale === "bn";
  const minuteValues = rows.flatMap((row) => {
    const start =
      Number(inputTime(row.startsAt).slice(0, 2)) * 60 +
      Number(inputTime(row.startsAt).slice(3));
    const end =
      Number(inputTime(row.endsAt).slice(0, 2)) * 60 +
      Number(inputTime(row.endsAt).slice(3));
    return [start, end];
  });
  const minHour = minuteValues.length
    ? Math.max(0, Math.min(7, Math.floor(Math.min(...minuteValues) / 60) - 1))
    : 7;
  const maxHour = minuteValues.length
    ? Math.min(24, Math.max(22, Math.ceil(Math.max(...minuteValues) / 60) + 1))
    : 22;
  const height = (maxHour - minHour) * 64;
  return (
    <ScrollArea className="w-full rounded-[var(--radius-md)] border border-[var(--border)]">
      <div className="min-w-[980px]">
        <div className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))] border-b border-[var(--border)]">
          <div />
          <>
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="border-s border-[var(--border)] p-3 text-center"
              >
                <strong className="block">
                  {(bn ? weekdaysBn : weekdaysEn)[index]}
                </strong>
                <span className="text-sm text-[var(--ink-mute)]">
                  {displayDate(addDays(startDate, index), locale)}
                </span>
              </div>
            ))}
          </>
        </div>
        <div className="grid grid-cols-[64px_repeat(7,minmax(130px,1fr))]">
          <div className="relative" style={{ height }}>
            {Array.from({ length: maxHour - minHour + 1 }, (_, index) => (
              <span
                key={index}
                className="absolute end-2 -translate-y-1/2 text-xs text-[var(--ink-mute)]"
                style={{ top: index * 64 }}
              >
                {String(minHour + index).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, dayIndex) => {
            const date = addDays(startDate, dayIndex);
            const dayRows = rows
              .filter((row) => row.sessionDate === date)
              .sort((a, b) => a.startsAt - b.startsAt);
            return (
              <div
                key={date}
                className="relative border-s border-[var(--border)]"
                style={{ height }}
              >
                {Array.from({ length: maxHour - minHour + 1 }, (_, index) => (
                  <Separator
                    key={index}
                    className="absolute inset-x-0"
                    style={{ top: index * 64 }}
                  />
                ))}
                {dayRows.map((row) => {
                  const parts = inputTime(row.startsAt).split(":").map(Number);
                  const endParts = inputTime(row.endsAt).split(":").map(Number);
                  const startMinutes = parts[0] * 60 + parts[1];
                  const endMinutes = endParts[0] * 60 + endParts[1];
                  const overlappingRows = dayRows.filter(
                    (candidate) =>
                      candidate.startsAt < row.endsAt &&
                      candidate.endsAt > row.startsAt,
                  );
                  const lane = overlappingRows.findIndex(
                    (candidate) => candidate.sessionId === row.sessionId,
                  );
                  const laneCount = overlappingRows.length;
                  return (
                    <button
                      type="button"
                      key={row.sessionId}
                      onClick={() => onSelect(row)}
                      aria-label={`${displayTime(row.startsAt, locale)} ${bn ? row.batchNameBn : row.batchNameEn} ${row.teacherName} ${statusLabel(row.status, bn)}`}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-[var(--radius-sm)] border p-2 text-start text-xs shadow-[var(--shadow-1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]",
                        row.status === "cancelled"
                          ? "border-[var(--border-strong)] bg-[var(--canvas-subtle)] opacity-70"
                          : row.isOneOffOverride
                            ? "border-[var(--warning)] bg-[var(--warning-muted)]"
                            : row.occurrenceType === "extra"
                              ? "border-[var(--info)] bg-[var(--info-muted)]"
                              : "border-[var(--border-strong)] bg-[var(--canvas)]",
                      )}
                      style={{
                        top: ((startMinutes - minHour * 60) / 60) * 64,
                        height: Math.max(
                          42,
                          ((endMinutes - startMinutes) / 60) * 64,
                        ),
                        left: `calc(${(lane / laneCount) * 100}% + 4px)`,
                        right: `calc(${((laneCount - lane - 1) / laneCount) * 100}% + 4px)`,
                      }}
                    >
                      <strong className="block truncate">
                        {bn ? row.batchNameBn : row.batchNameEn}
                      </strong>
                      <span className="block truncate">
                        {displayTime(row.startsAt, locale)} · {row.teacherName}
                      </span>
                      {row.subjectNameEn && (
                        <span className="block truncate">
                          {bn ? row.subjectNameBn : row.subjectNameEn}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function ListAgenda({
  rows,
  startDate,
  locale,
  onSelect,
}: {
  rows: Session[];
  startDate: string;
  locale: Locale;
  onSelect: (row: Session) => void;
}) {
  const bn = locale === "bn";
  return (
    <div className="grid gap-5">
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDays(startDate, index);
        const dayRows = rows.filter((row) => row.sessionDate === date);
        return (
          <section key={date} className="grid gap-2">
            <div>
              <h2 className="text-base font-semibold">
                {(bn ? weekdaysBn : weekdaysEn)[index]} ·{" "}
                {displayDate(date, locale, { day: "numeric", month: "long" })}
              </h2>
            </div>
            {dayRows.length ? (
              dayRows.map((row) => (
                <button
                  type="button"
                  key={row.sessionId}
                  onClick={() => onSelect(row)}
                  className="flex min-h-16 items-center justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-3 text-start hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                >
                  <div>
                    <strong className="block">
                      {displayTime(row.startsAt, locale)}–
                      {displayTime(row.endsAt, locale)} ·{" "}
                      {bn ? row.batchNameBn : row.batchNameEn}
                    </strong>
                    <span className="text-sm text-[var(--ink-mute)]">
                      {row.teacherName}
                      {row.subjectNameEn
                        ? ` · ${bn ? row.subjectNameBn : row.subjectNameEn}`
                        : ""}
                    </span>
                  </div>
                  <SessionBadges row={row} locale={locale} />
                </button>
              ))
            ) : (
              <p className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] p-3 text-sm text-[var(--ink-mute)]">
                {bn ? "কোনো ক্লাস নেই।" : "No classes."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ScheduleWorkspace({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => saturdayFor(localDate()));
  const isMobile = useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(max-width: 767px)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const [viewChoice, setViewChoice] = useState<"week" | "list" | null>(null);
  const view = viewChoice ?? (isMobile ? "list" : "week");
  const [courseId, setCourseId] = useState("all");
  const [batchId, setBatchId] = useState(
    () => searchParams?.get("batchId") ?? "all",
  );
  const [teacherId, setTeacherId] = useState("all");
  const [subjectId, setSubjectId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<Id<"classSessions"> | null>(
    null,
  );
  const [mutationMode, setMutationMode] = useState<MutationMode>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const options = useQuery(api.academics.scheduleWorkspace.getOptions);
  const rows = useQuery(api.academics.scheduleWorkspace.listWeek, {
    startDate: weekStart,
    courseId: courseId === "all" ? undefined : (courseId as Id<"courses">),
    batchId: batchId === "all" ? undefined : (batchId as Id<"batches">),
    teacherId: teacherId === "all" ? undefined : (teacherId as Id<"teachers">),
    subjectId: subjectId === "all" ? undefined : (subjectId as Id<"subjects">),
    status,
  });
  const details = useQuery(
    api.academics.scheduleWorkspace.getDetails,
    selectedId ? { sessionId: selectedId } : "skip",
  );
  const restore = useMutation(api.academics.scheduleWorkspace.restore);
  const openAttendance = useMutation(
    api.academics.scheduleWorkspace.openAttendance,
  );
  const filteredBatches = useMemo(
    () =>
      options?.batches.filter(
        (item) => courseId === "all" || item.courseId === courseId,
      ) ?? [],
    [options, courseId],
  );
  function selectRow(row: Session) {
    setSelectedId(row.sessionId);
    setActionError(null);
  }
  async function restoreSelected() {
    if (!details) return;
    setActionError(null);
    try {
      await restore({ sessionId: details.sessionId });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to restore class",
      );
    }
  }
  async function takeAttendance() {
    if (!details) return;
    setActionError(null);
    try {
      await openAttendance({ sessionId: details.sessionId });
      router.push(`/${locale}/owner/attendance?session=${details.sessionId}`);
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to open attendance",
      );
    }
  }
  return (
    <div className="grid gap-5">
      <header className="portal-page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{bn ? "একাডেমিক" : "Academics"}</p>
          <h1>{bn ? "সময়সূচি" : "Schedule"}</h1>
          <p>
            {bn
              ? "সাপ্তাহিক ক্লাস দেখুন এবং একটি নির্দিষ্ট ক্লাসের পরিবর্তন পরিচালনা করুন।"
              : "View weekly classes and manage changes to one specific occurrence."}
          </p>
        </div>
        <Button onClick={() => setMutationMode("extra")}>
          <Plus data-icon="inline-start" />
          {bn ? "অতিরিক্ত ক্লাস" : "Add extra class"}
        </Button>
      </header>
      <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label={bn ? "আগের সপ্তাহ" : "Previous week"}
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setWeekStart(saturdayFor(localDate()))}
            >
              {bn ? "আজ" : "Today"}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label={bn ? "পরের সপ্তাহ" : "Next week"}
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight />
            </Button>
            <DatePicker
              className="w-auto"
              ariaLabel={bn ? "সপ্তাহ নির্বাচন" : "Choose week"}
              value={weekStart}
              onChange={(value) => setWeekStart(saturdayFor(value))}
              locale={locale}
            />
            <strong>
              {displayDate(weekStart, locale)}–
              {displayDate(addDays(weekStart, 6), locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </div>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value) setViewChoice(value as "week" | "list");
            }}
            aria-label={bn ? "সময়সূচি দেখার ধরন" : "Schedule view"}
            className="gap-0 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas-subtle)] p-1 shadow-[var(--shadow-1)]"
          >
            <ToggleGroupItem
              value="week"
              aria-label={bn ? "সপ্তাহ ভিউ" : "Week view"}
              className="min-h-9 rounded-[calc(var(--radius-md)-2px)] px-3 text-[var(--ink-mute)] transition-[background-color,color,box-shadow] duration-200 ease-out hover:bg-[var(--canvas)] hover:text-[var(--ink)] data-[state=on]:bg-[var(--brand)] data-[state=on]:text-[var(--on-brand)] data-[state=on]:shadow-[var(--shadow-1)]"
            >
              <CalendarDays />
              {bn ? "সপ্তাহ" : "Week"}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label={bn ? "তালিকা ভিউ" : "List view"}
              className="min-h-9 rounded-[calc(var(--radius-md)-2px)] px-3 text-[var(--ink-mute)] transition-[background-color,color,box-shadow] duration-200 ease-out hover:bg-[var(--canvas)] hover:text-[var(--ink)] data-[state=on]:bg-[var(--brand)] data-[state=on]:text-[var(--on-brand)] data-[state=on]:shadow-[var(--shadow-1)]"
            >
              <List />
              {bn ? "তালিকা" : "List"}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            value={courseId}
            onValueChange={(value) => {
              setCourseId(value);
              setBatchId("all");
            }}
          >
            <SelectTrigger aria-label={bn ? "কোর্স ফিল্টার" : "Course filter"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব কোর্স" : "All courses"}
                </SelectItem>
                {options?.courses.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {bn ? item.nameBn : item.nameEn}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger aria-label={bn ? "ব্যাচ ফিল্টার" : "Batch filter"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব ব্যাচ" : "All batches"}
                </SelectItem>
                {filteredBatches.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {bn ? item.nameBn : item.nameEn}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger
              aria-label={bn ? "শিক্ষক ফিল্টার" : "Teacher filter"}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব শিক্ষক" : "All teachers"}
                </SelectItem>
                {options?.teachers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger aria-label={bn ? "বিষয় ফিল্টার" : "Subject filter"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব বিষয়" : "All subjects"}
                </SelectItem>
                {options?.subjects.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {bn ? item.nameBn : item.nameEn}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger aria-label={bn ? "অবস্থা ফিল্টার" : "Status filter"}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">
                  {bn ? "সব অবস্থা" : "All statuses"}
                </SelectItem>
                {(["scheduled", "open", "submitted", "cancelled"] as const).map(
                  (item) => (
                    <SelectItem key={item} value={item}>
                      {statusLabel(item, bn)}
                    </SelectItem>
                  ),
                )}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </section>
      {rows === undefined || !options ? (
        <div className="grid gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : (
        <div
          key={view}
          className="animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          {view === "week" ? (
            <WeekCalendar
              rows={rows}
              startDate={weekStart}
              locale={locale}
              onSelect={selectRow}
            />
          ) : (
            <ListAgenda
              rows={rows}
              startDate={weekStart}
              locale={locale}
              onSelect={selectRow}
            />
          )}
        </div>
      )}
      {options && mutationMode === "extra" && (
        <ClassFormDialog
          mode="extra"
          row={null}
          options={options}
          locale={locale}
          onClose={() => setMutationMode(null)}
          onCreated={(id) => {
            setMutationMode(null);
            if (id) setSelectedId(id);
          }}
        />
      )}
      {options && mutationMode === "reschedule" && details && (
        <ClassFormDialog
          mode="reschedule"
          row={details}
          options={options}
          locale={locale}
          onClose={() => setMutationMode(null)}
          onCreated={(id) => {
            setMutationMode(null);
            if (id) setSelectedId(id);
          }}
        />
      )}
      {mutationMode === "cancel" && details && (
        <CancelDialog
          row={details}
          locale={locale}
          onClose={() => setMutationMode(null)}
        />
      )}
      <Sheet
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setMutationMode(null);
          }
        }}
      >
        <SheetContent className="w-[min(560px,calc(100%-24px))]">
          <SheetHeader>
            <SheetTitle>
              {details
                ? bn
                  ? details.batchNameBn
                  : details.batchNameEn
                : bn
                  ? "ক্লাস"
                  : "Class"}
            </SheetTitle>
            <SheetDescription>
              {details
                ? `${details.courseCode} · ${displayDate(details.sessionDate, locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {details ? (
            <div className="grid gap-5 px-4">
              <SessionBadges row={details} locale={locale} />
              <div className="grid gap-3">
                <p>
                  <Clock3 className="me-2 inline size-4" />
                  {displayTime(details.startsAt, locale)}–
                  {displayTime(details.endsAt, locale)}
                </p>
                <p>
                  <Users className="me-2 inline size-4" />
                  {details.teacherName}
                </p>
                {details.subjectNameEn && (
                  <p>{bn ? details.subjectNameBn : details.subjectNameEn}</p>
                )}
              </div>
              {details.changeReason && (
                <Alert>
                  <AlertTitle>{bn ? "নোট" : "Note"}</AlertTitle>
                  <AlertDescription>{details.changeReason}</AlertDescription>
                </Alert>
              )}
              {details.isOneOffOverride && details.originalSessionDate && (
                <p className="text-sm text-[var(--ink-mute)]">
                  {bn ? "মূল সময়" : "Original time"}:{" "}
                  {displayDate(details.originalSessionDate, locale)} ·{" "}
                  {details.originalStartsAt
                    ? displayTime(details.originalStartsAt, locale)
                    : "—"}
                  –
                  {details.originalEndsAt
                    ? displayTime(details.originalEndsAt, locale)
                    : "—"}
                </p>
              )}
              {actionError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>
                    {bn ? "কাজটি সম্পন্ন হয়নি" : "Action failed"}
                  </AlertTitle>
                  <AlertDescription>{actionError}</AlertDescription>
                </Alert>
              )}
              <Separator />
              <div className="grid gap-2">
                <Button asChild variant="secondary">
                  <Link
                    href={`/${locale}/owner/batches?batchId=${details.batchId}`}
                  >
                    {bn ? "ব্যাচ খুলুন" : "Open batch"}
                  </Link>
                </Button>
                {details.canOpenAttendance && (
                  <Button onClick={takeAttendance}>
                    {bn ? "উপস্থিতি নিন" : "Take attendance"}
                  </Button>
                )}
                {details.canModify && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setMutationMode("reschedule")}
                    >
                      {bn ? "এই ক্লাস পুনঃনির্ধারণ" : "Reschedule this class"}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => setMutationMode("cancel")}
                    >
                      {bn ? "এই ক্লাস বাতিল" : "Cancel this class"}
                    </Button>
                  </>
                )}
                {details.canRestore && (
                  <Button variant="secondary" onClick={restoreSelected}>
                    <RotateCcw data-icon="inline-start" />
                    {bn ? "মূল সময়ে ফিরিয়ে নিন" : "Restore original schedule"}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-4">
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          <SheetFooter />
        </SheetContent>
      </Sheet>
    </div>
  );
}
