"use client";

import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Archive, Plus, Search, UserCheck, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

type Locale = "bn" | "en";
const initial = {
  employeeCode: "",
  displayName: "",
  nameBn: "",
  nameEn: "",
  loginEmail: "",
  phone: "",
  bioBn: "",
  bioEn: "",
  qualificationsBn: "",
  qualificationsEn: "",
  joinedAt: "",
};

function CreateTeacherDialog({
  open,
  onOpenChange,
  locale,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  locale: Locale;
  onCreated: (id: Id<"teachers">) => void;
}) {
  const bn = locale === "bn";
  const create = useMutation(api.academics.teachers.createWithReservedAccount);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await create({
        employeeCode: values.employeeCode,
        displayName: values.displayName,
        nameBn: values.nameBn || undefined,
        nameEn: values.nameEn || undefined,
        loginEmail: values.loginEmail,
        phone: values.phone,
        bioBn: values.bioBn,
        bioEn: values.bioEn,
        qualificationsBn: values.qualificationsBn,
        qualificationsEn: values.qualificationsEn,
        joinedAt: values.joinedAt
          ? Date.parse(`${values.joinedAt}T00:00:00+06:00`)
          : undefined,
        status: "active",
        isPublic: false,
        publicSortOrder: 0,
        locale,
      });
      setValues(initial);
      onOpenChange(false);
      onCreated(result.teacherId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(760px,calc(100%-24px))]">
        <DialogHeader>
          <DialogTitle>{bn ? "নতুন শিক্ষক" : "Create teacher"}</DialogTitle>
          <DialogDescription>
            {bn
              ? "প্রোফাইল তৈরি করুন এবং লগইন ইমেইল সংরক্ষণ করুন।"
              : "Create the profile and reserve portal access for the login email."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        )}
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                "displayName",
                "employeeCode",
                "nameBn",
                "nameEn",
                "loginEmail",
                "phone",
                "joinedAt",
              ] as const
            ).map((key) => (
              <label key={key} className="grid gap-1.5">
                <Label>
                  {key === "displayName"
                    ? bn
                      ? "প্রদর্শিত নাম"
                      : "Display name"
                    : key === "employeeCode"
                      ? bn
                        ? "কর্মী কোড"
                        : "Employee code"
                      : key === "nameBn"
                        ? bn
                          ? "বাংলা নাম (ঐচ্ছিক)"
                          : "Bangla name (optional)"
                        : key === "nameEn"
                          ? bn
                            ? "ইংরেজি নাম (ঐচ্ছিক)"
                            : "English name (optional)"
                          : key === "loginEmail"
                            ? bn
                              ? "লগইন ইমেইল"
                              : "Login email"
                            : key === "phone"
                              ? bn
                                ? "ফোন"
                                : "Phone"
                              : bn
                                ? "যোগদানের তারিখ"
                                : "Joined date"}
                </Label>
                <Input
                  type={
                    key === "loginEmail"
                      ? "email"
                      : key === "joinedAt"
                        ? "date"
                        : "text"
                  }
                  value={values[key]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  required={[
                    "displayName",
                    "employeeCode",
                    "loginEmail",
                    "phone",
                  ].includes(key)}
                />
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                "qualificationsBn",
                "qualificationsEn",
                "bioBn",
                "bioEn",
              ] as const
            ).map((key) => (
              <label key={key} className="grid gap-1.5">
                <Label>
                  {key === "qualificationsBn"
                    ? bn
                      ? "বাংলা যোগ্যতা"
                      : "Bangla qualifications"
                    : key === "qualificationsEn"
                      ? bn
                        ? "ইংরেজি যোগ্যতা"
                        : "English qualifications"
                      : key === "bioBn"
                        ? bn
                          ? "বাংলা পরিচিতি"
                          : "Bangla bio"
                        : bn
                          ? "ইংরেজি পরিচিতি"
                          : "English bio"}
                </Label>
                <Textarea
                  value={values[key]}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-[var(--ink-mute)]">
            {bn
              ? "অ্যাকাউন্ট দাবি করার আগে লগইন ইমেইল পরিবর্তন করা যাবে। নতুন শিক্ষক ডিফল্টভাবে প্রাইভেট থাকবে।"
              : "The login email can change until the account is claimed. New teachers stay private by default."}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {bn ? "বাতিল" : "Cancel"}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? bn
                  ? "তৈরি হচ্ছে…"
                  : "Creating…"
                : bn
                  ? "শিক্ষক তৈরি"
                  : "Create teacher"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeachersWorkspace({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const [status, setStatus] = useState<"active" | "inactive" | "archived">(
    "active",
  );
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<Id<"teachers"> | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    "deactivate" | "reactivate" | "archive" | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const teachers = usePaginatedQuery(
    api.academics.teacherWorkspace.listTeachers,
    { status, query },
    { initialNumItems: 20 },
  );
  const details = useQuery(
    api.academics.teacherWorkspace.getTeacherDetails,
    selectedId ? { teacherId: selectedId } : "skip",
  );
  const setActive = useMutation(api.academics.teacherWorkspace.setActiveState);
  const archive = useMutation(api.academics.teachers.archive);
  const runAction = async () => {
    if (!selectedId || !confirmAction) return;
    try {
      if (confirmAction === "archive") await archive({ teacherId: selectedId });
      else
        await setActive({
          teacherId: selectedId,
          active: confirmAction === "reactivate",
        });
      setFeedback(
        bn ? "শিক্ষকের অবস্থা হালনাগাদ হয়েছে।" : "Teacher status updated.",
      );
      setStatus(
        confirmAction === "archive"
          ? "archived"
          : confirmAction === "reactivate"
            ? "active"
            : "inactive",
      );
      setSelectedId(null);
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConfirmAction(null);
    }
  };
  return (
    <div className="grid gap-5">
      <header className="portal-page-header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{bn ? "জনবল" : "People"}</p>
          <h1>{bn ? "শিক্ষক" : "Teachers"}</h1>
          <p>
            {bn
              ? "শিক্ষক প্রোফাইল, পোর্টাল অ্যাক্সেস ও বর্তমান কাজ এক জায়গায় দেখুন।"
              : "Manage teacher profiles, portal access, publication, and current workload."}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus data-icon="inline-start" />
          {bn ? "নতুন শিক্ষক" : "New teacher"}
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
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="relative">
            <span className="sr-only">
              {bn ? "শিক্ষক খুঁজুন" : "Search teachers"}
            </span>
            <Search className="pointer-events-none absolute start-3 top-3 size-4 text-[var(--ink-mute)]" />
            <Input
              className="ps-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                bn ? "নাম, কোড, ইমেইল বা ফোন" : "Name, code, email, or phone"
              }
            />
          </label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as typeof status)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {(["active", "inactive", "archived"] as const).map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {teachers.results.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{bn ? "শিক্ষক" : "Teacher"}</TableHead>
                <TableHead>{bn ? "যোগাযোগ" : "Contact"}</TableHead>
                <TableHead>{bn ? "অবস্থা" : "Status"}</TableHead>
                <TableHead>{bn ? "পোর্টাল" : "Portal"}</TableHead>
                <TableHead>{bn ? "কোর্স বিষয়" : "Course subjects"}</TableHead>
                <TableHead>{bn ? "ব্যাচ" : "Batches"}</TableHead>
                <TableHead>
                  {bn ? "সাপ্তাহিক ক্লাস" : "Weekly classes"}
                </TableHead>
                <TableHead>{bn ? "ওয়েবসাইট" : "Website"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.results.map((teacher) => (
                <TableRow
                  key={teacher.teacherId}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(teacher.teacherId)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(teacher.teacherId);
                      }}
                    >
                      <strong className="block">{teacher.displayName}</strong>
                      <small>{teacher.employeeCode}</small>
                    </button>
                  </TableCell>
                  <TableCell>
                    <span className="block">{teacher.loginEmail}</span>
                    <small>{teacher.phone}</small>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        teacher.status === "active" ? "success" : "neutral"
                      }
                    >
                      {teacher.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        teacher.accountStatus === "active"
                          ? "success"
                          : teacher.accountStatus === "reserved"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {teacher.accountStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{teacher.courseSubjectCount}</TableCell>
                  <TableCell>{teacher.activeBatchCount}</TableCell>
                  <TableCell>{teacher.weeklyClassCount}</TableCell>
                  <TableCell>
                    <Badge variant={teacher.isPublic ? "info" : "neutral"}>
                      {teacher.isPublic
                        ? bn
                          ? "প্রকাশিত"
                          : "Published"
                        : bn
                          ? "প্রাইভেট"
                          : "Private"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title={bn ? "কোনো শিক্ষক নেই" : "No teachers found"}
            description={
              bn
                ? "প্রথম শিক্ষক তৈরি করে শুরু করুন।"
                : "Create the first teacher to get started."
            }
            action={
              <Button onClick={() => setCreateOpen(true)}>
                {bn ? "শিক্ষক তৈরি" : "Create teacher"}
              </Button>
            }
          />
        )}
        {teachers.status === "CanLoadMore" && (
          <Button variant="secondary" onClick={() => teachers.loadMore(20)}>
            {bn ? "আরও দেখুন" : "Load more"}
          </Button>
        )}
      </section>
      <CreateTeacherDialog
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
              {details?.teacher.displayName ?? (bn ? "শিক্ষক" : "Teacher")}
            </SheetTitle>
            <SheetDescription>
              {details
                ? `${details.teacher.employeeCode} · ${details.teacher.loginEmail}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {details && (
            <div className="grid gap-5">
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    details.teacher.status === "active" ? "success" : "neutral"
                  }
                >
                  {details.teacher.status}
                </Badge>
                <Badge
                  variant={
                    details.teacher.accountStatus === "active"
                      ? "success"
                      : "info"
                  }
                >
                  {details.teacher.accountStatus}
                </Badge>
                <Badge variant={details.teacher.isPublic ? "info" : "neutral"}>
                  {details.teacher.isPublic
                    ? bn
                      ? "প্রকাশিত"
                      : "Published"
                    : bn
                      ? "প্রাইভেট"
                      : "Private"}
                </Badge>
              </div>
              <section>
                <h3 className="mb-2 font-semibold">
                  <UserCheck className="me-2 inline size-4" />
                  {bn ? "প্রোফাইল" : "Profile"}
                </h3>
                <p>{details.teacher.phone}</p>
                <p className="text-sm text-[var(--ink-mute)]">
                  {bn
                    ? details.teacher.qualificationsBn
                    : details.teacher.qualificationsEn}
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-semibold">
                  {bn ? "কোর্সের ডিফল্ট বিষয়" : "Course default subjects"}
                </h3>
                {details.defaults.length ? (
                  details.defaults.map((row, index) => (
                    <div
                      key={`${row.courseId}-${index}`}
                      className="flex justify-between border-b border-[var(--border)] py-2"
                    >
                      <span>{bn ? row.courseNameBn : row.courseNameEn}</span>
                      <span>{bn ? row.subjectNameBn : row.subjectNameEn}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ink-mute)]">
                    {bn
                      ? "কোনো ডিফল্ট দায়িত্ব নেই"
                      : "No default responsibilities"}
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">
                  <Users className="me-2 inline size-4" />
                  {bn ? "বর্তমান ব্যাচ" : "Current batches"}
                </h3>
                {details.assignments.length ? (
                  details.assignments.map((row, index) => (
                    <a
                      key={`${row.batchId}-${index}`}
                      href={`/${locale}/owner/batches?batchId=${row.batchId}`}
                      className="block border-b border-[var(--border)] py-2"
                    >
                      <strong>{bn ? row.batchNameBn : row.batchNameEn}</strong>
                      <small className="ms-2">
                        {bn ? row.courseNameBn : row.courseNameEn}
                      </small>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ink-mute)]">
                    {bn ? "কোনো সক্রিয় ব্যাচ নেই" : "No active batches"}
                  </p>
                )}
              </section>
              <div className="flex flex-wrap gap-2">
                {details.teacher.status === "active" && (
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmAction("deactivate")}
                  >
                    {bn ? "নিষ্ক্রিয় করুন" : "Deactivate"}
                  </Button>
                )}
                {details.teacher.status === "inactive" && (
                  <Button onClick={() => setConfirmAction("reactivate")}>
                    {bn ? "সক্রিয় করুন" : "Reactivate"}
                  </Button>
                )}
                {details.teacher.status !== "archived" && (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmAction("archive")}
                  >
                    <Archive data-icon="inline-start" />
                    {bn ? "আর্কাইভ" : "Archive"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "archive"
                ? bn
                  ? "শিক্ষক আর্কাইভ করবেন?"
                  : "Archive teacher?"
                : bn
                  ? "শিক্ষকের অবস্থা পরিবর্তন করবেন?"
                  : "Change teacher status?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bn
                ? "সক্রিয় ব্যাচ বা রুটিন থাকলে সার্ভার এই কাজ বন্ধ করবে।"
                : "The server will block this action while active batches or schedules remain."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={runAction}>
              {bn ? "নিশ্চিত করুন" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
