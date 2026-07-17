"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Archive,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDetailDrawer } from "@/components/portal/ResponsiveDetailDrawer";
import {
  Select,
  SelectContent,
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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/portal/DatePicker";
import { cn } from "@/lib/utils";

type Locale = "bn" | "en";
const academicStatusLabel = (status: string, bn: boolean) => {
  const labels: Record<string, [string, string]> = {
    active: ["সক্রিয়", "Active"],
    planned: ["পরিকল্পিত", "Planned"],
    completed: ["সম্পন্ন", "Completed"],
    archived: ["আর্কাইভ করা", "Archived"],
  };
  return labels[status]?.[bn ? 0 : 1] ?? status;
};
type TeacherSelection = { teacherId: string; subjectIds: string[] };
type RoutineRow = {
  id: string;
  weekday: string;
  start: string;
  end: string;
  teacherId: string;
  subjectId: string;
  error?: string;
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
const emptyRoutine = (): RoutineRow => ({
  id: crypto.randomUUID(),
  weekday: "0",
  start: "",
  end: "",
  teacherId: "",
  subjectId: "",
});
const minutes = (value: string) => {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};

function WizardSteps({ step, bn }: { step: number; bn: boolean }) {
  const labels = bn
    ? ["কোর্সের তথ্য", "শিক্ষক ও বিষয়", "প্রথম ব্যাচ ও রুটিন"]
    : ["Course details", "Teachers & subjects", "First batch & routine"];
  return (
    <ol
      className="grid grid-cols-3 gap-2"
      aria-label={bn ? "কোর্স তৈরির ধাপ" : "Course creation steps"}
    >
      {labels.map((label, index) => (
        <li
          key={label}
          className={`rounded-[var(--radius-sm)] border px-3 py-2 text-xs font-medium ${index + 1 === step ? "border-[var(--brand-deep)] bg-[var(--brand-muted)] text-[var(--ink)]" : index + 1 < step ? "border-[var(--border)] text-[var(--ink-secondary)]" : "border-[var(--border)] text-[var(--ink-faint)]"}`}
          aria-current={index + 1 === step ? "step" : undefined}
        >
          {index + 1 < step ? (
            <Check className="me-1 inline size-3" />
          ) : (
            `${index + 1}. `
          )}
          {label}
        </li>
      ))}
    </ol>
  );
}

function CourseCreateDialog({
  open,
  onOpenChange,
  locale,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  locale: Locale;
  onCreated: (id: Id<"courses">) => void;
}) {
  const bn = locale === "bn";
  const options = useQuery(api.academics.options.ownerWorkspace, {});
  const create = useMutation(api.academics.courses.createWithFirstBatch);
  const uploadUrl = useMutation(api.academics.courses.generateCoverUploadUrl);
  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [course, setCourse] = useState({
    nameBn: "",
    nameEn: "",
    code: "",
    shortDescriptionBn: "",
    shortDescriptionEn: "",
    descriptionBn: "",
    descriptionEn: "",
  });
  const [cover, setCover] = useState<File | null>(null);
  const [teachers, setTeachers] = useState<TeacherSelection[]>([
    { teacherId: "", subjectIds: [] },
  ]);
  const [batch, setBatch] = useState({
    nameBn: "",
    nameEn: "",
    code: "",
    startDate: "",
  });
  const [routine, setRoutine] = useState<RoutineRow[]>([emptyRoutine()]);

  const assignedSubjects = useMemo(
    () =>
      new Map(
        teachers.flatMap((row) =>
          row.subjectIds.map(
            (subjectId) => [subjectId, row.teacherId] as const,
          ),
        ),
      ),
    [teachers],
  );
  const reset = () => {
    setStep(1);
    setDirty(false);
    setMessage(null);
    setCourse({
      nameBn: "",
      nameEn: "",
      code: "",
      shortDescriptionBn: "",
      shortDescriptionEn: "",
      descriptionBn: "",
      descriptionEn: "",
    });
    setCover(null);
    setTeachers([{ teacherId: "", subjectIds: [] }]);
    setBatch({ nameBn: "", nameEn: "", code: "", startDate: "" });
    setRoutine([emptyRoutine()]);
  };
  const requestClose = () =>
    dirty ? setConfirmClose(true) : onOpenChange(false);
  const validateStep = () => {
    setMessage(null);
    if (step === 1 && Object.values(course).some((value) => !value.trim())) {
      setMessage(
        bn
          ? "সব আবশ্যক তথ্য পূরণ করুন।"
          : "Complete every required course field.",
      );
      return false;
    }
    if (
      step === 2 &&
      (!teachers.length ||
        teachers.some((row) => !row.teacherId || !row.subjectIds.length))
    ) {
      setMessage(
        bn
          ? "প্রতিটি শিক্ষককে অন্তত একটি বিষয় দিন।"
          : "Give every selected teacher at least one subject.",
      );
      return false;
    }
    return true;
  };
  const validateRoutine = () => {
    const next = routine.map((row) => ({
      ...row,
      error:
        !row.start || !row.end || !row.teacherId
          ? bn
            ? "দিন, সময় ও শিক্ষক আবশ্যক।"
            : "Day, time, and teacher are required."
          : minutes(row.end) <= minutes(row.start)
            ? bn
              ? "শেষ সময় শুরুর পরে হতে হবে।"
              : "End time must be after start time."
            : undefined,
    }));
    for (let i = 0; i < next.length; i += 1)
      for (let j = i + 1; j < next.length; j += 1)
        if (
          next[i].weekday === next[j].weekday &&
          minutes(next[i].start) < minutes(next[j].end) &&
          minutes(next[i].end) > minutes(next[j].start)
        ) {
          next[i].error = next[j].error = bn
            ? "একই ব্যাচে সময় সংঘর্ষ।"
            : "Time conflict within this batch.";
        }
    setRoutine(next);
    return !next.some((row) => row.error);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !batch.nameBn ||
      !batch.nameEn ||
      !batch.code ||
      !batch.startDate ||
      !validateRoutine()
    ) {
      setMessage(
        bn
          ? "ব্যাচ ও রুটিনের ভুলগুলো ঠিক করুন।"
          : "Fix the batch and routine errors.",
      );
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      let coverStorageId: Id<"_storage"> | undefined;
      if (cover) {
        const url = await uploadUrl({});
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": cover.type },
          body: cover,
        });
        if (!response.ok) throw new Error("Cover upload failed");
        coverStorageId = (await response.json()).storageId;
      }
      const result = await create({
        course: { ...course, coverStorageId },
        defaults: teachers.map((row) => ({
          teacherId: row.teacherId as Id<"teachers">,
          subjectIds: row.subjectIds as Id<"subjects">[],
        })),
        batch,
        routine: routine.map((row) => ({
          weekday: Number(row.weekday),
          startMinutes: minutes(row.start),
          endMinutes: minutes(row.end),
          teacherId: row.teacherId as Id<"teachers">,
          subjectId: row.subjectId
            ? (row.subjectId as Id<"subjects">)
            : undefined,
        })),
      });
      reset();
      onOpenChange(false);
      onCreated(result.courseId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => (value ? onOpenChange(true) : requestClose())}
      >
        <DialogContent
          className="w-[min(800px,calc(100%-32px))] max-sm:h-[calc(100dvh-16px)] max-sm:w-[calc(100%-16px)]"
          onEscapeKeyDown={(event) => {
            if (dirty) {
              event.preventDefault();
              setConfirmClose(true);
            }
          }}
          onPointerDownOutside={(event) => {
            if (dirty) {
              event.preventDefault();
              setConfirmClose(true);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {bn ? "নতুন কোর্স তৈরি" : "Create a new course"}
            </DialogTitle>
            <DialogDescription>
              {bn
                ? "একসঙ্গে কোর্স, শিক্ষক- বিষয়, প্রথম ব্যাচ ও রুটিন তৈরি করুন।"
                : "Create the course, teaching defaults, first batch, and weekly routine together."}
            </DialogDescription>
          </DialogHeader>
          <WizardSteps step={step} bn={bn} />
          {message && (
            <p
              role="alert"
              className="rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-muted)] p-3 text-sm text-[var(--danger-deep)]"
            >
              {message}
            </p>
          )}
          <form
            className="grid gap-4"
            onChange={() => setDirty(true)}
            onSubmit={submit}
          >
            {step === 1 && (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["nameBn", "nameEn", "code"] as const).map((key) => (
                    <div key={key} className="grid gap-1.5">
                      <Label htmlFor={`course-${key}`}>
                        {key === "nameBn"
                          ? bn
                            ? "বাংলা নাম"
                            : "Bangla name"
                          : key === "nameEn"
                            ? bn
                              ? "ইংরেজি নাম"
                              : "English name"
                            : bn
                              ? "কোর্স কোড"
                              : "Course code"}
                      </Label>
                      <Input
                        id={`course-${key}`}
                        value={course[key]}
                        onChange={(e) =>
                          setCourse((current) => ({
                            ...current,
                            [key]: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>
                      {bn
                        ? "বাংলা সংক্ষিপ্ত বিবরণ"
                        : "Bangla short description"}
                    </Label>
                    <Input
                      value={course.shortDescriptionBn}
                      onChange={(e) =>
                        setCourse({
                          ...course,
                          shortDescriptionBn: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>
                      {bn
                        ? "ইংরেজি সংক্ষিপ্ত বিবরণ"
                        : "English short description"}
                    </Label>
                    <Input
                      value={course.shortDescriptionEn}
                      onChange={(e) =>
                        setCourse({
                          ...course,
                          shortDescriptionEn: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>
                      {bn
                        ? "বাংলা বিস্তারিত বিবরণ"
                        : "Bangla detailed description"}
                    </Label>
                    <Textarea
                      value={course.descriptionBn}
                      onChange={(e) =>
                        setCourse({ ...course, descriptionBn: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>
                      {bn
                        ? "ইংরেজি বিস্তারিত বিবরণ"
                        : "English detailed description"}
                    </Label>
                    <Textarea
                      value={course.descriptionEn}
                      onChange={(e) =>
                        setCourse({ ...course, descriptionEn: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="course-cover">
                    {bn ? "কভার ছবি (ঐচ্ছিক)" : "Cover image (optional)"}
                  </Label>
                  <Input
                    id="course-cover"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCover(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-3">
                {teachers.map((selection, index) => (
                  <section
                    key={index}
                    className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4"
                  >
                    <div className="flex items-end gap-2">
                      <div className="grid flex-1 gap-1.5">
                        <Label>{bn ? "শিক্ষক" : "Teacher"}</Label>
                        <Select
                          value={selection.teacherId}
                          onValueChange={(teacherId) =>
                            setTeachers((rows) =>
                              rows.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, teacherId, subjectIds: [] }
                                  : row,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                bn ? "শিক্ষক নির্বাচন" : "Select teacher"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {options?.teachers
                              .filter(
                                (teacher) =>
                                  !teachers.some(
                                    (row, rowIndex) =>
                                      rowIndex !== index &&
                                      row.teacherId === teacher.teacherId,
                                  ),
                              )
                              .map((teacher) => (
                                <SelectItem
                                  key={teacher.teacherId}
                                  value={teacher.teacherId}
                                >
                                  {teacher.displayName}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {teachers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={bn ? "শিক্ষক সরান" : "Remove teacher"}
                          onClick={() =>
                            setTeachers((rows) =>
                              rows.filter((_, rowIndex) => rowIndex !== index),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options?.subjects.map((subject) => {
                        const owner = assignedSubjects.get(subject.subjectId);
                        const disabled = Boolean(
                          owner && owner !== selection.teacherId,
                        );
                        const checked = selection.subjectIds.includes(
                          subject.subjectId,
                        );
                        return (
                          <label
                            key={subject.subjectId}
                            className={cn(
                              "flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--canvas-soft)] px-3 py-2 text-sm transition-colors",
                              checked && "bg-[var(--brand-muted)]",
                              disabled
                                ? "opacity-45"
                                : "cursor-pointer hover:bg-[var(--canvas-subtle)]",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled || !selection.teacherId}
                              onCheckedChange={(value) =>
                                setTeachers((rows) =>
                                  rows.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          subjectIds: value
                                            ? [
                                                ...row.subjectIds,
                                                subject.subjectId,
                                              ]
                                            : row.subjectIds.filter(
                                                (id) =>
                                                  id !== subject.subjectId,
                                              ),
                                        }
                                      : row,
                                  ),
                                )
                              }
                            />
                            <span>
                              {bn ? subject.nameBn : subject.nameEn}{" "}
                              <small className="text-[var(--ink-mute)]">
                                {subject.code}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    setTeachers((rows) => [
                      ...rows,
                      { teacherId: "", subjectIds: [] },
                    ])
                  }
                >
                  <Plus />
                  {bn ? "আরও শিক্ষক" : "Add teacher"}
                </Button>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-5">
                <section className="grid gap-3">
                  <h3 className="font-semibold">
                    {bn ? "প্রথম ব্যাচ" : "First batch"}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["nameBn", "nameEn", "code", "startDate"] as const).map(
                      (key) => (
                        <div key={key} className="grid gap-1.5">
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
                              value={batch.startDate}
                              onChange={(value) =>
                                setBatch({ ...batch, startDate: value })
                              }
                              locale={locale}
                              ariaLabel={
                                bn
                                  ? "শুরুর তারিখ নির্বাচন"
                                  : "Choose start date"
                              }
                              required
                            />
                          ) : (
                            <Input
                              value={batch[key]}
                              onChange={(e) =>
                                setBatch({ ...batch, [key]: e.target.value })
                              }
                              required
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="success">{bn ? "সক্রিয়" : "Active"}</Badge>
                    <Badge variant="info">
                      {bn ? "ভর্তি চালু" : "Admission open"}
                    </Badge>
                    <Badge variant="info">{bn ? "পাবলিক" : "Public"}</Badge>
                  </div>
                </section>
                <section className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      {bn ? "সাপ্তাহিক রুটিন" : "Weekly routine"}
                    </h3>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setRoutine((rows) => [...rows, emptyRoutine()])
                      }
                    >
                      <Plus />
                      {bn ? "ক্লাস যোগ" : "Add class"}
                    </Button>
                  </div>
                  {routine.map((row, index) => {
                    const mappedSubjects =
                      teachers.find(
                        (teacher) => teacher.teacherId === row.teacherId,
                      )?.subjectIds ?? [];
                    return (
                      <div
                        key={row.id}
                        className={`grid gap-2 rounded-[var(--radius-md)] border p-3 lg:grid-cols-[1fr_1fr_1fr_1.2fr_1.2fr_auto] ${row.error ? "border-[var(--danger)]" : "border-[var(--border)]"}`}
                      >
                        <Select
                          value={row.weekday}
                          onValueChange={(weekday) =>
                            setRoutine((rows) =>
                              rows.map((item) =>
                                item.id === row.id
                                  ? { ...item, weekday }
                                  : item,
                              ),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(bn ? weekdaysBn : weekdaysEn).map(
                              (day, dayIndex) => (
                                <SelectItem key={day} value={String(dayIndex)}>
                                  {day}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                        <Input
                          type="time"
                          aria-label={bn ? "শুরুর সময়" : "Start time"}
                          value={row.start}
                          onChange={(e) =>
                            setRoutine((rows) =>
                              rows.map((item) =>
                                item.id === row.id
                                  ? { ...item, start: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <Input
                          type="time"
                          aria-label={bn ? "শেষ সময়" : "End time"}
                          value={row.end}
                          onChange={(e) =>
                            setRoutine((rows) =>
                              rows.map((item) =>
                                item.id === row.id
                                  ? { ...item, end: e.target.value }
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
                            <SelectValue
                              placeholder={bn ? "শিক্ষক" : "Teacher"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers
                              .filter((teacher) => teacher.teacherId)
                              .map((teacher) => (
                                <SelectItem
                                  key={teacher.teacherId}
                                  value={teacher.teacherId}
                                >
                                  {
                                    options?.teachers.find(
                                      (item) =>
                                        item.teacherId === teacher.teacherId,
                                    )?.displayName
                                  }
                                </SelectItem>
                              ))}
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
                                bn ? "বিষয় (ঐচ্ছিক)" : "Subject (optional)"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {bn ? "বিষয় নেই" : "No subject"}
                            </SelectItem>
                            {mappedSubjects.map((subjectId) => {
                              const subject = options?.subjects.find(
                                (item) => item.subjectId === subjectId,
                              );
                              return subject ? (
                                <SelectItem key={subjectId} value={subjectId}>
                                  {bn ? subject.nameBn : subject.nameEn}
                                </SelectItem>
                              ) : null;
                            })}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={routine.length === 1}
                          aria-label={bn ? "ক্লাস সরান" : "Remove class"}
                          onClick={() =>
                            setRoutine((rows) =>
                              rows.filter((item) => item.id !== row.id),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                        {row.error && (
                          <p className="text-xs text-[var(--danger)] lg:col-span-6">
                            {row.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </section>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-between">
              <Button
                variant="secondary"
                onClick={() =>
                  step === 1 ? requestClose() : setStep((value) => value - 1)
                }
              >
                {step > 1 && <ChevronLeft />}
                {step === 1 ? (bn ? "বাতিল" : "Cancel") : bn ? "পেছনে" : "Back"}
              </Button>
              {step < 3 ? (
                <Button
                  onClick={() => {
                    if (validateStep()) setStep((value) => value + 1);
                  }}
                >
                  {bn ? "পরবর্তী" : "Next"}
                  <ChevronRight />
                </Button>
              ) : (
                <Button type="submit" loading={busy}>
                  {bn ? "কোর্স ও ব্যাচ তৈরি" : "Create course and batch"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bn
                ? "অসম্পূর্ণ তথ্য বাতিল করবেন?"
                : "Discard unfinished course?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bn
                ? "এই ফর্মের সব তথ্য হারিয়ে যাবে।"
                : "Everything entered in this wizard will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {bn ? "ফিরে যান" : "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                reset();
                onOpenChange(false);
              }}
            >
              {bn ? "বাতিল করুন" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CoursesWorkspace({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"courses"> | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const courses = usePaginatedQuery(
    api.academics.courseWorkspace.listCourses,
    { status, query },
    { initialNumItems: 20 },
  );
  const details = useQuery(
    api.academics.courseWorkspace.getCourseDetails,
    selectedId ? { courseId: selectedId } : "skip",
  );
  const archive = useMutation(api.academics.courses.archive);
  return (
    <div className="grid gap-5">
      <header className="portal-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{bn ? "একাডেমিক" : "Academics"}</p>
          <h1>{bn ? "কোর্স" : "Courses"}</h1>
          <p>
            {bn
              ? "স্থায়ী কোর্স পরিচালনা করুন; প্রতিটি নতুন ইনটেকের জন্য আলাদা ব্যাচ তৈরি হবে।"
              : "Manage permanent course offerings; each new intake is represented by its own batch."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          {bn ? "নতুন কোর্স" : "New course"}
        </Button>
      </header>
      {feedback && (
        <p
          role="status"
          className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3 text-sm"
        >
          {feedback}
        </p>
      )}
      <section className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Label className="relative flex-1">
            <span className="sr-only">
              {bn ? "কোর্স খুঁজুন" : "Search courses"}
            </span>
            <Search className="pointer-events-none absolute start-3 top-3 size-4 text-[var(--ink-mute)]" />
            <Input
              className="ps-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={bn ? "নাম বা কোড" : "Name or code"}
            />
          </Label>
          <div className="flex gap-2">
            {(["active", "archived"] as const).map((item) => (
              <Button
                key={item}
                variant={status === item ? "primary" : "secondary"}
                onClick={() => setStatus(item)}
              >
                {item === "active"
                  ? bn
                    ? "সক্রিয়"
                    : "Active"
                  : bn
                    ? "আর্কাইভ"
                    : "Archived"}
              </Button>
            ))}
          </div>
        </div>
        {courses.results.length ? (
          <><div className="hidden md:block"><Table>
            <TableHeader>
              <TableRow>
                <TableHead>{bn ? "কোর্স" : "Course"}</TableHead>
                <TableHead>{bn ? "বিষয়" : "Subjects"}</TableHead>
                <TableHead>{bn ? "শিক্ষক" : "Teachers"}</TableHead>
                <TableHead>{bn ? "ব্যাচ" : "Batches"}</TableHead>
                <TableHead>{bn ? "শিক্ষার্থী" : "Students"}</TableHead>
                <TableHead>{bn ? "ওয়েবসাইট" : "Website"}</TableHead>
                <TableHead>
                  <span className="sr-only">{bn ? "কাজ" : "Actions"}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.results.map((course) => (
                <TableRow key={course.courseId}>
                  <TableCell>
                    <button
                      className="text-start"
                      onClick={() => setSelectedId(course.courseId)}
                    >
                      <strong className="block">
                        {bn ? course.nameBn : course.nameEn}
                      </strong>
                      <small className="text-[var(--ink-mute)]">
                        {course.code}
                      </small>
                    </button>
                  </TableCell>
                  <TableCell>{course.subjectCount}</TableCell>
                  <TableCell>{course.teacherCount}</TableCell>
                  <TableCell>{course.activeBatchCount}</TableCell>
                  <TableCell>{course.activeEnrolmentCount}</TableCell>
                  <TableCell>
                    <Badge variant={course.isPublic ? "info" : "neutral"}>
                      {course.isPublic
                        ? bn
                          ? "প্রকাশিত"
                          : "Published"
                        : bn
                          ? "প্রাইভেট"
                          : "Private"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedId(course.courseId)}
                    >
                      {bn ? "খুলুন" : "Open"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div><div className="grid gap-3 md:hidden">{courses.results.map((course) => <button key={course.courseId} type="button" onClick={() => setSelectedId(course.courseId)} className="flex min-h-40 w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"><span className="flex w-full items-start justify-between gap-3"><span><strong className="block">{bn ? course.nameBn : course.nameEn}</strong><span className="font-mono text-xs text-[var(--ink-mute)]">{course.code}</span></span><Badge variant={course.isPublic ? "info" : "neutral"}>{course.isPublic ? (bn ? "প্রকাশিত" : "Published") : (bn ? "প্রাইভেট" : "Private")}</Badge></span><span className="grid w-full grid-cols-2 gap-3 text-sm"><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "বিষয়" : "Subjects"}</span>{course.subjectCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "শিক্ষক" : "Teachers"}</span>{course.teacherCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "ব্যাচ" : "Batches"}</span>{course.activeBatchCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "শিক্ষার্থী" : "Students"}</span>{course.activeEnrolmentCount}</span></span></button>)}</div></>
        ) : (
          <div className="grid place-items-center gap-2 py-16 text-center">
            <BookOpen className="size-8 text-[var(--ink-faint)]" />
            <h2 className="font-semibold">
              {bn ? "কোনো কোর্স নেই" : "No courses found"}
            </h2>
            <p className="text-sm text-[var(--ink-mute)]">
              {bn
                ? "প্রথম কোর্স তৈরি করে শুরু করুন।"
                : "Create the first course to get started."}
            </p>
          </div>
        )}
        {courses.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => courses.loadMore(20)}>
            {bn ? "আরও দেখুন" : "Load more"}
          </Button>
        )}
      </section>
      <CourseCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        locale={locale}
        onCreated={(id) => {
          setStatus("active");
          setSelectedId(id);
          setFeedback(
            bn
              ? "কোর্স, প্রথম ব্যাচ ও রুটিন তৈরি হয়েছে।"
              : "Course, first batch, and routine created.",
          );
        }}
      />
      <ResponsiveDetailDrawer
        open={Boolean(selectedId)}
        onOpenChange={(value) => {
          if (!value) setSelectedId(null);
        }}
        closeLabel={bn ? "বন্ধ করুন" : "Close"}
        title={
          details
            ? bn
              ? details.course.nameBn
              : details.course.nameEn
            : bn
              ? "কোর্স"
              : "Course"
        }
        description={details?.course.code}
      >
        {details && (
          <div className="grid gap-5">
            <div className="flex gap-2">
              <Badge
                variant={
                  details.course.status === "active" ? "success" : "neutral"
                }
              >
                {academicStatusLabel(details.course.status, bn)}
              </Badge>
              <Badge variant={details.course.isPublic ? "info" : "neutral"}>
                {details.course.isPublic
                  ? bn
                    ? "ওয়েবসাইটে প্রকাশিত"
                    : "Published"
                  : bn
                    ? "প্রাইভেট"
                    : "Private"}
              </Badge>
            </div>
            <section>
              <h3 className="mb-2 font-semibold">
                {bn ? "বিষয় ও ডিফল্ট শিক্ষক" : "Subjects and default teachers"}
              </h3>
              <div className="grid gap-2">
                {details.defaults.map((row) => (
                  <div
                    key={row.defaultId}
                    className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--border)] p-3"
                  >
                    <span>
                      {bn ? row.subjectNameBn : row.subjectNameEn}{" "}
                      <small className="text-[var(--ink-mute)]">
                        {row.subjectCode}
                      </small>
                    </span>
                    <span className="text-sm text-[var(--ink-secondary)]">
                      <Users className="me-1 inline size-4" />
                      {row.teacherName}
                    </span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">{bn ? "ব্যাচ" : "Batches"}</h3>
              {details.batches.map((batch) => (
                <div
                  key={batch.batchId}
                  className="flex justify-between border-b border-[var(--border)] py-2"
                >
                  <span>{bn ? batch.nameBn : batch.nameEn}</span>
                  <Badge
                    variant={batch.status === "active" ? "success" : "neutral"}
                  >
                    {academicStatusLabel(batch.status, bn)}
                  </Badge>
                </div>
              ))}
            </section>
            <Button variant="secondary" asChild>
              <a href={`/${locale}/owner/website`}>
                <Globe2 />
                {bn ? "ওয়েবসাইট CMS" : "Website CMS"}
              </a>
            </Button>
            {details.course.status === "active" && (
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await archive({ courseId: details.course.courseId });
                    setSelectedId(null);
                    setStatus("archived");
                    setFeedback(
                      bn ? "কোর্স আর্কাইভ হয়েছে।" : "Course archived.",
                    );
                  } catch (error) {
                    setFeedback(
                      error instanceof Error ? error.message : String(error),
                    );
                  }
                }}
              >
                <Archive />
                {bn ? "কোর্স আর্কাইভ" : "Archive course"}
              </Button>
            )}
          </div>
        )}
      </ResponsiveDetailDrawer>
    </div>
  );
}
