"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Clock3, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { PortalPageState } from "./PortalPageState";

const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(Date.now());
const formatTime = (timestamp: number, locale: "bn" | "en") =>
  new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    timeZone: "Asia/Dhaka",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
type Status = "present" | "late" | "absent";
type Roster = NonNullable<
  FunctionReturnType<typeof api.attendance.functions.getRoster>
>;
type Session = FunctionReturnType<
  typeof api.attendance.functions.listMySessions
>[number];

const statusLabel = (status: Status, bn: boolean) =>
  ({
    present: bn ? "উপস্থিত" : "Present",
    late: bn ? "দেরি" : "Late",
    absent: bn ? "অনুপস্থিত" : "Absent",
  })[status];

function SessionIdentity({
  session,
  locale,
}: {
  session: Session;
  locale: "bn" | "en";
}) {
  const bn = locale === "bn";
  return (
    <>
      <span className="font-medium text-[var(--ink)]">
        {bn ? session.batchNameBn : session.batchNameEn}
      </span>
      <span>
        {bn ? session.courseNameBn : session.courseNameEn} ·{" "}
        {session.teacherName}
      </span>
    </>
  );
}

function RosterForm({
  locale,
  roster,
}: {
  locale: "bn" | "en";
  roster: Roster;
}) {
  const bn = locale === "bn";
  const submit = useMutation(api.attendance.functions.submit);
  const openSession = useMutation(api.attendance.functions.openSession);
  const [marks, setMarks] = useState<Record<string, Status>>(() =>
    Object.fromEntries(
      roster.students.flatMap((student) =>
        student.status ? [[student.studentId, student.status]] : [],
      ),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const counts = Object.values(marks).reduce(
    (value, status) => ({ ...value, [status]: value[status] + 1 }),
    { present: 0, late: 0, absent: 0 },
  );
  const marked = counts.present + counts.late + counts.absent;
  const remaining = roster.students.length - marked;
  const lateStudents = roster.students.filter(
    (student) => marks[student.studentId] === "late",
  );
  const absentStudents = roster.students.filter(
    (student) => marks[student.studentId] === "absent",
  );

  function submitPermanently(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (remaining > 0) return;
    setBusy(true);
    setFeedback(null);
    submit({
      sessionId: roster.session.sessionId,
      records: roster.students.map((student) => ({
        studentId: student.studentId,
        status: marks[student.studentId],
      })),
    })
      .catch((cause: unknown) =>
        setFeedback(
          cause instanceof Error ? cause.message : "Submission failed",
        ),
      )
      .finally(() => setBusy(false));
  }

  function startAttendance() {
    setBusy(true);
    setFeedback(null);
    openSession({ sessionId: roster.session.sessionId })
      .catch((cause: unknown) =>
        setFeedback(
          cause instanceof Error ? cause.message : "Unable to open attendance",
        ),
      )
      .finally(() => setBusy(false));
  }

  if (roster.session.status === "scheduled")
    return (
      <Card className="rounded-[var(--radius-md)] border-[var(--border)] bg-[var(--canvas)] shadow-none">
        <CardHeader>
          <CardTitle>
            {bn ? "আজকের নির্ধারিত ক্লাস" : "Today's scheduled class"}
          </CardTitle>
          <CardDescription>
            {bn ? roster.session.batchNameBn : roster.session.batchNameEn} ·{" "}
            {bn ? roster.session.courseNameBn : roster.session.courseNameEn} ·{" "}
            {roster.session.teacherName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ink-mute)]">
            {roster.students.length}{" "}
            {bn ? "শিক্ষার্থী রোস্টারে আছে" : "students in the roster"}
          </p>
          {feedback && (
            <p className="mt-3 text-sm text-[var(--danger-deep)]">{feedback}</p>
          )}
        </CardContent>
        <CardFooter>
          <Button loading={busy} onClick={startAttendance}>
            {bn ? "উপস্থিতি নেওয়া শুরু করুন" : "Start taking attendance"}
          </Button>
        </CardFooter>
      </Card>
    );

  if (roster.session.status === "submitted")
    return (
      <Card className="rounded-[var(--radius-md)] border-[var(--border)] bg-[var(--canvas)] shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>
              {bn ? "উপস্থিতি জমা হয়েছে" : "Attendance submitted"}
            </CardTitle>
            <Badge variant="success">
              <Check aria-hidden="true" />
              {bn ? "সম্পন্ন" : "Complete"}
            </Badge>
          </div>
          <CardDescription>
            {bn ? roster.session.batchNameBn : roster.session.batchNameEn} ·{" "}
            {roster.session.teacherName}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="success">
            {bn ? "উপস্থিত" : "Present"} {roster.session.presentCount}
          </Badge>
          <Badge variant="warning">
            {bn ? "দেরি" : "Late"} {roster.session.lateCount}
          </Badge>
          <Badge variant="danger">
            {bn ? "অনুপস্থিত" : "Absent"} {roster.session.absentCount}
          </Badge>
        </CardContent>
      </Card>
    );

  return (
    <Card className="overflow-hidden rounded-[var(--radius-md)] border-[var(--border)] bg-[var(--canvas)] shadow-none">
      <CardHeader className="border-b border-[var(--border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>
              {bn ? roster.session.batchNameBn : roster.session.batchNameEn}
            </CardTitle>
            <CardDescription>
              {bn ? roster.session.courseNameBn : roster.session.courseNameEn} ·{" "}
              {roster.session.teacherName}
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setMarks(
                Object.fromEntries(
                  roster.students.map((student) => [
                    student.studentId,
                    "present",
                  ]),
                ),
              )
            }
          >
            {bn ? "সবাই উপস্থিত" : "Mark all present"}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 text-[var(--ink-secondary)]">
            <span className="size-2 rounded-full bg-[var(--success)]" />
            {bn ? "উপস্থিত" : "Present"}{" "}
            <strong className="text-[var(--ink)]">{counts.present}</strong>
          </span>
          <span className="inline-flex items-center gap-2 text-[var(--ink-secondary)]">
            <span className="size-2 rounded-full bg-[var(--warning)]" />
            {bn ? "দেরি" : "Late"}{" "}
            <strong className="text-[var(--ink)]">{counts.late}</strong>
          </span>
          <span className="inline-flex items-center gap-2 text-[var(--ink-secondary)]">
            <span className="size-2 rounded-full bg-[var(--danger)]" />
            {bn ? "অনুপস্থিত" : "Absent"}{" "}
            <strong className="text-[var(--ink)]">{counts.absent}</strong>
          </span>
          <span className="inline-flex items-center gap-2 text-[var(--ink-mute)]">
            {bn ? "বাকি" : "Remaining"}{" "}
            <strong className="text-[var(--ink)]">{remaining}</strong>
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-[var(--border)]">
          {roster.students.map((student) => (
            <div
              key={student.studentId}
              className={cn(
                "flex items-center justify-between gap-4 px-5 py-3 max-sm:flex-col max-sm:items-stretch",
                !marks[student.studentId] && "bg-[var(--canvas-subtle)]/45",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--ink)]">
                  {student.displayName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--ink-mute)]">
                  {student.studentNumber}
                </p>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                value={marks[student.studentId] ?? ""}
                onValueChange={(value) =>
                  value &&
                  setMarks((current) => ({
                    ...current,
                    [student.studentId]: value as Status,
                  }))
                }
                aria-label={`${student.displayName} attendance`}
                className="shrink-0 gap-0 max-sm:grid max-sm:grid-cols-3"
              >
                {(["present", "late", "absent"] as const).map((status) => (
                  <ToggleGroupItem
                    key={status}
                    value={status}
                    className={cn(
                      "min-h-11 min-w-20 rounded-none first:rounded-s-[var(--radius-sm)] last:rounded-e-[var(--radius-sm)]",
                      status === "present" &&
                        "data-[state=on]:border-[var(--border-strong)] data-[state=on]:bg-[var(--success-muted)] data-[state=on]:text-[var(--success-deep)]",
                      status === "late" &&
                        "data-[state=on]:border-[var(--border-strong)] data-[state=on]:bg-[var(--warning-muted)] data-[state=on]:text-[var(--warning-deep)]",
                      status === "absent" &&
                        "data-[state=on]:border-[var(--border-strong)] data-[state=on]:bg-[var(--danger-muted)] data-[state=on]:text-[var(--danger-deep)]",
                    )}
                  >
                    {statusLabel(status, bn)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">
            {remaining > 0
              ? bn
                ? `${remaining} জন শিক্ষার্থী এখনও চিহ্নিত হয়নি`
                : `${remaining} students still unmarked`
              : bn
                ? "সব শিক্ষার্থী চিহ্নিত হয়েছে"
                : "Every student is marked"}
          </p>
          {feedback && (
            <p className="mt-1 text-sm text-[var(--danger-deep)]">{feedback}</p>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={remaining > 0 || busy}>
              {bn ? "উপস্থিতি জমা দিন" : "Submit attendance"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bn
                  ? `উপস্থিতি জমা দিন — ${roster.session.batchNameBn}`
                  : `Submit attendance — ${roster.session.batchNameEn}`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bn
                  ? "জমা দেওয়ার পর উপস্থিতি আর পরিবর্তন করা যাবে না।"
                  : "Attendance cannot be changed after submission."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                {bn ? "উপস্থিত" : "Present"} {counts.present}
              </Badge>
              <Badge variant="warning">
                {bn ? "দেরি" : "Late"} {counts.late}
              </Badge>
              <Badge variant="danger">
                {bn ? "অনুপস্থিত" : "Absent"} {counts.absent}
              </Badge>
            </div>
            <div className="grid gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--warning-deep)]">
                  {bn ? "দেরি" : "Late"} ({lateStudents.length})
                </p>
                <p className="mt-1 text-sm text-[var(--ink-mute)]">
                  {lateStudents.length
                    ? lateStudents
                        .map((student) => student.displayName)
                        .join(", ")
                    : bn
                      ? "কেউ নেই"
                      : "None"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--danger-deep)]">
                  {bn ? "অনুপস্থিত" : "Absent"} ({absentStudents.length})
                </p>
                <p className="mt-1 text-sm text-[var(--ink-mute)]">
                  {absentStudents.length
                    ? absentStudents
                        .map((student) => student.displayName)
                        .join(", ")
                    : bn
                      ? "কেউ নেই"
                      : "None"}
                </p>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>
                {bn ? "বাতিল" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={submitPermanently}>
                {busy
                  ? bn
                    ? "জমা হচ্ছে…"
                    : "Submitting…"
                  : bn
                    ? "স্থায়ীভাবে জমা দিন"
                    : "Submit permanently"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

export function AttendanceEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const searchParams = useSearchParams();
  const paramSessionId = searchParams?.get("session") || "";
  const sessions = useQuery(api.attendance.functions.listMySessions, {
    sessionDate: localDate(),
  });
  const [openedAt] = useState(Date.now);
  const [selected, setSelected] = useState<Id<"classSessions"> | "">("");
  const roster = useQuery(
    api.attendance.functions.getRoster,
    selected ? { sessionId: selected } : "skip",
  );
  const recommended = useMemo(
    () =>
      sessions?.find((session) => session.status === "open") ??
      sessions?.find(
        (session) =>
          session.status === "scheduled" && session.startsAt >= openedAt,
      ) ??
      [...(sessions ?? [])]
        .reverse()
        .find((session) => session.status === "submitted") ??
      sessions?.find((session) => session.status === "scheduled"),
    [sessions, openedAt],
  );

  useEffect(() => {
    if (!sessions) return;
    const matchingSession = sessions.find(
      (session) => session.sessionId === paramSessionId,
    );
    const timeoutId = setTimeout(
      () =>
        setSelected(
          (current) =>
            matchingSession?.sessionId ??
            (sessions.some((session) => session.sessionId === current)
              ? current
              : (recommended?.sessionId ?? "")),
        ),
      0,
    );
    return () => clearTimeout(timeoutId);
  }, [sessions, paramSessionId, recommended]);

  if (!sessions) return <PortalPageState state="loading" locale={locale} />;
  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "আজ" : "Today"}</p>
        <h1>{bn ? "উপস্থিতি রোস্টার" : "Attendance roster"}</h1>
        <p>
          {bn
            ? "প্রতিটি শিক্ষার্থীকে চিহ্নিত করুন অথবা দ্রুত সবাইকে উপস্থিত করুন।"
            : "Mark each student, or quickly mark everyone present."}
        </p>
      </header>
      {sessions.length > 0 && (
        <div className="mb-4 md:hidden">
          <Select
            value={selected}
            onValueChange={(value) => setSelected(value as Id<"classSessions">)}
          >
            <SelectTrigger
              aria-label={bn ? "সেশন নির্বাচন করুন" : "Select session"}
            >
              <SelectValue
                placeholder={bn ? "সেশন নির্বাচন করুন" : "Select a session"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {sessions.map((session) => (
                  <SelectItem key={session.sessionId} value={session.sessionId}>
                    {formatTime(session.startsAt, locale)} ·{" "}
                    {bn ? session.batchNameBn : session.batchNameEn} ·{" "}
                    {session.teacherName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid items-start gap-5 md:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.65fr)]">
        <Card className="hidden rounded-[var(--radius-md)] border-[var(--border)] bg-[var(--canvas)] shadow-none md:block">
          <CardHeader>
            <CardTitle>{bn ? "আজকের সেশন" : "Today's sessions"}</CardTitle>
            <CardDescription>
              {sessions.length}{" "}
              {bn ? "টি ক্লাস" : sessions.length === 1 ? "class" : "classes"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {sessions.map((session) => (
              <Button
                key={session.sessionId}
                variant="ghost"
                onClick={() => setSelected(session.sessionId)}
                className={cn(
                  "h-auto min-h-20 w-full justify-start border-s-2 border-s-transparent px-3 py-3 text-left",
                  selected === session.sessionId &&
                    "border-s-[var(--brand)] bg-[var(--canvas-subtle)]",
                )}
              >
                <Clock3 data-icon="inline-start" />
                <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                  <span className="text-sm font-semibold">
                    {formatTime(session.startsAt, locale)}
                  </span>
                  <SessionIdentity session={session} locale={locale} />
                </span>
                <Badge
                  variant={
                    session.status === "open"
                      ? "info"
                      : session.status === "submitted"
                        ? "success"
                        : "neutral"
                  }
                >
                  {session.status === "open"
                    ? bn
                      ? "চলমান"
                      : "Open"
                    : session.status === "submitted"
                      ? bn
                        ? "জমা"
                        : "Submitted"
                      : bn
                        ? "নির্ধারিত"
                        : "Scheduled"}
                </Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
        <section>
          {selected && roster === undefined ? (
            <PortalPageState state="loading" locale={locale} />
          ) : roster ? (
            <RosterForm
              key={roster.session.sessionId}
              locale={locale}
              roster={roster}
            />
          ) : (
            <Card className="rounded-[var(--radius-md)] border-[var(--border)] bg-[var(--canvas)] shadow-none">
              <CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center">
                <Users className="text-[var(--ink-mute)]" aria-hidden="true" />
                <p className="font-medium">
                  {sessions.length
                    ? bn
                      ? "একটি সেশন নির্বাচন করুন"
                      : "Select a session"
                    : bn
                      ? "আজ কোনো সেশন নেই"
                      : "No sessions today"}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
