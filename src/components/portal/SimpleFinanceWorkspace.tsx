"use client";

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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  ReceiptText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

const money = (minor: number, locale: "bn" | "en") =>
  new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(minor / 100);
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const monthName = (key: string, locale: "bn" | "en") => {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, 1));
};
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

function FinanceNav({
  locale,
  active,
}: {
  locale: "bn" | "en";
  active: "monthly" | "receipts";
}) {
  const bn = locale === "bn";
  const items = [
    ["monthly", `/${locale}/owner/finance`, bn ? "মাসিক ফি" : "Monthly fees"],
    ["receipts", `/${locale}/owner/finance/receipts`, bn ? "রশিদ" : "Receipts"],
  ] as const;
  return (
    <nav
      className="flex gap-1 overflow-x-auto"
      aria-label={bn ? "ফাইন্যান্স নেভিগেশন" : "Finance navigation"}
    >
      {items.map(([id, href, label]) => (
        <Button key={id} variant={active === id ? "primary" : "ghost"} asChild>
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function SimpleFinanceWorkspace({
  locale,
  page = "monthly",
  studentId,
}: {
  locale: "bn" | "en";
  page?: "monthly" | "student" | "receipts";
  studentId?: Id<"students">;
}) {
  return (
    <div className="flex flex-col gap-5">
      <FinanceNav
        locale={locale}
        active={page === "receipts" ? "receipts" : "monthly"}
      />
      {page === "monthly" ? (
        <MonthlyFees locale={locale} />
      ) : page === "student" && studentId ? (
        <StudentFinanceCollection locale={locale} studentId={studentId} />
      ) : (
        <ReceiptHistory locale={locale} />
      )}
    </div>
  );
}

function MonthlyFees({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const prepare = useMutation(api.fees.functions.materializeNow);
  const collect = useMutation(api.fees.functions.collectDue);
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const data = useQuery(api.fees.functions.ownerWorklist, {
    search: search || undefined,
    courseId: courseId ? (courseId as Id<"courses">) : undefined,
    batchId: batchId ? (batchId as Id<"batches">) : undefined,
    dueOnly,
    limit: 200,
  });
  const [previousData, setPreviousData] = useState(data);
  const displayData = data ?? previousData;
  useEffect(() => {
    void prepare({}).catch(() => undefined);
  }, [prepare]);
  const batches =
    scopes?.batches.filter((row) => !courseId || row.courseId === courseId) ??
    [];
  async function post(studentId: Id<"students">) {
    try {
      const result = await collect({ studentId, collectedOn: today() });
      toast.success(
        bn
          ? `রশিদ ${result.receiptNumber} তৈরি হয়েছে`
          : `Receipt ${result.receiptNumber} created`,
        {
          action: {
            label: bn ? "রশিদ" : "Receipt",
            onClick: () =>
              window.open(
                `/${locale}/owner/receipt/${result.collectionId}`,
                "_blank",
              ),
          },
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Collection failed");
      throw error;
    }
  }
  if (!displayData || !scopes)
    return (
      <div className="grid gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="p-6">
              <Spinner />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  const cards = [
    [
      bn ? "আজ সংগ্রহ" : "Collected today",
      money(displayData.collectedTodayMinor, locale),
    ],
    [bn ? "এখন বকেয়া" : "Due now", money(displayData.totalDueMinor, locale)],
    [
      bn ? "বকেয়া শিক্ষার্থী" : "Students with dues",
      String(displayData.studentsWithDue),
    ],
    [
      bn ? "ভবিষ্যৎ মাস পরিশোধিত" : "Future months paid",
      String(displayData.futurePaidMonths),
    ],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="font-mono">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {bn ? "মাসিক ফি সংগ্রহ" : "Monthly fee collection"}
          </CardTitle>
          <CardDescription>
            {bn
              ? "সব সক্রিয় শিক্ষার্থী দেখুন। বকেয়া শিক্ষার্থীরা প্রথমে দেখানো হয়।"
              : "View every active student. Students with dues are listed first."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(280px,1fr)_220px_220px_140px]">
            <Field>
              <FieldLabel htmlFor="fee-search">
                {bn ? "খুঁজুন" : "Search"}
              </FieldLabel>
              <Input
                id="fee-search"
                type="search"
                value={search}
                onChange={(event) => {
                  if (data !== undefined) setPreviousData(data);
                  setSearch(event.target.value);
                }}
                placeholder={
                  bn ? "নাম, আইডি বা ফোন" : "Name, ID, or guardian phone"
                }
              />
            </Field>
            <Field>
              <FieldLabel>{bn ? "কোর্স" : "Course"}</FieldLabel>
              <Select
                value={courseId || "all"}
                onValueChange={(value) => {
                  if (data !== undefined) setPreviousData(data);
                  setCourseId(value === "all" ? "" : value);
                  setBatchId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      {bn ? "সব কোর্স" : "All courses"}
                    </SelectItem>
                    {scopes.courses.map((row) => (
                      <SelectItem key={row.courseId} value={row.courseId}>
                        {bn ? row.nameBn : row.nameEn}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>{bn ? "ব্যাচ" : "Batch"}</FieldLabel>
              <Select
                value={batchId || "all"}
                onValueChange={(value) => {
                  if (data !== undefined) setPreviousData(data);
                  setBatchId(value === "all" ? "" : value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">
                      {bn ? "সব ব্যাচ" : "All batches"}
                    </SelectItem>
                    {batches.map((row) => (
                      <SelectItem key={row.batchId} value={row.batchId}>
                        {bn ? row.nameBn : row.nameEn}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="due-only">
                {bn ? "অবস্থা" : "Status"}
              </FieldLabel>
              <Field orientation="horizontal" className="min-h-10 px-1">
                <Checkbox
                  id="due-only"
                  checked={dueOnly}
                  onCheckedChange={(value) => {
                    if (data !== undefined) setPreviousData(data);
                    setDueOnly(value === true);
                  }}
                />
                <FieldLabel
                  htmlFor="due-only"
                  className="cursor-pointer font-normal"
                >
                  {bn ? "শুধু বকেয়া" : "Due only"}
                </FieldLabel>
              </Field>
            </Field>
          </div>
          {displayData.students.length === 0 ? (
            <EmptyState
              title={bn ? "কোনো শিক্ষার্থী পাওয়া যায়নি" : "No students found"}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{bn ? "শিক্ষার্থী" : "Student"}</TableHead>
                      <TableHead>
                        {bn ? "কোর্স ও ব্যাচ" : "Course & batch"}
                      </TableHead>
                      <TableHead className="pr-6 text-right">
                        {bn ? "মাসিক ফি" : "Monthly fee"}
                      </TableHead>
                      <TableHead>{bn ? "এখন বকেয়া" : "Due now"}</TableHead>
                      <TableHead>
                        {bn ? "ভবিষ্যৎ পরিশোধিত" : "Future paid"}
                      </TableHead>
                      <TableHead>{bn ? "কাজ" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.students.map((student) => (
                      <TableRow
                        key={student.studentId}
                        role="link"
                        tabIndex={0}
                        className="cursor-pointer"
                        aria-label={`${bn ? "শিক্ষার্থীর ফাইন্যান্স খুলুন" : "Open finance for"} ${student.displayName}`}
                        onClick={(event) => {
                          if (
                            (event.target as HTMLElement).closest("button, a")
                          )
                            return;
                          router.push(
                            `/${locale}/owner/finance/students/${student.studentId}`,
                          );
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" &&
                            !(event.target as HTMLElement).closest("button, a")
                          )
                            router.push(
                              `/${locale}/owner/finance/students/${student.studentId}`,
                            );
                        }}
                      >
                        <TableCell>
                          <div className="flex min-w-44 items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage
                                src={student.photoUrl ?? undefined}
                                alt={student.displayName}
                              />
                              <AvatarFallback>
                                {initials(student.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <strong className="block truncate">
                                {student.displayName}
                              </strong>
                              <div className="font-mono text-sm text-muted-foreground">
                                {student.studentNumber}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {bn ? student.courseNameBn : student.courseNameEn}
                          <div className="text-sm text-muted-foreground">
                            {bn ? student.batchNameBn : student.batchNameEn}
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 text-right font-mono">
                          {money(student.monthlyFeeMinor, locale)}
                        </TableCell>
                        <TableCell>
                          {student.dueMonths.length ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-destructive">
                                {student.dueMonths
                                  .map((key) => monthName(key, locale))
                                  .join(", ")}
                              </span>
                              <strong className="font-mono text-destructive">
                                {money(student.dueMinor, locale)}
                              </strong>
                            </div>
                          ) : (
                            <Badge variant="neutral">
                              {bn ? "পরিশোধিত" : "Clear"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.futurePaidMonths.length
                            ? student.futurePaidMonths
                                .map((key) => monthName(key, locale))
                                .join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <DueDialog
                            locale={locale}
                            student={student}
                            onConfirm={() => post(student.studentId)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {displayData.students.map((student) => (
                  <Card
                    key={student.studentId}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer"
                    aria-label={`${bn ? "শিক্ষার্থীর ফাইন্যান্স খুলুন" : "Open finance for"} ${student.displayName}`}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button, a"))
                        return;
                      router.push(
                        `/${locale}/owner/finance/students/${student.studentId}`,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !(event.target as HTMLElement).closest("button, a")
                      )
                        router.push(
                          `/${locale}/owner/finance/students/${student.studentId}`,
                        );
                    }}
                  >
                    <CardHeader className="flex-row items-center gap-3">
                      <Avatar className="size-11">
                        <AvatarImage
                          src={student.photoUrl ?? undefined}
                          alt={student.displayName}
                        />
                        <AvatarFallback>
                          {initials(student.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {student.displayName}
                        </CardTitle>
                        <CardDescription>
                          {student.studentNumber} ·{" "}
                          {bn ? student.batchNameBn : student.batchNameEn}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-muted-foreground">
                            {bn ? "মাসিক" : "Monthly"}
                          </dt>
                          <dd className="font-mono">
                            {money(student.monthlyFeeMinor, locale)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {bn ? "বকেয়া" : "Due"}
                          </dt>
                          <dd className="font-mono text-destructive">
                            {money(student.dueMinor, locale)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">
                            {bn ? "ভবিষ্যৎ পরিশোধিত" : "Future paid"}
                          </dt>
                          <dd>
                            {student.futurePaidMonths
                              .map((key) => monthName(key, locale))
                              .join(", ") || "—"}
                          </dd>
                        </div>
                      </dl>
                      <DueDialog
                        locale={locale}
                        student={student}
                        onConfirm={() => post(student.studentId)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type WorklistStudent = {
  studentId: Id<"students">;
  studentNumber: string;
  displayName: string;
  monthlyFeeMinor: number;
  dueMinor: number;
  dueMonths: string[];
};
function DueDialog({
  locale,
  student,
  onConfirm,
}: {
  locale: "bn" | "en";
  student: WorklistStudent;
  onConfirm: () => Promise<void>;
}) {
  const bn = locale === "bn";
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const hasDue = student.dueMinor > 0 && student.dueMonths.length > 0;
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          disabled={!hasDue}
          variant="secondary"
          size="sm"
          className="w-full md:w-auto"
        >
          {bn ? "বকেয়া নিন" : "Collect due"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {bn
              ? `${student.displayName}-এর ফি সংগ্রহ`
              : `Collect fees for ${student.displayName}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bn
              ? "নিচের সব মাস সম্পূর্ণ পরিশোধিত হবে। ভুল হলে সংগ্রহটি বাতিল করতে হবে।"
              : "Every month below will be paid in full. Corrections require voiding the collection."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          {student.dueMonths.map((key) => (
            <div key={key} className="flex justify-between gap-4">
              <span>{monthName(key, locale)}</span>
              <span className="font-mono">
                {money(student.monthlyFeeMinor, locale)}
              </span>
            </div>
          ))}
          <div className="flex justify-between gap-4 font-semibold">
            <span>{bn ? "মোট" : "Total"}</span>
            <span className="font-mono">{money(student.dueMinor, locale)}</span>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || !hasDue}
            onClick={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch {
                // The collection handler already reports the server error.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {bn ? "সংগ্রহ নিশ্চিত করুন" : "Confirm collection"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StudentFinanceCollection({
  locale,
  studentId,
}: {
  locale: "bn" | "en";
  studentId: Id<"students">;
}) {
  const bn = locale === "bn";
  const collectMonths = useMutation(api.fees.functions.collectMonths);
  const collectOther = useMutation(api.fees.functions.collectOther);
  const options = useQuery(api.fees.functions.studentCollectionOptions, {
    studentId,
  });
  const [mode, setMode] = useState<"monthly" | "other">("monthly");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    collectedOn: string;
    note?: string;
    feeName?: string;
    amountMinor?: number;
  } | null>(null);
  const selectedTotal = useMemo(
    () =>
      options?.months
        .filter((row) => selected.includes(row.periodKey))
        .reduce((sum, row) => sum + row.amountMinor, 0) ?? 0,
    [options, selected],
  );
  if (!options) return <Spinner />;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending({
      collectedOn: String(form.get("collectedOn")),
      note: String(form.get("note") || "") || undefined,
      feeName: mode === "other" ? String(form.get("feeName")) : undefined,
      amountMinor:
        mode === "other"
          ? Math.round(Number(form.get("amount")) * 100)
          : undefined,
    });
  }
  async function confirmCollection() {
    if (!pending) return;
    setBusy(true);
    try {
      const result =
        mode === "monthly"
          ? await collectMonths({
              studentId,
              periodKeys: selected,
              collectedOn: pending.collectedOn,
              note: pending.note,
            })
          : await collectOther({
              studentId,
              feeName: pending.feeName ?? "",
              amountMinor: pending.amountMinor ?? 0,
              collectedOn: pending.collectedOn,
              note: pending.note,
            });
      toast.success(
        bn
          ? `রশিদ ${result.receiptNumber} তৈরি হয়েছে`
          : `Receipt ${result.receiptNumber} created`,
        {
          action: {
            label: bn ? "খুলুন" : "Open",
            onClick: () =>
              window.open(
                `/${locale}/owner/receipt/${result.collectionId}`,
                "_blank",
              ),
          },
        },
      );
      setSelected([]);
      setPending(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Collection failed");
    } finally {
      setBusy(false);
    }
  }
  const dueMonths = options.months.filter((month) => month.status === "due");
  const futurePaidMonths = options.months.filter(
    (month) => month.status === "paid",
  );
  const dueMinor = dueMonths.reduce(
    (total, month) => total + month.amountMinor,
    0,
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-2 font-medium">
          <Link href={`/${locale}/owner/finance`}>
            <ArrowLeft className="size-4" data-icon="inline-start" />
            {bn ? "মাসিক ফিতে ফিরুন" : "Back to monthly fees"}
          </Link>
        </Button>
      </div>

      {/* Student Overview Header Card */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="bg-muted/30 border-b border-border/60 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-14 ring-2 ring-background shadow-xs">
                <AvatarImage
                  src={options.photoUrl ?? undefined}
                  alt={options.displayName}
                />
                <AvatarFallback className="bg-brand/10 text-brand font-semibold text-base">
                  {initials(options.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl font-bold truncate">
                    {options.displayName}
                  </CardTitle>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium border border-border/50">
                    {options.studentNumber}
                  </span>
                </div>
                <CardDescription className="text-xs">
                  {bn
                    ? "শিক্ষার্থীর একক ফাইন্যান্স প্রফাইল"
                    : "Student Individual Finance Profile"}
                </CardDescription>
              </div>
            </div>
            <div className="self-start sm:self-center">
              <Badge
                variant={dueMinor > 0 ? "danger" : "success"}
                className="px-3 py-1 text-xs font-semibold gap-1.5 shadow-xs"
              >
                {dueMinor > 0 ? (
                  <>
                    <AlertCircle className="size-3.5" />
                    {bn ? "বকেয়া আছে" : "Payment due"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    {bn ? "পরিশোধিত" : "Clear"}
                  </>
                )}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Agreed monthly fee */}
            <div className="flex flex-col gap-1 p-4 rounded-xl bg-muted/20 border border-border/60">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {bn ? "সম্মত মাসিক ফি" : "Agreed monthly fee"}
              </span>
              <span className="font-mono text-2xl font-bold text-foreground">
                {money(options.monthlyFeeMinor, locale)}
              </span>
              <span className="text-xs text-muted-foreground">
                {bn ? "প্রতি মাসের নির্ধারিত ফি" : "Standard monthly rate"}
              </span>
            </div>

            {/* Due now */}
            <div
              className={`flex flex-col gap-1 p-4 rounded-xl border ${
                dueMinor > 0
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-muted/20 border-border/60"
              }`}
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {bn ? "এখন বকেয়া" : "Due now"}
              </span>
              <span
                className={`font-mono text-2xl font-bold ${
                  dueMinor > 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {money(dueMinor, locale)}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {dueMonths.length > 0
                  ? dueMonths
                      .map((m) => monthName(m.periodKey, locale))
                      .join(", ")
                  : bn
                    ? "কোনো বকেয়া নেই"
                    : "No due dates"}
              </span>
            </div>

            {/* Future paid */}
            <div className="flex flex-col gap-1 p-4 rounded-xl bg-muted/20 border border-border/60">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {bn ? "ভবিষ্যৎ পরিশোধিত" : "Future paid"}
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {futurePaidMonths.length > 0 ? (
                  futurePaidMonths.map((month) => (
                    <Badge
                      key={month.periodKey}
                      variant="success"
                      className="font-mono text-xs px-2 py-0.5"
                    >
                      {monthName(month.periodKey, locale)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {bn ? "কোনোটি নয়" : "None"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manual Fee Collection Card */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ReceiptText className="size-5 text-brand" />
                {bn ? "ম্যানুয়াল ফি সংগ্রহ" : "Manual fee collection"}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {bn
                  ? "এক বা একাধিক সম্পূর্ণ মাসিক ফি অথবা নামযুক্ত অন্য ফি সংগ্রহ করুন।"
                  : "Collect one or more full monthly fees, or a named other fee."}
              </CardDescription>
            </div>
            {/* Fee mode toggle */}
            <div className="self-start sm:self-center">
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(value) =>
                  value && setMode(value as "monthly" | "other")
                }
                className="bg-muted/60 p-1 rounded-lg border border-border/60"
              >
                <ToggleGroupItem
                  value="monthly"
                  className="text-xs font-medium px-3 py-1.5 rounded-md data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:shadow-xs transition-all"
                >
                  {bn ? "মাসিক ফি" : "Monthly fee"}
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="other"
                  className="text-xs font-medium px-3 py-1.5 rounded-md data-[state=on]:bg-brand data-[state=on]:text-brand-foreground data-[state=on]:shadow-xs transition-all"
                >
                  {bn ? "অন্যান্য ফি" : "Other fee"}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form className="flex flex-col gap-6" onSubmit={submit}>
            {mode === "monthly" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <FieldLabel className="text-sm font-semibold text-foreground">
                    {bn ? "মাস নির্বাচন" : "Select months"}
                  </FieldLabel>
                  <FieldDescription className="text-xs text-muted-foreground">
                    {bn
                      ? "প্রতিটি মাস সম্পূর্ণ পরিশোধিত হবে।"
                      : "Each selected month will be paid in full."}
                  </FieldDescription>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {options?.months.map((row) => {
                    const isPaid = row.status === "paid";
                    const isDue = row.status === "due";
                    const isSelected = selected.includes(row.periodKey);

                    let cardStyle =
                      "border-[var(--border)] bg-[var(--canvas)] hover:border-[var(--border-strong)] hover:bg-[var(--canvas-soft)]";
                    if (isPaid) {
                      cardStyle =
                        "cursor-not-allowed border-[var(--border-muted)] bg-[var(--canvas-subtle)] opacity-60";
                    } else if (isSelected) {
                      cardStyle =
                        "border-[var(--brand-deep)] bg-[var(--brand-muted)]";
                    } else if (isDue) {
                      cardStyle =
                        "border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[var(--danger-muted)] hover:border-[var(--danger)]";
                    }

                    return (
                      <div
                        key={row.periodKey}
                        className={`relative flex min-h-[52px] items-center justify-between gap-3 rounded-lg border p-3.5 transition-all select-none ${
                          isPaid ? "cursor-not-allowed" : "cursor-pointer"
                        } ${cardStyle}`}
                      >
                        <Checkbox
                          id={`month-${row.periodKey}`}
                          disabled={isPaid}
                          checked={isPaid || isSelected}
                          onCheckedChange={(checked) => {
                            if (isPaid) return;
                            setSelected((current) =>
                              checked === true
                                ? current.includes(row.periodKey)
                                  ? current
                                  : [...current, row.periodKey]
                                : current.filter(
                                    (key) => key !== row.periodKey,
                                  ),
                            );
                          }}
                        />
                        <label
                          htmlFor={`month-${row.periodKey}`}
                          className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${
                            isPaid ? "cursor-not-allowed" : "cursor-pointer"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {monthName(row.periodKey, locale)}
                            </span>
                            {isPaid ? (
                              <Badge
                                variant="neutral"
                                className="text-[10px] px-1.5 py-0 font-normal"
                              >
                                {bn ? "পরিশোধিত" : "Paid"}
                              </Badge>
                            ) : isDue ? (
                              <Badge variant="danger">
                                {bn ? "বকেয়া" : "Due"}
                              </Badge>
                            ) : null}
                          </div>
                          <span
                            className={`font-mono text-sm font-semibold ${
                              isDue && !isSelected ? "text-destructive" : ""
                            }`}
                          >
                            {money(row.amountMinor, locale)}
                          </span>
                        </label>
                      </div>
                    );
                  }) ?? null}
                </div>

                {/* Selection summary bar */}
                <div className="flex items-center justify-between rounded-lg bg-muted/40 border border-border/70 p-3.5 mt-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {bn
                      ? `নির্বাচিত: ${selected.length} মাস`
                      : `Selected: ${selected.length} month${
                          selected.length === 1 ? "" : "s"
                        }`}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {bn ? "মোট" : "Total"}:
                    </span>
                    <span className="font-mono text-lg font-bold text-foreground">
                      {money(selectedTotal, locale)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="fee-name">
                    {bn ? "ফির নাম" : "Fee name"}
                  </FieldLabel>
                  <Input
                    id="fee-name"
                    name="feeName"
                    placeholder={
                      bn
                        ? "যেমন: ভর্তি ফি, জরিমানা, ড্রেস"
                        : "e.g. Admission fee, Fine, Uniform"
                    }
                    required
                    maxLength={120}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fee-amount">
                    {bn ? "পরিমাণ (টাকা)" : "Amount (BDT)"}
                  </FieldLabel>
                  <Input
                    id="fee-amount"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    className="font-mono"
                    required
                  />
                </Field>
              </FieldGroup>
            )}

            <Separator className="my-1" />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="collected-on">
                  {bn ? "সংগ্রহের তারিখ" : "Collection date"}
                </FieldLabel>
                <Input
                  id="collected-on"
                  name="collectedOn"
                  type="date"
                  max={today()}
                  defaultValue={today()}
                  required
                  className="font-mono"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fee-note">
                  {bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
                </FieldLabel>
                <Input
                  id="fee-note"
                  name="note"
                  placeholder={
                    bn
                      ? "যেমন: নগদে গ্রহণ করা হয়েছে"
                      : "e.g. Received via cash"
                  }
                  maxLength={500}
                />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                size="default"
                disabled={busy || (mode === "monthly" && !selected.length)}
                className="w-full sm:w-auto min-h-[44px] px-6 font-semibold"
              >
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ReceiptText data-icon="inline-start" className="size-4" />
                )}
                {mode === "monthly"
                  ? selected.length > 0
                    ? bn
                      ? `${money(selectedTotal, locale)} সংগ্রহ ও রশিদ তৈরি`
                      : `Collect ${money(selectedTotal, locale)} & create receipt`
                    : bn
                      ? "সংগ্রহের জন্য মাস নির্বাচন করুন"
                      : "Select months to collect"
                  : bn
                    ? "ফি সংগ্রহ ও রশিদ তৈরি"
                    : "Collect fee & create receipt"}
              </Button>
            </div>
          </form>

          {/* Collection confirmation dialog */}
          <AlertDialog
            open={pending !== null}
            onOpenChange={(open) => !open && !busy && setPending(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <ReceiptText className="size-5 text-brand" />
                  {bn ? "সংগ্রহ নিশ্চিত করুন" : "Confirm collection"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pending?.collectedOn && pending.collectedOn !== today()
                    ? bn
                      ? `এটি ${pending.collectedOn} তারিখে ব্যাকডেট করা হবে।`
                      : `This collection will be backdated to ${pending.collectedOn}.`
                    : bn
                      ? "নিশ্চিত করার পর একটি প্রাপ্তি স্বীকার রশিদ তৈরি হবে।"
                      : "A printable receipt will be created immediately."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <span className="text-muted-foreground">
                    {bn ? "শিক্ষার্থী" : "Student"}
                  </span>
                  <strong className="font-semibold text-foreground">
                    {options?.displayName}
                  </strong>
                </div>
                {mode === "monthly" ? (
                  selected.map((periodKey) => (
                    <div
                      key={periodKey}
                      className="flex justify-between items-center"
                    >
                      <span className="text-muted-foreground">
                        {monthName(periodKey, locale)}
                      </span>
                      <span className="font-mono font-medium">
                        {money(
                          options?.months.find(
                            (month) => month.periodKey === periodKey,
                          )?.amountMinor ?? 0,
                          locale,
                        )}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {pending?.feeName}
                    </span>
                    <span className="font-mono font-medium">
                      {money(pending?.amountMinor ?? 0, locale)}
                    </span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between items-center font-bold text-base pt-1">
                  <span>{bn ? "মোট সংগ্রহ" : "Total collection"}</span>
                  <span className="font-mono text-lg text-brand">
                    {money(
                      mode === "monthly"
                        ? selectedTotal
                        : (pending?.amountMinor ?? 0),
                      locale,
                    )}
                  </span>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  {bn ? "ফিরে যান" : "Go back"}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmCollection();
                  }}
                >
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  {bn ? "টাকা সংগ্রহ করুন" : "Collect cash"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
      <ReceiptHistory locale={locale} studentId={studentId} />
    </div>
  );
}

function ReceiptHistory({
  locale,
  studentId,
}: {
  locale: "bn" | "en";
  studentId?: Id<"students">;
}) {
  const bn = locale === "bn";
  const rows = useQuery(api.fees.functions.listCollections, {
    studentId,
    limit: 200,
  });
  const voidCollection = useMutation(api.fees.functions.voidCollection);
  const [target, setTarget] = useState<Id<"feeCollections"> | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!rows) return <Spinner />;
  async function voidNow() {
    if (!target) return;
    setBusy(true);
    try {
      await voidCollection({ collectionId: target, reason });
      toast.success(bn ? "সংগ্রহ বাতিল হয়েছে" : "Collection voided");
      setTarget(null);
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not void collection",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="size-5 text-brand" />
          {bn ? "রশিদ ও সংগ্রহের ইতিহাস" : "Receipts and collection history"}
        </CardTitle>
        <CardDescription className="text-xs">
          {bn
            ? "সব পোস্ট ও বাতিল সংগ্রহের অডিট ইতিহাস।"
            : "Auditable history of posted and voided collections."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {rows.length === 0 ? (
          <EmptyState title={bn ? "এখনও কোনো রশিদ নেই" : "No receipts yet"} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "রশিদ" : "Receipt"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "তারিখ" : "Date"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "শিক্ষার্থী" : "Student"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "বিবরণ" : "Items"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase text-right">
                    {bn ? "পরিমাণ" : "Amount"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "অবস্থা" : "Status"}
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-muted-foreground uppercase">
                    {bn ? "কাজ" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.collectionId}
                    className={
                      row.status === "voided"
                        ? "opacity-75 bg-muted/20"
                        : undefined
                    }
                  >
                    <TableCell className="font-mono font-medium">
                      <Link
                        className="hover:underline text-brand flex items-center gap-1.5"
                        href={`/${locale}/owner/receipt/${row.collectionId}`}
                      >
                        <ReceiptText className="size-3.5 shrink-0" />
                        {row.receiptNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.collectedOn}
                    </TableCell>
                    <TableCell>
                      <strong className="block font-medium text-foreground">
                        {row.studentName}
                      </strong>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.studentNumber}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {row.itemSummary}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        row.status === "voided"
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {money(row.amountMinor, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "posted" ? "success" : "neutral"
                        }
                        className={
                          row.status === "voided"
                            ? "line-through opacity-75"
                            : undefined
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          asChild
                          className="h-8 px-2.5 text-xs"
                        >
                          <Link
                            href={`/${locale}/owner/receipt/${row.collectionId}`}
                          >
                            <FileText
                              className="size-3.5"
                              data-icon="inline-start"
                            />
                            {bn ? "দেখুন" : "View"}
                          </Link>
                        </Button>
                        {row.status === "posted" ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setTarget(row.collectionId)}
                            className="h-8 px-2.5 text-xs"
                          >
                            {bn ? "বাতিল" : "Void"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Dialog
          open={target !== null}
          onOpenChange={(open) => !open && setTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <FileText className="size-5" />
                {bn ? "সংগ্রহ বাতিল করুন" : "Void collection"}
              </DialogTitle>
              <DialogDescription>
                {bn
                  ? "মাসিক ফি আবার বকেয়া হবে। এই কাজটি অডিট ইতিহাসে থাকবে।"
                  : "Monthly fees will become due again. This action remains in the audit history."}
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="void-reason">
                {bn ? "কারণ" : "Reason"}
              </FieldLabel>
              <Input
                id="void-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  bn
                    ? "সংগ্রহ বাতিলের কারণ লিখুন..."
                    : "Enter reason for voiding collection..."
                }
                required
              />
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setTarget(null)}>
                {bn ? "ফিরে যান" : "Cancel"}
              </Button>
              <Button
                variant="danger"
                disabled={busy || !reason.trim()}
                onClick={() => void voidNow()}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                {bn ? "বাতিল নিশ্চিত করুন" : "Confirm void"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
