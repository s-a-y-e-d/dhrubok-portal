"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "convex/react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { DatePicker } from "./DatePicker";
import { PortalPageState } from "./PortalPageState";

type FieldErrors = Partial<Record<string, string>>;

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const bnDigits: Record<string, string> = {
  "\u09e6": "0",
  "\u09e7": "1",
  "\u09e8": "2",
  "\u09e9": "3",
  "\u09ea": "4",
  "\u09eb": "5",
  "\u09ec": "6",
  "\u09ed": "7",
  "\u09ee": "8",
  "\u09ef": "9",
};

function asciiDigits(value: string) {
  return value.replace(/[\u09e6-\u09ef]/g, (digit) => bnDigits[digit] ?? digit);
}

function isBangladeshPhone(value: string) {
  const digits = asciiDigits(value).replace(/\D/g, "");
  const withoutCountryCode = digits.startsWith("880") ? digits.slice(3) : digits;
  const local = withoutCountryCode.startsWith("0")
    ? withoutCountryCode.slice(1)
    : withoutCountryCode;
  return /^1[3-9]\d{8}$/.test(local);
}

function admissionErrorMessage(cause: unknown, bn: boolean) {
  const raw = cause instanceof Error ? cause.message : "";
  const message = raw
    .replace(/^[\s\S]*?Uncaught Error:\s*/, "")
    .replace(/\s+Called by client[\s\S]*$/, "")
    .trim();

  const fallback = bn
    ? "\u09ad\u09b0\u09cd\u09a4\u09bf \u09b8\u09ae\u09cd\u09aa\u09a8\u09cd\u09a8 \u0995\u09b0\u09be \u09af\u09be\u09af\u09bc\u09a8\u09bf\u0964 \u09a4\u09a5\u09cd\u09af\u0997\u09c1\u09b2\u09cb \u09a6\u09c7\u0996\u09c7 \u0986\u09ac\u09be\u09b0 \u099a\u09c7\u09b7\u09cd\u099f\u09be \u0995\u09b0\u09c1\u09a8\u0964"
    : "Could not admit the student. Check the details and try again.";

  switch (message) {
    case "Student Google email already has portal access":
      return bn
        ? "\u098f\u0987 Google \u0987\u09ae\u09c7\u0987\u09b2\u09c7 \u0987\u09a4\u09bf\u09ae\u09a7\u09cd\u09af\u09c7 \u09aa\u09cb\u09b0\u09cd\u099f\u09be\u09b2 \u0985\u09cd\u09af\u09be\u0995\u09cd\u09b8\u09c7\u09b8 \u0986\u099b\u09c7\u0964 \u09b6\u09bf\u0995\u09cd\u09b7\u09be\u09b0\u09cd\u09a5\u09c0\u09b0 \u09ad\u09bf\u09a8\u09cd\u09a8 Google \u0987\u09ae\u09c7\u0987\u09b2 \u09a6\u09bf\u09a8 \u0985\u09a5\u09ac\u09be \u09ac\u09bf\u09a6\u09cd\u09af\u09ae\u09be\u09a8 \u0985\u09cd\u09af\u09be\u0995\u09be\u0989\u09a8\u09cd\u099f\u099f\u09bf \u09a6\u09c7\u0996\u09c1\u09a8\u0964"
        : "This Google email already has portal access. Use a different student Google email or check the existing account.";
    case "Student Google email is already admitted":
      return bn
        ? "\u098f\u0987 Google \u0987\u09ae\u09c7\u0987\u09b2\u09c7 \u0987\u09a4\u09bf\u09ae\u09a7\u09cd\u09af\u09c7 \u098f\u0995\u099c\u09a8 \u09b6\u09bf\u0995\u09cd\u09b7\u09be\u09b0\u09cd\u09a5\u09c0 \u09ad\u09b0\u09cd\u09a4\u09bf \u0986\u099b\u09c7\u0964 \u09b6\u09bf\u0995\u09cd\u09b7\u09be\u09b0\u09cd\u09a5\u09c0 \u09a4\u09be\u09b2\u09bf\u0995\u09be\u09af\u09bc \u0996\u09c1\u0981\u099c\u09c7 \u09a6\u09c7\u0996\u09c1\u09a8\u0964"
        : "A student with this Google email is already admitted. Search the student list before adding a new record.";
    case "Student number is already used":
      return bn
        ? "\u09b8\u09cd\u09ac\u09df\u0982\u0995\u09cd\u09b0\u09bf\u09df Student ID \u0987\u09a4\u09bf\u09ae\u09a7\u09cd\u09af\u09c7 \u09ac\u09cd\u09af\u09ac\u09b9\u09c3\u09a4 \u09b9\u09df\u09c7\u099b\u09c7\u0964 \u0986\u09ac\u09be\u09b0 \u099a\u09c7\u09b7\u09cd\u099f\u09be \u0995\u09b0\u09c1\u09a8\u0964"
        : "The generated Student ID was already used. Please try again.";
    case "Invalid Bangladesh mobile number":
      return bn
        ? "\u09ab\u09cb\u09a8 \u09a8\u09ae\u09cd\u09ac\u09b0\u099f\u09bf \u09b8\u09a0\u09bf\u0995 \u09a8\u09af\u09bc\u0964 \u0989\u09a6\u09be\u09b9\u09b0\u09a3: 01712345678 \u0985\u09a5\u09ac\u09be +8801712345678\u0964"
        : "Enter a valid Bangladesh mobile number, for example 01712345678 or +8801712345678.";
    default:
      return message || fallback;
  }
}

function admissionErrorField(cause: unknown, data: FormData) {
  const raw = cause instanceof Error ? cause.message : "";
  const message = raw
    .replace(/^[\s\S]*?Uncaught Error:\s*/, "")
    .replace(/\s+Called by client[\s\S]*$/, "")
    .trim();

  switch (message) {
    case "Student Google email already has portal access":
    case "Student Google email is already admitted":
    case "Invalid email address":
      return "studentEmail";
    case "Monthly fee must be greater than zero":
      return "agreedMonthly";
    case "First billing month cannot be before admission":
      return "firstBillingMonth";
    case "Invalid calendar date":
      return "dateOfBirth";
    case "Could not upload the student image":
      return "photo";
    case "Invalid Bangladesh mobile number": {
      const phoneFields = [
        "studentPhone",
        "guardianPhone",
        "motherPhone",
        "alternateGuardianPhone",
      ];
      return (
        phoneFields.find((field) => {
          const value = String(data.get(field) || "").trim();
          return value && !isBangladeshPhone(value);
        }) ?? "guardianPhone"
      );
    }
    default:
      return undefined;
  }
}

function fieldTargetId(field: string) {
  const ids: Record<string, string> = {
    courseId: "direct-course",
    batchId: "direct-batch",
    photo: "direct-photo",
    dateOfBirth: "direct-date-of-birth",
    admissionDate: "direct-admission-date",
    firstBillingMonth: "direct-first-billing-month",
    initialAdmissionFee: "direct-initialAdmissionFee",
    agreedMonthly: "direct-agreedMonthly",
  };
  return ids[field] ?? `direct-${field}`;
}

function focusField(field: string) {
  window.setTimeout(() => {
    const target = document.getElementById(fieldTargetId(field));
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
  }, 0);
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextField({
  label,
  name,
  required = false,
  type = "text",
  description,
  error,
  onValueChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  description?: string;
  error?: string;
  onValueChange?: () => void;
}) {
  const inputId = `direct-${name}`;
  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Input
        id={inputId}
        name={name}
        type={type}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        onChange={onValueChange}
      />
      {error ? <FieldError id={`${inputId}-error`}>{error}</FieldError> : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

export function DirectAdmissionForm({
  locale,
  onCancel,
}: {
  locale: "bn" | "en";
  onCancel: () => void;
}) {
  const bn = locale === "bn";
  const scopes = useQuery(api.academics.options.contentScopes, {});
  const create = useMutation(api.admissions.owner.createDirectAdmission);
  const generatePhotoUploadUrl = useMutation(api.students.owner.generatePhotoUploadUrl);
  const [courseId, setCourseId] = useState<Id<"courses"> | "">("");
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [admissionDate, setAdmissionDate] = useState(dhakaToday);
  const [firstBillingMonth, setFirstBillingMonth] = useState(() =>
    dhakaToday().slice(0, 7),
  );
  const [additionalEnrolments, setAdditionalEnrolments] = useState<Array<{ courseId: Id<"courses"> | ""; batchId: Id<"batches"> | ""; agreedMonthly: string; admissionFee: string; firstBillingMonth: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const batches = useMemo(
    () => scopes?.batches.filter((row) => row.courseId === courseId) ?? [],
    [scopes, courseId],
  );

  if (!scopes) return <PortalPageState state="loading" locale={locale} />;

  const clearFieldError = (field: string) =>
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

  const requiredMessage = (label: string) =>
    bn ? `${label} \u09a6\u09bf\u09a8\u0964` : `Enter ${label}.`;
  const selectMessage = (label: string) =>
    bn ? `${label} \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u099a\u09a8 \u0995\u09b0\u09c1\u09a8\u0964` : `Select ${label}.`;
  const phoneMessage = bn
    ? "\u09b8\u09a0\u09bf\u0995 \u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6\u09bf \u09ae\u09cb\u09ac\u09be\u0987\u09b2 \u09a8\u09ae\u09cd\u09ac\u09b0 \u09a6\u09bf\u09a8\u0964 \u0989\u09a6\u09be\u09b9\u09b0\u09a3: 01712345678"
    : "Enter a valid Bangladesh mobile number, for example 01712345678.";
  const imageMessage = bn
    ? "\u099b\u09ac\u09bf JPEG, PNG \u0985\u09a5\u09ac\u09be WebP \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7 \u098f\u09ac\u0982 \u09b8\u09b0\u09cd\u09ac\u09cb\u099a\u09cd\u099a \u09ee MB\u0964"
    : "Choose a JPEG, PNG, or WebP image up to 8 MB.";

  function validateForm(data: FormData) {
    const errors: FieldErrors = {};
    const requireText = (field: string, label: string) => {
      if (!String(data.get(field) || "").trim()) errors[field] = requiredMessage(label);
    };
    const requireMoney = (field: string, label: string, min: number) => {
      const value = String(data.get(field) || "").trim();
      const numeric = Number(value);
      if (!value || !Number.isFinite(numeric) || numeric < min) {
        errors[field] =
          min > 0
            ? bn
              ? `${label} \u09e6 \u098f\u09b0 \u099a\u09c7\u09df\u09c7 \u09ac\u09c7\u09b6\u09bf \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964`
              : `${label} must be greater than 0.`
            : bn
              ? `${label} \u09e6 \u09ac\u09be \u09a4\u09be\u09b0 \u09ac\u09c7\u09b6\u09bf \u09b9\u09a4\u09c7 \u09b9\u09ac\u09c7\u0964`
              : `${label} must be 0 or more.`;
      }
    };
    const validatePhone = (field: string, required: boolean) => {
      const value = String(data.get(field) || "").trim();
      if (!value) {
        if (required) errors[field] = requiredMessage(field === "guardianPhone" ? "father's phone" : "mother's phone");
        return;
      }
      if (!isBangladeshPhone(value)) errors[field] = phoneMessage;
    };

    requireText("studentDisplayName", "full name");
    requireText("studentEmail", "Google email");
    requireText("schoolCollege", "school or college");
    requireText("currentClass", "current class");
    requireText("guardianName", "father's name");
    requireText("motherName", "mother's name");
    if (!courseId) errors.courseId = selectMessage("course");
    if (!batchId) errors.batchId = selectMessage("batch");
    if (!admissionDate) errors.admissionDate = selectMessage("admission date");
    if (!firstBillingMonth) errors.firstBillingMonth = selectMessage("first billing month");
    if (firstBillingMonth && admissionDate && firstBillingMonth < admissionDate.slice(0, 7)) {
      errors.firstBillingMonth = bn
        ? "\u09aa\u09cd\u09b0\u09a5\u09ae \u09ac\u09bf\u09b2\u09bf\u0982 \u09ae\u09be\u09b8 \u09ad\u09b0\u09cd\u09a4\u09bf\u09b0 \u09ae\u09be\u09b8\u09c7\u09b0 \u0986\u0997\u09c7 \u09b9\u09a4\u09c7 \u09aa\u09be\u09b0\u09ac\u09c7 \u09a8\u09be\u0964"
        : "First billing month cannot be before the admission month.";
    }

    const email = String(data.get("studentEmail") || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.studentEmail = bn
        ? "\u09b8\u09a0\u09bf\u0995 Google \u0987\u09ae\u09c7\u0987\u09b2 \u09a6\u09bf\u09a8\u0964"
        : "Enter a valid Google email.";
    }
    validatePhone("studentPhone", false);
    validatePhone("guardianPhone", true);
    validatePhone("motherPhone", true);
    validatePhone("alternateGuardianPhone", false);
    const photo = data.get("photo");
    if (photo instanceof File && photo.size > 0) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
        errors.photo = imageMessage;
      } else if (photo.size > 8 * 1024 * 1024) {
        errors.photo = imageMessage;
      }
    }
    requireMoney("agreedMonthly", "Agreed monthly", 0.01);
    requireMoney("initialAdmissionFee", "Admission fee", 0);
    return errors;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const clientErrors = validateForm(data);
    if (additionalEnrolments.some((row) => !row.courseId || !row.batchId || Number(row.agreedMonthly) <= 0 || !row.firstBillingMonth)) {
      toast.error(bn ? "প্রতিটি কোর্সের ব্যাচ, মাসিক ফি ও প্রথম বিলিং মাস দিন।" : "Complete the batch, monthly fee, and first billing month for every course.");
      return;
    }
    if (new Set([courseId, ...additionalEnrolments.map((row) => row.courseId)]).size !== additionalEnrolments.length + 1) {
      toast.error(bn ? "একই কোর্স একাধিকবার যোগ করা যাবে না।" : "A course can only be selected once.");
      return;
    }
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      const firstField = Object.keys(clientErrors)[0];
      toast.error(
        bn
          ? "\u099a\u09bf\u09b9\u09cd\u09a8\u09bf\u09a4 \u09ab\u09bf\u09b2\u09cd\u09a1\u099f\u09bf \u09a0\u09bf\u0995 \u0995\u09b0\u09c1\u09a8\u0964"
          : "Fix the highlighted field before admitting the student.",
        { duration: 5000, position: "top-right" },
      );
      focusField(firstField);
      return;
    }
    const opt = (key: string) =>
      String(data.get(key) || "").trim() || undefined;
    const minor = (key: string) => {
      const value = opt(key);
      return value ? Math.round(Number(value) * 100) : undefined;
    };
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const photo = data.get("photo");
      let photoStorageId: Id<"_storage"> | undefined;
      if (photo instanceof File && photo.size > 0) {
        const uploadUrl = await generatePhotoUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": photo.type },
          body: photo,
        });
        if (!response.ok) throw new Error("Could not upload the student image");
        photoStorageId = (await response.json()).storageId as Id<"_storage">;
      }
      const result = await create({
        admissionDate: String(data.get("admissionDate")),
        studentDisplayName: String(data.get("studentDisplayName")),
        studentEmail: String(data.get("studentEmail")),
        studentPhone: opt("studentPhone"),
        dateOfBirth: dateOfBirth || undefined,
        gender: opt("gender"),
        schoolCollege: String(data.get("schoolCollege")),
        currentClass: String(data.get("currentClass")),
        address: opt("address"),
        guardianName: String(data.get("guardianName")),
        guardianPhone: String(data.get("guardianPhone")),
        guardianRelationship: "father",
        alternateGuardianPhone: opt("alternateGuardianPhone"),
        motherName: String(data.get("motherName")),
        motherPhone: String(data.get("motherPhone")),
        preferredSmsLocale: "bn",
        enrolments: [
          { courseId: courseId as Id<"courses">, batchId: batchId as Id<"batches">, agreedMonthlyAmountMinor: minor("agreedMonthly") ?? 0, admissionFeeMinor: minor("initialAdmissionFee") ?? 0, firstBillingMonth },
          ...additionalEnrolments.map((row) => ({ courseId: row.courseId as Id<"courses">, batchId: row.batchId as Id<"batches">, agreedMonthlyAmountMinor: Math.round(Number(row.agreedMonthly) * 100), admissionFeeMinor: Math.round(Number(row.admissionFee || 0) * 100), firstBillingMonth: row.firstBillingMonth })),
        ],
        internalNote: opt("internalNote"),
        photoStorageId,
      });
      form.reset();
      setCourseId("");
      setBatchId("");
      setDateOfBirth("");
      setAdmissionDate(dhakaToday());
      setFirstBillingMonth(dhakaToday().slice(0, 7));
      setAdditionalEnrolments([]);
      setMessage({
        ok: true,
        text: result.receiptNumber
          ? `Student ${result.studentNumber} admitted. Admission receipt ${result.receiptNumber} is ready.`
          : `Student ${result.studentNumber} admitted successfully.`,
      });
      toast.success(
        result.receiptNumber
          ? `Student ${result.studentNumber} admitted. Admission receipt ${result.receiptNumber} is ready.`
          : `Student ${result.studentNumber} admitted successfully.`,
        { position: "top-right" },
      );
      onCancel();
    } catch (cause) {
      const text = admissionErrorMessage(cause, bn);
      const field = admissionErrorField(cause, data);
      if (field) {
        setFieldErrors({ [field]: text });
        focusField(field);
      }
      setMessage(null);
      toast.error(text, {
        duration: 7000,
        position: "top-right",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => void submit(event)}
    >
      {message ? (
        <Alert
          variant={message.ok ? "default" : "destructive"}
          role={message.ok ? "status" : "alert"}
        >
          {message.ok ? <CheckCircle2 /> : <CircleAlert />}
          <AlertTitle>
            {message.ok
              ? bn
                ? "ভর্তি সম্পন্ন"
                : "Admission complete"
              : bn
                ? "ভর্তি সম্পন্ন হয়নি"
                : "Admission failed"}
          </AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <FormSection
        title={bn ? "শিক্ষার্থীর তথ্য" : "Student details"}
        description={
          bn
            ? "পরিচয়, যোগাযোগ ও বর্তমান শিক্ষাপ্রতিষ্ঠানের তথ্য।"
            : "Identity, contact, and current institution details."
        }
      >
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.photo)}>
            <FieldLabel htmlFor="direct-photo">
              {bn ? "ছবি" : "Student image"}
            </FieldLabel>
            <Input
              id="direct-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-invalid={Boolean(fieldErrors.photo)}
              aria-describedby={
                fieldErrors.photo ? "direct-photo-error" : "direct-photo-help"
              }
              onChange={() => clearFieldError("photo")}
            />
            {fieldErrors.photo ? (
              <FieldError id="direct-photo-error">{fieldErrors.photo}</FieldError>
            ) : (
              <FieldDescription id="direct-photo-help">
                {bn ? "ঐচ্ছিক, সর্বোচ্চ ৮ MB" : "Optional, up to 8 MB"}
              </FieldDescription>
            )}
          </Field>
          <TextField
            label={bn ? "পুরো নাম" : "Full name"}
            name="studentDisplayName"
            required
            error={fieldErrors.studentDisplayName}
            onValueChange={() => clearFieldError("studentDisplayName")}
          />
          <TextField
            label={bn ? "Google ইমেইল" : "Google email"}
            name="studentEmail"
            required
            type="email"
            error={fieldErrors.studentEmail}
            onValueChange={() => clearFieldError("studentEmail")}
          />
          <TextField
            label={bn ? "শিক্ষার্থীর ফোন" : "Student phone"}
            name="studentPhone"
            type="tel"
            error={fieldErrors.studentPhone}
            onValueChange={() => clearFieldError("studentPhone")}
          />
          <Field data-invalid={Boolean(fieldErrors.dateOfBirth)}>
            <FieldLabel htmlFor="direct-date-of-birth">
              {bn ? "জন্মতারিখ" : "Date of birth"}
            </FieldLabel>
            <DatePicker
              id="direct-date-of-birth"
              value={dateOfBirth}
              onChange={(value) => {
                setDateOfBirth(value);
                clearFieldError("dateOfBirth");
              }}
              locale={locale}
              ariaLabel={bn ? "জন্মতারিখ বেছে নিন" : "Choose date of birth"}
              className={
                fieldErrors.dateOfBirth ? "border-[var(--danger)]" : undefined
              }
            />
            {fieldErrors.dateOfBirth ? (
              <FieldError id="direct-date-of-birth-error">
                {fieldErrors.dateOfBirth}
              </FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="direct-gender">
              {bn ? "লিঙ্গ" : "Gender"}
            </FieldLabel>
            <Select name="gender">
              <SelectTrigger id="direct-gender">
                <SelectValue placeholder={bn ? "নির্বাচন করুন" : "Select"} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="male">{bn ? "পুরুষ" : "Male"}</SelectItem>
                  <SelectItem value="female">
                    {bn ? "নারী" : "Female"}
                  </SelectItem>
                  <SelectItem value="other">
                    {bn ? "অন্যান্য" : "Other"}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <TextField
            label={bn ? "স্কুল বা কলেজ" : "School or college"}
            name="schoolCollege"
            required
            error={fieldErrors.schoolCollege}
            onValueChange={() => clearFieldError("schoolCollege")}
          />
          <TextField
            label={bn ? "বর্তমান শ্রেণি" : "Current class"}
            name="currentClass"
            required
            error={fieldErrors.currentClass}
            onValueChange={() => clearFieldError("currentClass")}
          />
          <Field data-invalid={Boolean(fieldErrors.admissionDate)}>
            <FieldLabel htmlFor="direct-admission-date">
              {bn ? "ভর্তির তারিখ" : "Admission date"}
            </FieldLabel>
            <DatePicker
              id="direct-admission-date"
              value={admissionDate}
              onChange={(value) => {
                setAdmissionDate(value);
                setFirstBillingMonth(value.slice(0, 7));
                clearFieldError("admissionDate");
                clearFieldError("firstBillingMonth");
              }}
              locale={locale}
              ariaLabel={bn ? "ভর্তির তারিখ বেছে নিন" : "Choose admission date"}
              required
              className={
                fieldErrors.admissionDate ? "border-[var(--danger)]" : undefined
              }
            />
            <input type="hidden" name="admissionDate" value={admissionDate} />
            {fieldErrors.admissionDate ? (
              <FieldError id="direct-admission-date-error">
                {fieldErrors.admissionDate}
              </FieldError>
            ) : null}
          </Field>
          <Field
            className="md:col-span-2"
            data-invalid={Boolean(fieldErrors.address)}
          >
            <FieldLabel htmlFor="direct-address">
              {bn ? "ঠিকানা" : "Address"}
            </FieldLabel>
            <Textarea
              id="direct-address"
              name="address"
              rows={2}
              aria-invalid={Boolean(fieldErrors.address)}
              aria-describedby={
                fieldErrors.address ? "direct-address-error" : undefined
              }
              onChange={() => clearFieldError("address")}
            />
            {fieldErrors.address ? (
              <FieldError id="direct-address-error">
                {fieldErrors.address}
              </FieldError>
            ) : null}
          </Field>
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection
        title={bn ? "অভিভাবকের তথ্য" : "Guardian details"}
        description={
          bn
            ? "বাবা ও মায়ের যোগাযোগের তথ্য।"
            : "Father and mother contact details."
        }
      >
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <TextField
            label={bn ? "বাবার নাম" : "Father's name"}
            name="guardianName"
            required
            error={fieldErrors.guardianName}
            onValueChange={() => clearFieldError("guardianName")}
          />
          <TextField
            label={bn ? "বাবার ফোন" : "Father's phone"}
            name="guardianPhone"
            required
            type="tel"
            error={fieldErrors.guardianPhone}
            onValueChange={() => clearFieldError("guardianPhone")}
          />
          <TextField
            label={bn ? "মায়ের নাম" : "Mother's name"}
            name="motherName"
            required
            error={fieldErrors.motherName}
            onValueChange={() => clearFieldError("motherName")}
          />
          <TextField
            label={bn ? "মায়ের ফোন" : "Mother's phone"}
            name="motherPhone"
            required
            type="tel"
            error={fieldErrors.motherPhone}
            onValueChange={() => clearFieldError("motherPhone")}
          />
        </FieldGroup>
      </FormSection>

      <Separator />

      <FormSection
        title={bn ? "কোর্স ও ফি" : "Course and fees"}
        description={
          bn
            ? "এনরোলমেন্ট এবং প্রাথমিক চার্জ নির্ধারণ করুন।"
            : "Set the enrolment and initial charges."
        }
      >
        <FieldGroup className="grid gap-5 md:grid-cols-2">
          <Field data-invalid={Boolean(fieldErrors.courseId)}>
            <FieldLabel htmlFor="direct-course">
              {bn ? "কোর্স" : "Course"}
            </FieldLabel>
            <Select
              required
              value={courseId}
              onValueChange={(value) => {
                setCourseId(value as Id<"courses">);
                setBatchId("");
                clearFieldError("courseId");
                clearFieldError("batchId");
              }}
            >
              <SelectTrigger
                id="direct-course"
                aria-invalid={Boolean(fieldErrors.courseId)}
                aria-describedby={
                  fieldErrors.courseId ? "direct-course-error" : undefined
                }
                className={
                  fieldErrors.courseId ? "border-[var(--danger)]" : undefined
                }
              >
                <SelectValue
                  placeholder={bn ? "কোর্স নির্বাচন করুন" : "Select a course"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {scopes.courses.filter((row) => !additionalEnrolments.some((selection) => selection.courseId === row.courseId)).map((row) => (
                    <SelectItem key={row.courseId} value={row.courseId}>
                      {bn ? row.nameBn : row.nameEn}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldErrors.courseId ? (
              <FieldError id="direct-course-error">
                {fieldErrors.courseId}
              </FieldError>
            ) : null}
          </Field>
          <Field
            data-disabled={!courseId}
            data-invalid={Boolean(fieldErrors.batchId)}
          >
            <FieldLabel htmlFor="direct-batch">
              {bn ? "ব্যাচ" : "Batch"}
            </FieldLabel>
            <Select
              required
              disabled={!courseId}
              value={batchId}
              onValueChange={(value) => {
                setBatchId(value as Id<"batches">);
                clearFieldError("batchId");
              }}
            >
              <SelectTrigger
                id="direct-batch"
                aria-invalid={Boolean(fieldErrors.batchId)}
                aria-describedby={
                  fieldErrors.batchId ? "direct-batch-error" : undefined
                }
                className={
                  fieldErrors.batchId ? "border-[var(--danger)]" : undefined
                }
              >
                <SelectValue
                  placeholder={bn ? "ব্যাচ নির্বাচন করুন" : "Select a batch"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {batches.map((row) => (
                    <SelectItem key={row.batchId} value={row.batchId}>
                      {bn ? row.nameBn : row.nameEn}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {fieldErrors.batchId ? (
              <FieldError id="direct-batch-error">
                {fieldErrors.batchId}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.firstBillingMonth)}>
            <FieldLabel htmlFor="direct-first-billing-month">
              {bn ? "প্রথম বিলিং মাস" : "First billing month"}
            </FieldLabel>
            <Input
              id="direct-first-billing-month"
              type="month"
              value={firstBillingMonth}
              min={admissionDate.slice(0, 7)}
              aria-invalid={Boolean(fieldErrors.firstBillingMonth)}
              aria-describedby={
                fieldErrors.firstBillingMonth
                  ? "direct-first-billing-month-error"
                  : undefined
              }
              onChange={(event) => {
                setFirstBillingMonth(event.target.value);
                clearFieldError("firstBillingMonth");
              }}
              required
            />
            {fieldErrors.firstBillingMonth ? (
              <FieldError id="direct-first-billing-month-error">
                {fieldErrors.firstBillingMonth}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.initialAdmissionFee)}>
            <FieldLabel htmlFor="direct-initialAdmissionFee">
              {bn ? "ভর্তি ফি (৳)" : "Admission fee (BDT)"}
            </FieldLabel>
            <Input
              id="direct-initialAdmissionFee"
              name="initialAdmissionFee"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              required
              aria-invalid={Boolean(fieldErrors.initialAdmissionFee)}
              aria-describedby={
                fieldErrors.initialAdmissionFee
                  ? "direct-initialAdmissionFee-error"
                  : undefined
              }
              onChange={() => clearFieldError("initialAdmissionFee")}
            />
            {fieldErrors.initialAdmissionFee ? (
              <FieldError id="direct-initialAdmissionFee-error">
                {fieldErrors.initialAdmissionFee}
              </FieldError>
            ) : null}
          </Field>
          <Field data-invalid={Boolean(fieldErrors.agreedMonthly)}>
            <FieldLabel htmlFor="direct-agreedMonthly">
              {bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)"}
            </FieldLabel>
            <Input
              id="direct-agreedMonthly"
              name="agreedMonthly"
              type="number"
              min="0.01"
              step="0.01"
              required
              aria-invalid={Boolean(fieldErrors.agreedMonthly)}
              aria-describedby={
                fieldErrors.agreedMonthly
                  ? "direct-agreedMonthly-error"
                  : undefined
              }
              onChange={() => clearFieldError("agreedMonthly")}
            />
            {fieldErrors.agreedMonthly ? (
              <FieldError id="direct-agreedMonthly-error">
                {fieldErrors.agreedMonthly}
              </FieldError>
            ) : null}
          </Field>
          {additionalEnrolments.map((row, index) => {
            const rowBatches = scopes.batches.filter((batch) => batch.courseId === row.courseId);
            return <FieldGroup key={index} className="md:col-span-2 grid gap-4 rounded-[var(--radius-md)] border border-[var(--border)] p-4 md:grid-cols-2">
              <Field><FieldLabel>{bn ? "অতিরিক্ত কোর্স" : "Additional course"}</FieldLabel><Select value={row.courseId} onValueChange={(value) => setAdditionalEnrolments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, courseId: value as Id<"courses">, batchId: "" } : item))}><SelectTrigger><SelectValue placeholder={bn ? "কোর্স নির্বাচন" : "Select course"} /></SelectTrigger><SelectContent><SelectGroup>{scopes.courses.filter((course) => course.courseId === row.courseId || (course.courseId !== courseId && !additionalEnrolments.some((selection, selectionIndex) => selectionIndex !== index && selection.courseId === course.courseId))).map((course) => <SelectItem key={course.courseId} value={course.courseId}>{bn ? course.nameBn : course.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
              <Field data-disabled={!row.courseId}><FieldLabel>{bn ? "ব্যাচ" : "Batch"}</FieldLabel><Select disabled={!row.courseId} value={row.batchId} onValueChange={(value) => setAdditionalEnrolments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, batchId: value as Id<"batches"> } : item))}><SelectTrigger><SelectValue placeholder={bn ? "ব্যাচ নির্বাচন" : "Select batch"} /></SelectTrigger><SelectContent><SelectGroup>{rowBatches.map((batch) => <SelectItem key={batch.batchId} value={batch.batchId}>{bn ? batch.nameBn : batch.nameEn}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel>{bn ? "সম্মত মাসিক (৳)" : "Agreed monthly (BDT)"}</FieldLabel><Input type="number" min="0.01" step="0.01" value={row.agreedMonthly} onChange={(event) => setAdditionalEnrolments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, agreedMonthly: event.target.value } : item))} /></Field>
              <Field><FieldLabel>{bn ? "ভর্তি ফি (৳)" : "Admission fee (BDT)"}</FieldLabel><Input type="number" min="0" step="0.01" value={row.admissionFee} onChange={(event) => setAdditionalEnrolments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, admissionFee: event.target.value } : item))} /></Field>
              <Field><FieldLabel>{bn ? "প্রথম বিলিং মাস" : "First billing month"}</FieldLabel><Input type="month" min={admissionDate.slice(0, 7)} value={row.firstBillingMonth} onChange={(event) => setAdditionalEnrolments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, firstBillingMonth: event.target.value } : item))} /></Field>
              <div className="flex items-end justify-end"><Button type="button" variant="danger" onClick={() => setAdditionalEnrolments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{bn ? "সরান" : "Remove"}</Button></div>
            </FieldGroup>;
          })}
          <div className="md:col-span-2"><Button type="button" variant="secondary" disabled={additionalEnrolments.length + 1 >= scopes.courses.length} onClick={() => setAdditionalEnrolments((current) => [...current, { courseId: "", batchId: "", agreedMonthly: "", admissionFee: "0", firstBillingMonth: admissionDate.slice(0, 7) }])}>{bn ? "আরেকটি কোর্স যোগ করুন" : "Add another course"}</Button></div>
          <Field
            className="md:col-span-2"
            data-invalid={Boolean(fieldErrors.internalNote)}
          >
            <FieldLabel htmlFor="direct-internal-note">
              {bn ? "অভ্যন্তরীণ নোট" : "Internal note"}
            </FieldLabel>
            <Textarea
              id="direct-internal-note"
              name="internalNote"
              rows={3}
              aria-invalid={Boolean(fieldErrors.internalNote)}
              aria-describedby={
                fieldErrors.internalNote
                  ? "direct-internal-note-error"
                  : undefined
              }
              onChange={() => clearFieldError("internalNote")}
            />
            {fieldErrors.internalNote ? (
              <FieldError id="direct-internal-note-error">
                {fieldErrors.internalNote}
              </FieldError>
            ) : null}
          </Field>
        </FieldGroup>
      </FormSection>

      <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-background py-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" type="button" onClick={onCancel}>
          {bn ? "বাতিল" : "Cancel"}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {busy
            ? bn
              ? "ভর্তি হচ্ছে…"
              : "Admitting…"
            : bn
              ? "শিক্ষার্থী ভর্তি করুন"
              : "Admit student"}
        </Button>
      </div>
    </form>
  );
}
