"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type Draft = {
  participation: "present" | "absent";
  mcq: string;
  written: string;
};
type DetailSubject = FunctionReturnType<
  typeof api.exams.ownerWorkflow.ownerDetail
>["subjects"][number];

export function OwnerMarksPanel({
  locale,
  examId,
  subjects,
  activeSubjectId,
}: {
  locale: "bn" | "en";
  examId: Id<"exams">;
  subjects: DetailSubject[];
  activeSubjectId: Id<"examSubjects">;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const grid = useQuery(api.exams.ownerWorkflow.ownerSubjectGrid, {
    examId,
    examSubjectId: activeSubjectId,
  });
  const save = useMutation(api.exams.ownerWorkflow.saveOwnerRows);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!grid) return;
    const next: Record<string, Draft> = {};
    for (const { student, result } of grid.rows)
      next[student._id] = {
        participation: result?.participation ?? "present",
        mcq:
          result?.mcqScoreScaled === undefined
            ? ""
            : String(result.mcqScoreScaled / 100),
        written:
          result?.writtenScoreScaled === undefined
            ? ""
            : String(result.writtenScoreScaled / 100),
      };
    // The server snapshot is authoritative when the selected subject changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(next);
  }, [grid]);
  if (!grid) return <Skeleton className="h-80 w-full" />;
  const now = new Date();
  const todayDhaka = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  }).format(now);
  const dhakaParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const currentMinuteDhaka =
    Number(dhakaParts.find((part) => part.type === "hour")?.value ?? 0) * 60 +
    Number(dhakaParts.find((part) => part.type === "minute")?.value ?? 0);
  const beforeEnd =
    grid.exam.examDate > todayDhaka ||
    (grid.exam.examDate === todayDhaka &&
      (grid.exam.endsAtMinutes ?? 0) > currentMinuteDhaka);
  const setSubject = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("tab", "marks");
    next.set("subject", value);
    router.replace(`?${next.toString()}`);
  };
  async function persist() {
    setSaving(true);
    try {
      const invalidScore = grid!.rows.some(({ student }) => {
        const draft = drafts[student._id];
        if (draft.participation === "absent") return false;
        const mcq = draft.mcq === "" ? undefined : Number(draft.mcq);
        const written =
          draft.written === "" ? undefined : Number(draft.written);
        return (
          (mcq !== undefined &&
            (!Number.isFinite(mcq) ||
              mcq < 0 ||
              mcq > (grid!.subject.mcqFullMarksScaled ?? 0) / 100)) ||
          (written !== undefined &&
            (!Number.isFinite(written) ||
              written < 0 ||
              written > (grid!.subject.writtenFullMarksScaled ?? 0) / 100))
        );
      });
      if (invalidScore) {
        toast.error(
          locale === "bn"
            ? "নম্বর ০ থেকে পূর্ণ নম্বরের মধ্যে হতে হবে।"
            : "Each score must be between 0 and its full marks.",
          { duration: Infinity },
        );
        return;
      }
      const rows = grid!.rows.flatMap(({ student }) => {
        const draft = drafts[student._id];
        const complete =
          draft.participation === "absent" ||
          ((grid!.subject.mode === "written" || draft.mcq !== "") &&
            (grid!.subject.mode === "mcq" || draft.written !== ""));
        if (!complete) return [];
        return [
          {
            studentId: student._id,
            participation: draft.participation,
            mcqScoreScaled:
              draft.participation === "absent" || draft.mcq === ""
                ? undefined
                : Number(draft.mcq) * 100,
            writtenScoreScaled:
              draft.participation === "absent" || draft.written === ""
                ? undefined
                : Number(draft.written) * 100,
          },
        ];
      });
      if (!rows.length)
        throw new Error(
          locale === "bn"
            ? "অন্তত একজন শিক্ষার্থীর সম্পূর্ণ নম্বর লিখুন।"
            : "Complete marks for at least one student before saving.",
        );
      for (let index = 0; index < rows.length; index += 50) {
        await save({
          examId,
          examSubjectId: activeSubjectId,
          rows: rows.slice(index, index + 50),
        });
      }
      toast.success(
        locale === "bn" ? "নম্বর সংরক্ষিত হয়েছে।" : "Marks saved.",
        {
          duration: 5000,
        },
      );
    } catch {
      toast.error(
        locale === "bn"
          ? "নম্বর সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।"
          : "Could not save marks. Please try again.",
        { duration: Infinity },
      );
    } finally {
      setSaving(false);
    }
  }
  const percent = grid.counts.total
    ? Math.round((grid.counts.complete / grid.counts.total) * 100)
    : 0;
  const incompleteCount = grid.counts.total - grid.counts.complete;
  const absentCount = Object.values(drafts).filter(
    (draft) => draft.participation === "absent",
  ).length;
  return (
    <div className="flex flex-col gap-4">
      {beforeEnd ? (
        <Alert>
          <AlertTitle>
            {locale === "bn"
              ? "পরীক্ষা এখনো শেষ হয়নি"
              : "The exam has not ended yet"}
          </AlertTitle>
          <AlertDescription>
            {locale === "bn"
              ? "প্রয়োজন হলে মালিক আগেই নম্বর লিখতে পারবেন।"
              : "As an owner, you can still enter marks when necessary."}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {locale === "bn" ? "বিষয়ভিত্তিক নম্বর" : "Subject marks"}
          </CardTitle>
          <CardDescription>
            {grid.counts.complete}/{grid.counts.total}{" "}
            {locale === "bn" ? "সম্পূর্ণ" : "complete"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid items-center gap-3 md:grid-cols-[minmax(0,320px)_1fr]">
            <Select value={activeSubjectId} onValueChange={setSubject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {subjects.map(({ subject, subjectRecord }) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {locale === "bn"
                        ? subjectRecord?.nameBn
                        : subjectRecord?.nameEn}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  {grid.counts.complete}{" "}
                  {locale === "bn" ? "সংরক্ষিত" : "saved"}
                </Badge>
                <Badge variant={incompleteCount ? "warning" : "success"}>
                  {incompleteCount}{" "}
                  {locale === "bn" ? "অসম্পূর্ণ" : "incomplete"}
                </Badge>
                {absentCount ? (
                  <Badge variant="danger">
                    {absentCount} {locale === "bn" ? "অনুপস্থিত" : "absent"}
                  </Badge>
                ) : null}
                <span className="ms-auto text-sm text-muted-foreground">
                  {percent}%
                </span>
              </div>
              <Progress
                value={percent}
                aria-label={`${grid.counts.complete} of ${grid.counts.total} rows complete`}
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky start-0 bg-background">
                    {locale === "bn" ? "শিক্ষার্থী" : "Student"}
                  </TableHead>
                  <TableHead>
                    {locale === "bn" ? "অংশগ্রহণ" : "Participation"}
                  </TableHead>
                  {grid.subject.mode !== "written" ? (
                    <TableHead>
                      MCQ / {(grid.subject.mcqFullMarksScaled ?? 0) / 100}
                    </TableHead>
                  ) : null}
                  {grid.subject.mode !== "mcq" ? (
                    <TableHead>
                      {locale === "bn" ? "লিখিত" : "Written"} /{" "}
                      {(grid.subject.writtenFullMarksScaled ?? 0) / 100}
                    </TableHead>
                  ) : null}
                  <TableHead>{locale === "bn" ? "অবস্থা" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grid.rows.map(({ student, result }) => {
                  const draft = drafts[student._id] ?? {
                    participation: "present",
                    mcq: "",
                    written: "",
                  };
                  return (
                    <TableRow key={student._id} className="group">
                      <TableCell className="sticky start-0 bg-background group-hover:bg-[var(--canvas-soft)]">
                        <strong>{student.displayName}</strong>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {student.studentNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <label className="flex min-h-10 items-center gap-2">
                          <Checkbox
                            checked={draft.participation === "absent"}
                            onCheckedChange={(value) =>
                              setDrafts((current) => ({
                                ...current,
                                [student._id]: {
                                  ...draft,
                                  participation:
                                    value === true ? "absent" : "present",
                                  mcq: value === true ? "" : draft.mcq,
                                  written: value === true ? "" : draft.written,
                                },
                              }))
                            }
                            aria-label={`${student.displayName} absent`}
                          />
                          <Badge
                            variant={
                              draft.participation === "absent"
                                ? "danger"
                                : "neutral"
                            }
                          >
                            {draft.participation === "absent"
                              ? locale === "bn"
                                ? "অনুপস্থিত"
                                : "Absent"
                              : locale === "bn"
                                ? "উপস্থিত"
                                : "Present"}
                          </Badge>
                        </label>
                      </TableCell>
                      {grid.subject.mode !== "written" ? (
                        <TableCell>
                          <Input
                            className="min-w-24 text-end tabular-nums"
                            type="number"
                            min={0}
                            max={(grid.subject.mcqFullMarksScaled ?? 0) / 100}
                            step="0.01"
                            disabled={draft.participation === "absent"}
                            value={draft.mcq}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [student._id]: {
                                  ...draft,
                                  mcq: event.target.value,
                                },
                              }))
                            }
                            aria-label={`${student.displayName} MCQ`}
                          />
                        </TableCell>
                      ) : null}
                      {grid.subject.mode !== "mcq" ? (
                        <TableCell>
                          <Input
                            className="min-w-24 text-end tabular-nums"
                            type="number"
                            min={0}
                            max={
                              (grid.subject.writtenFullMarksScaled ?? 0) / 100
                            }
                            step="0.01"
                            disabled={draft.participation === "absent"}
                            value={draft.written}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [student._id]: {
                                  ...draft,
                                  written: event.target.value,
                                },
                              }))
                            }
                            aria-label={`${student.displayName} written`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant={result ? "success" : "warning"}>
                          {result
                            ? locale === "bn"
                              ? "সংরক্ষিত"
                              : "Saved"
                            : locale === "bn"
                              ? "অসম্পূর্ণ"
                              : "Incomplete"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void persist()} disabled={saving}>
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Save data-icon="inline-start" />
              )}
              {saving
                ? locale === "bn"
                  ? "সংরক্ষণ হচ্ছে…"
                  : "Saving…"
                : locale === "bn"
                  ? "নম্বর সংরক্ষণ করুন"
                  : "Save marks"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
