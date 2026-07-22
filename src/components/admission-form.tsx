"use client";

import { api } from "@convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
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
import { CheckCircle2, CircleAlert, GraduationCap, Users, FileText } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

export function AdmissionForm({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const preparation = useQuery(api.admissions.public.getPreparation);
  const submit = useMutation(api.admissions.public.submit);
  const [message, setMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const submissionKey = useRef(crypto.randomUUID());

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const result = await submit({
        submissionKey: submissionKey.current,
        honeypot: String(data.get("website") || ""),
        locale,
        studentDisplayName: String(data.get("studentDisplayName") || ""),
        studentEmail: String(data.get("studentEmail") || ""),
        studentPhone: String(data.get("studentPhone") || "") || undefined,
        schoolCollege: String(data.get("schoolCollege") || ""),
        currentClass: String(data.get("currentClass") || ""),
        guardianName: String(data.get("guardianName") || ""),
        guardianPhone: String(data.get("guardianPhone") || ""),
        guardianRelationship: "father",
        preferredSmsLocale: String(data.get("preferredSmsLocale")) === "en" ? "en" : "bn",
        motherName: String(data.get("motherName") || ""),
        motherPhone: String(data.get("motherPhone") || ""),
        applicantNote: String(data.get("applicantNote") || "") || undefined,
      });
      setMessage({
        kind: "success",
        text: `${bn ? "আবেদন গ্রহণ করা হয়েছে। রেফারেন্স" : "Application received. Reference"}: ${result.applicationNumber}`,
      });
      submissionKey.current = crypto.randomUUID();
      form.reset();
    } catch (cause) {
      setMessage({
        kind: "error",
        text:
          cause instanceof Error
            ? cause.message
            : bn
              ? "আবেদন পাঠানো যায়নি।"
              : "Could not submit the application.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (preparation && !preparation.admissionsOpen) {
    return (
      <Alert>
        <CircleAlert />
        <AlertTitle>{bn ? "অনলাইন আবেদন বন্ধ" : "Online applications are closed"}</AlertTitle>
        <AlertDescription>
          {bn
            ? "এই মুহূর্তে অনলাইন ভর্তি আবেদন গ্রহণ করা হচ্ছে না। পরে আবার চেষ্টা করুন।"
            : "Online admission applications are not being accepted right now. Please check again later."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden="true">
              <GraduationCap className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{bn ? "শিক্ষার্থীর তথ্য" : "Student information"}</CardTitle>
              <CardDescription>
                {bn
                  ? "যে Google ইমেইল দিয়ে শিক্ষার্থী পরে পোর্টালে প্রবেশ করবে সেটি দিন।"
                  : "Use the Google email the student will later use to access the portal."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="studentDisplayName">{bn ? "শিক্ষার্থীর নাম" : "Student name"}</FieldLabel>
              <Input id="studentDisplayName" name="studentDisplayName" required maxLength={120} autoComplete="name" />
            </Field>
            <Field>
              <FieldLabel htmlFor="studentEmail">{bn ? "Google ইমেইল" : "Google email"}</FieldLabel>
              <Input id="studentEmail" name="studentEmail" type="email" required maxLength={254} autoComplete="email" />
            </Field>
            <Field>
              <FieldLabel htmlFor="studentPhone">{bn ? "শিক্ষার্থীর ফোন" : "Student phone"}</FieldLabel>
              <Input id="studentPhone" name="studentPhone" inputMode="tel" autoComplete="tel" />
              <FieldDescription>{bn ? "ঐচ্ছিক" : "Optional"}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="schoolCollege">{bn ? "স্কুল বা কলেজ" : "School or college"}</FieldLabel>
              <Input id="schoolCollege" name="schoolCollege" required maxLength={160} />
            </Field>
            <Field>
              <FieldLabel htmlFor="currentClass">{bn ? "বর্তমান শ্রেণি" : "Current class"}</FieldLabel>
              <Input id="currentClass" name="currentClass" required maxLength={80} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden="true">
              <Users className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{bn ? "অভিভাবকের তথ্য" : "Guardian information"}</CardTitle>
              <CardDescription>
                {bn
                  ? "ভর্তি, ফি, ফলাফল ও উপস্থিতি সংক্রান্ত যোগাযোগের জন্য।"
                  : "Used for admission, fee, result, and attendance communication."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-5 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="guardianName">{bn ? "বাবার নাম" : "Father's name"}</FieldLabel>
              <Input id="guardianName" name="guardianName" required maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="guardianPhone">{bn ? "বাবার মোবাইল নম্বর" : "Father's mobile number"}</FieldLabel>
              <Input id="guardianPhone" name="guardianPhone" required inputMode="tel" autoComplete="tel" />
            </Field>
            <Field>
              <FieldLabel htmlFor="motherName">{bn ? "মায়ের নাম" : "Mother's name"}</FieldLabel>
              <Input id="motherName" name="motherName" required maxLength={120} />
            </Field>
            <Field>
              <FieldLabel htmlFor="motherPhone">{bn ? "মায়ের মোবাইল নম্বর" : "Mother's mobile number"}</FieldLabel>
              <Input id="motherPhone" name="motherPhone" required inputMode="tel" autoComplete="tel" />
            </Field>
            <Field>
              <FieldLabel htmlFor="sms-language">{bn ? "SMS-এর ভাষা" : "SMS language"}</FieldLabel>
              <Select name="preferredSmsLocale" defaultValue={locale} required>
                <SelectTrigger id="sms-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="bn">বাংলা</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden="true">
              <FileText className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle>{bn ? "অতিরিক্ত তথ্য ও জমা" : "Additional Information & Submit"}</CardTitle>
              <CardDescription>
                {bn
                  ? "আপনার যদি কোনো বিশেষ মন্তব্য থাকে তা উল্লেখ করুন।"
                  : "Add any additional note or special instructions."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="applicantNote">{bn ? "অতিরিক্ত তথ্য" : "Additional note"}</FieldLabel>
              <Textarea id="applicantNote" name="applicantNote" maxLength={1000} rows={4} />
              <FieldDescription>{bn ? "ঐচ্ছিক — বিশেষ অনুরোধ বা প্রাসঙ্গিক তথ্য লিখুন।" : "Optional — add any special request or relevant information."}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <Separator />
        <CardFooter className="flex-col items-stretch gap-5 pt-6">
          <input name="guardianRelationship" type="hidden" value="father" />
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <Field orientation="horizontal" className="items-start">
            <Checkbox id="consent" required />
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="consent">
                {bn
                  ? "আমি প্রদত্ত তথ্য প্রক্রিয়াকরণ এবং ভর্তি-সংক্রান্ত যোগাযোগে সম্মতি দিচ্ছি।"
                  : "I consent to processing this information and admission-related communication."}
              </FieldLabel>
              <FieldDescription>{bn ? "আবেদন পাঠাতে এই সম্মতি প্রয়োজন।" : "This consent is required to submit the application."}</FieldDescription>
            </div>
          </Field>

          {message ? (
            <Alert variant={message.kind === "error" ? "destructive" : "default"} role={message.kind === "error" ? "alert" : "status"}>
              {message.kind === "error" ? <CircleAlert /> : <CheckCircle2 />}
              <AlertTitle>{message.kind === "error" ? (bn ? "আবেদন পাঠানো যায়নি" : "Application not submitted") : (bn ? "আবেদন সফল" : "Application submitted")}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          ) : null}

          <Button className="w-full sm:w-auto sm:self-end" type="submit" disabled={busy}>
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {busy ? (bn ? "পাঠানো হচ্ছে…" : "Submitting…") : (bn ? "আবেদন পাঠান" : "Submit application")}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
