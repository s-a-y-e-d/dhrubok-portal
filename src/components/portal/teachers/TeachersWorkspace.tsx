"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Archive, Pencil, Plus, Search, UserCheck, Users } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
const teacherStatusLabel = (status: string, bn: boolean) => {
  const labels: Record<string, [string, string]> = {
    active: ["সক্রিয়", "Active"],
    inactive: ["নিষ্ক্রিয়", "Inactive"],
    archived: ["আর্কাইভ করা", "Archived"],
    reserved: ["অপেক্ষমাণ", "Reserved"],
    suspended: ["স্থগিত", "Suspended"],
  };
  return labels[status]?.[bn ? 0 : 1] ?? status;
};
const initial = {
  employeeCode: "",
  displayName: "",
  loginEmail: "",
  phone: "",
  bioBn: "",
  bioEn: "",
  qualificationsBn: "",
  qualificationsEn: "",
  joinedAt: "",
};

function useIsMobile() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(max-width: 767px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

function TeacherPanel({
  mobile,
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  mobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  if (mobile) {
    return <Drawer open={open} onOpenChange={onOpenChange}><DrawerContent className="mx-auto max-h-[92dvh] max-w-3xl"><DrawerHeader><DrawerTitle>{title}</DrawerTitle><DrawerDescription>{description}</DrawerDescription></DrawerHeader>{children}</DrawerContent></Drawer>;
  }
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-[min(560px,calc(100%-24px))]"><SheetHeader><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>{children}</SheetContent></Sheet>;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

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
  const generatePhotoUploadUrl = useMutation(api.academics.teachers.generatePhotoUploadUrl);
  const [values, setValues] = useState(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectPhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let photoStorageId: Id<"_storage"> | undefined;
      if (photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) throw new Error(bn ? "JPEG, PNG অথবা WebP ছবি নির্বাচন করুন।" : "Choose a JPEG, PNG, or WebP image.");
        if (photo.size > 8 * 1024 * 1024) throw new Error(bn ? "ছবিটি ৮ MB বা তার কম হতে হবে।" : "Image must be 8 MB or smaller.");
        const uploadUrl = await generatePhotoUploadUrl({});
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": photo.type }, body: photo });
        if (!response.ok) throw new Error("Could not upload the teacher image.");
        photoStorageId = ((await response.json()) as { storageId: Id<"_storage"> }).storageId;
      }
      const result = await create({
        employeeCode: values.employeeCode,
        displayName: values.displayName,
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
        photoStorageId,
        locale,
      });
      setValues(initial);
      setPhoto(null);
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
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
          <label className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarImage src={photoPreview ?? undefined} alt={values.displayName || (bn ? "শিক্ষকের ছবির প্রিভিউ" : "Teacher image preview")} />
              <AvatarFallback>{initials(values.displayName) || "T"}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 gap-1.5">
              <Label htmlFor="teacher-photo">{bn ? "শিক্ষকের ছবি" : "Teacher image"}</Label>
              <Input id="teacher-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)} />
              <small className="text-[var(--ink-mute)]">{bn ? "JPEG, PNG অথবা WebP; সর্বোচ্চ ৮ MB" : "JPEG, PNG, or WebP; 8 MB maximum"}</small>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                "displayName",
                "employeeCode",
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
  const [panelMode, setPanelMode] = useState<"profile" | "edit">("profile");
  const mobile = useIsMobile();
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
  const updateTeacher = useMutation(api.academics.teachers.update);
  const [editValues, setEditValues] = useState<typeof initial>(initial);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const openEditor = () => {
    if (!details) return;
    setEditValues({
      employeeCode: details.teacher.employeeCode,
      displayName: details.teacher.displayName,
      loginEmail: details.teacher.loginEmail,
      phone: details.teacher.phone,
      bioBn: details.teacher.bioBn,
      bioEn: details.teacher.bioEn,
      qualificationsBn: details.teacher.qualificationsBn,
      qualificationsEn: details.teacher.qualificationsEn,
      joinedAt: details.teacher.joinedAt
        ? new Date(details.teacher.joinedAt).toISOString().slice(0, 10)
        : "",
    });
    setEditError(null);
    setPanelMode("edit");
  };
  const saveTeacher = async (event: FormEvent) => {
    event.preventDefault();
    if (!details) return;
    setEditing(true);
    setEditError(null);
    try {
      await updateTeacher({
        teacherId: details.teacher.teacherId,
        ...editValues,
        joinedAt: editValues.joinedAt
          ? Date.parse(`${editValues.joinedAt}T00:00:00+06:00`)
          : undefined,
        status: details.teacher.status === "archived" ? "inactive" : details.teacher.status,
        isPublic: details.teacher.isPublic,
        publicSortOrder: details.teacher.publicSortOrder,
      });
      setPanelMode("profile");
      setFeedback(bn ? "শিক্ষকের প্রোফাইল হালনাগাদ হয়েছে।" : "Teacher profile updated.");
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setEditing(false);
    }
  };
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
                    {teacherStatusLabel(item, bn)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {teachers.results.length ? (
          <><div className="hidden md:block"><Table>
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
                      className="flex items-center gap-3 text-start hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(teacher.teacherId);
                      }}
                    >
                      <Avatar className="size-10">
                        <AvatarImage src={teacher.photoUrl ?? undefined} alt={teacher.displayName} />
                        <AvatarFallback>{initials(teacher.displayName)}</AvatarFallback>
                      </Avatar>
                      <span>
                        <strong className="block">{teacher.displayName}</strong>
                        <small>{teacher.employeeCode}</small>
                      </span>
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
                      {teacherStatusLabel(teacher.status, bn)}
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
                      {teacherStatusLabel(teacher.accountStatus, bn)}
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
          </Table></div><div className="grid gap-3 md:hidden">{teachers.results.map((teacher) => <button key={teacher.teacherId} type="button" onClick={() => setSelectedId(teacher.teacherId)} className="flex min-h-44 w-full flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--canvas)] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"><span className="flex w-full items-start justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><Avatar className="size-11"><AvatarImage src={teacher.photoUrl ?? undefined} alt={teacher.displayName} /><AvatarFallback>{initials(teacher.displayName)}</AvatarFallback></Avatar><span className="min-w-0"><strong className="block truncate">{teacher.displayName}</strong><span className="font-mono text-xs text-[var(--ink-mute)]">{teacher.employeeCode}</span></span></span><Badge variant={teacher.status === "active" ? "success" : "neutral"}>{teacherStatusLabel(teacher.status, bn)}</Badge></span><span className="min-w-0 text-sm"><span className="block truncate">{teacher.loginEmail}</span><span className="text-xs text-[var(--ink-mute)]">{teacher.phone}</span></span><span className="grid w-full grid-cols-3 gap-3 text-sm"><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "বিষয়" : "Subjects"}</span>{teacher.courseSubjectCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "ব্যাচ" : "Batches"}</span>{teacher.activeBatchCount}</span><span><span className="block text-xs text-[var(--ink-mute)]">{bn ? "ক্লাস" : "Classes"}</span>{teacher.weeklyClassCount}</span></span></button>)}</div></>
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
      <TeacherPanel
        mobile={mobile}
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) { setSelectedId(null); setPanelMode("profile"); }
        }}
        title={panelMode === "edit" ? (bn ? "শিক্ষক প্রোফাইল সম্পাদনা" : "Edit teacher profile") : (details?.teacher.displayName ?? (bn ? "শিক্ষক" : "Teacher"))}
        description={panelMode === "edit" ? (bn ? "প্রোফাইলের তথ্য হালনাগাদ করুন।" : "Update the teacher's profile information.") : (details ? `${details.teacher.employeeCode} · ${details.teacher.loginEmail}` : "")}
      >
        <div className="min-h-0 overflow-y-auto px-4 pb-4">
          {panelMode === "profile" && <SheetHeader>
            <SheetTitle>
              {details?.teacher.displayName ?? (bn ? "শিক্ষক" : "Teacher")}
            </SheetTitle>
            <SheetDescription>
              {details
                ? `${details.teacher.employeeCode} · ${details.teacher.loginEmail}`
                : ""}
            </SheetDescription>
          </SheetHeader>}
          {panelMode === "edit" && details && (
            <form className="flex flex-col gap-4" onSubmit={saveTeacher}>
              {editError && <p role="alert" className="text-sm text-[var(--danger)]">{editError}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                {(["displayName", "employeeCode", "loginEmail", "phone", "joinedAt"] as const).map((key) => (
                  <label key={key} className="grid gap-1.5"><Label htmlFor={`edit-teacher-${key}`}>{key === "displayName" ? (bn ? "প্রদর্শিত নাম" : "Display name") : key === "employeeCode" ? (bn ? "কর্মী কোড" : "Employee code") : key === "loginEmail" ? (bn ? "লগইন ইমেইল" : "Login email") : key === "joinedAt" ? (bn ? "যোগদানের তারিখ" : "Joined date") : (bn ? "ফোন" : "Phone")}</Label><Input id={`edit-teacher-${key}`} type={key === "loginEmail" ? "email" : key === "joinedAt" ? "date" : "text"} value={editValues[key]} onChange={(event) => setEditValues((current) => ({ ...current, [key]: event.target.value }))} required={["displayName", "employeeCode", "loginEmail", "phone"].includes(key)} /></label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["qualificationsBn", "qualificationsEn", "bioBn", "bioEn"] as const).map((key) => <label key={key} className="grid gap-1.5"><Label htmlFor={`edit-teacher-${key}`}>{key === "qualificationsBn" ? (bn ? "বাংলা যোগ্যতা" : "Bangla qualifications") : key === "qualificationsEn" ? (bn ? "ইংরেজি যোগ্যতা" : "English qualifications") : key === "bioBn" ? (bn ? "বাংলা পরিচিতি" : "Bangla bio") : (bn ? "ইংরেজি পরিচিতি" : "English bio")}</Label><Textarea id={`edit-teacher-${key}`} value={editValues[key]} onChange={(event) => setEditValues((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => setPanelMode("profile")}>{bn ? "বাতিল" : "Cancel"}</Button><Button type="submit" disabled={editing}>{editing ? (bn ? "সংরক্ষণ হচ্ছে…" : "Saving…") : (bn ? "পরিবর্তন সংরক্ষণ" : "Save changes")}</Button></div>
            </form>
          )}
          {panelMode === "profile" && details && (
            <div className="grid gap-5">
              <Avatar className="size-20">
                <AvatarImage src={details.teacher.photoUrl ?? undefined} alt={details.teacher.displayName} />
                <AvatarFallback>{initials(details.teacher.displayName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    details.teacher.status === "active" ? "success" : "neutral"
                  }
                >
                  {teacherStatusLabel(details.teacher.status, bn)}
                </Badge>
                <Badge
                  variant={
                    details.teacher.accountStatus === "active"
                      ? "success"
                      : "info"
                  }
                >
                  {teacherStatusLabel(details.teacher.accountStatus, bn)}
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
                {details.teacher.status !== "archived" && (
                  <Button variant="secondary" onClick={openEditor}>
                    <Pencil data-icon="inline-start" />
                    {bn ? "প্রোফাইল সম্পাদনা" : "Edit profile"}
                  </Button>
                )}
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
        </div>
      </TeacherPanel>
      <Drawer open={false}>
        <DrawerContent className="mx-auto max-h-[92dvh] max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>{bn ? "শিক্ষক প্রোফাইল সম্পাদনা" : "Edit teacher profile"}</DrawerTitle>
            <DrawerDescription>
              {bn ? "প্রোফাইলের তথ্য হালনাগাদ করুন।" : "Update the teacher's profile information."}
            </DrawerDescription>
          </DrawerHeader>
          <form className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-4" onSubmit={saveTeacher}>
            {editError && <p role="alert" className="text-sm text-[var(--danger)]">{editError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["displayName", bn ? "প্রদর্শিত নাম" : "Display name", "text"],
                ["employeeCode", bn ? "কর্মী কোড" : "Employee code", "text"],
                ["loginEmail", bn ? "লগইন ইমেইল" : "Login email", "email"],
                ["phone", bn ? "ফোন" : "Phone", "text"],
                ["joinedAt", bn ? "যোগদানের তারিখ" : "Joined date", "date"],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="grid gap-1.5">
                  <Label htmlFor={`edit-teacher-${key}`}>{label}</Label>
                  <Input id={`edit-teacher-${key}`} type={type} value={editValues[key]} onChange={(event) => setEditValues((current) => ({ ...current, [key]: event.target.value }))} required={["displayName", "employeeCode", "loginEmail", "phone"].includes(key)} />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["qualificationsBn", bn ? "বাংলা যোগ্যতা" : "Bangla qualifications"],
                ["qualificationsEn", bn ? "ইংরেজি যোগ্যতা" : "English qualifications"],
                ["bioBn", bn ? "বাংলা পরিচিতি" : "Bangla bio"],
                ["bioEn", bn ? "ইংরেজি পরিচিতি" : "English bio"],
              ] as const).map(([key, label]) => (
                <label key={key} className="grid gap-1.5">
                  <Label htmlFor={`edit-teacher-${key}`}>{label}</Label>
                  <Textarea id={`edit-teacher-${key}`} value={editValues[key]} onChange={(event) => setEditValues((current) => ({ ...current, [key]: event.target.value }))} />
                </label>
              ))}
            </div>
            <DrawerFooter className="sticky bottom-0 -mx-4 border-t border-[var(--border)] bg-[var(--canvas)] px-4">
              <Button type="submit" disabled={editing}>{editing ? (bn ? "সংরক্ষণ হচ্ছে…" : "Saving…") : (bn ? "পরিবর্তন সংরক্ষণ" : "Save changes")}</Button>
              <Button type="button" variant="secondary" onClick={() => setPanelMode("profile")}>{bn ? "বাতিল" : "Cancel"}</Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
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
