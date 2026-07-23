"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";
import { WebsiteCmsEditor } from "./WebsiteCmsEditor";
import {
  Save,
  AlertTriangle,
  SlidersHorizontal,
  ToggleRight,
  FileText,
  CheckCircle2,
  CircleAlert,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const keys = [
  "hero",
  "about_summary",
  "contact",
  "achievement_intro",
  "admission_intro",
  "footer",
] as const;

export type CoachingSettings = NonNullable<
  FunctionReturnType<typeof api.settings.getOwner>
>;

function Feedback({ value }: { value: { ok: boolean; text: string } | null }) {
  if (!value) return null;
  const Icon = value.ok ? CheckCircle2 : CircleAlert;
  return (
    <Alert
      variant={value.ok ? "default" : "destructive"}
      className={value.ok ? "settings-feedback-success" : undefined}
    >
      <Icon aria-hidden="true" />
      <AlertDescription>{value.text}</AlertDescription>
    </Alert>
  );
}

export function OwnerSettingsEditor({
  locale,
  settings,
  hideHeader = false,
}: {
  locale: "bn" | "en";
  settings: CoachingSettings;
  hideHeader?: boolean;
}) {
  const update = useMutation(api.settings.updateOperations);
  const [busyAction, setBusyAction] = useState<"save" | null>(null);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const bn = locale === "bn";

  // Concurrency tracking states
  const [isDirty, setIsDirty] = useState(false);
  const [showConcurrencyAlert, setShowConcurrencyAlert] = useState(false);

  // Form input states
  const [defaultLocale, setDefaultLocale] = useState(settings.defaultLocale);
  const [defaultGuardianSmsLocale, setDefaultGuardianSmsLocale] = useState(
    settings.defaultGuardianSmsLocale,
  );
  const [publicAdmissionsOpen, setPublicAdmissionsOpen] = useState(
    settings.publicAdmissionsOpen,
  );
  const [smsEnabled, setSmsEnabled] = useState(settings.smsEnabled);
  const [receiptFooterBn, setReceiptFooterBn] = useState(
    settings.receiptFooterBn,
  );
  const [receiptFooterEn, setReceiptFooterEn] = useState(
    settings.receiptFooterEn,
  );

  const [prevUpdatedAt, setPrevUpdatedAt] = useState(settings.updatedAt);
  if (settings.updatedAt !== prevUpdatedAt) {
    setPrevUpdatedAt(settings.updatedAt);
    if (!isDirty) {
      setDefaultLocale(settings.defaultLocale);
      setDefaultGuardianSmsLocale(settings.defaultGuardianSmsLocale);
      setPublicAdmissionsOpen(settings.publicAdmissionsOpen);
      setSmsEnabled(settings.smsEnabled);
      setReceiptFooterBn(settings.receiptFooterBn);
      setReceiptFooterEn(settings.receiptFooterEn);
    } else {
      setShowConcurrencyAlert(true);
    }
  }

  const handleReload = () => {
    setDefaultLocale(settings.defaultLocale);
    setDefaultGuardianSmsLocale(settings.defaultGuardianSmsLocale);
    setPublicAdmissionsOpen(settings.publicAdmissionsOpen);
    setSmsEnabled(settings.smsEnabled);
    setReceiptFooterBn(settings.receiptFooterBn);
    setReceiptFooterEn(settings.receiptFooterEn);
    setPrevUpdatedAt(settings.updatedAt);
    setIsDirty(false);
    setShowConcurrencyAlert(false);
    setFeedback(null);
  };

  const handleKeepEdits = () => {
    setShowConcurrencyAlert(false);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("save");
    setFeedback(null);
    try {
      await update({
        expectedUpdatedAt: prevUpdatedAt,
        defaultLocale,
        defaultGuardianSmsLocale,
        publicAdmissionsOpen,
        smsEnabled,
        receiptFooterBn,
        receiptFooterEn,
      });
      setFeedback({
        ok: true,
        text: bn ? "সেটিংস সংরক্ষিত হয়েছে।" : "Settings saved.",
      });
      setIsDirty(false);
      setPrevUpdatedAt(Date.now());
    } catch (cause) {
      setFeedback({
        ok: false,
        text:
          cause instanceof Error ? cause.message : "Could not save settings",
      });
    } finally {
      setBusyAction(null);
    }
  }

  const markDirty = () => {
    setIsDirty(true);
    setFeedback(null);
  };

  const saveBusy = busyAction === "save";
  const busy = busyAction !== null;

  return (
    <>
      {!hideHeader && (
        <header className="portal-page-header">
          <p className="eyebrow">{bn ? "অপারেশন" : "Operations"}</p>
          <h1>{bn ? "সেটিংস" : "Settings"}</h1>
          <p>
            {bn
              ? "ভর্তি, মাসিক বকেয়া, SMS এবং রশিদের ডিফল্ট নিয়ন্ত্রণ করুন।"
              : "Control admission, monthly dues, SMS, and receipt defaults."}
          </p>
        </header>
      )}

      {showConcurrencyAlert && (
        <Alert className="settings-concurrency-alert">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>
              {bn
                ? "অন্য একজন মালিক সেটিংস পরিবর্তন করেছেন!"
                : "Settings were updated by another owner!"}
          </AlertTitle>
          <AlertDescription>
            {bn
              ? "সংরক্ষণ করার আগে পরিবর্তনটি যাচাই করুন। আপনার পরিবর্তনগুলো রাখলে পূর্ববর্তী পরিবর্তনটি ওভাররাইট হয়ে যাবে।"
              : "Review before saving. Keeping your edits and saving will overwrite the changes made elsewhere."}
            <div className="settings-alert-actions">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={handleReload}
            >
              {bn ? "সর্বশেষ সেটিংস লোড করুন" : "Reload latest settings"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleKeepEdits}
            >
              {bn ? "আমার এডিটগুলো রাখুন" : "Keep my edits"}
            </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <form className="settings-workspace" onSubmit={submit}>
        <div className="settings-form-column settings-form-column-full">
            <Card id="settings-defaults" className="settings-card">
              <CardHeader className="settings-card-header">
                <CardTitle className="settings-card-title">
                  <SlidersHorizontal aria-hidden="true" />
                  {bn ? "ডিফল্ট" : "Defaults"}
                </CardTitle>
                <CardDescription>
                  {bn ? "কোচিং সেন্টারের নতুন এবং স্বয়ংক্রিয় ওয়ার্কফ্লোর জন্য ভাষার পছন্দ নির্ধারণ করুন।" : "Set the language defaults used by new and automated coaching workflows."}
                </CardDescription>
              </CardHeader>
              <CardContent className="settings-card-content">
                <FieldGroup className="settings-field-grid">
                  <Field>
                    <FieldLabel id="default-locale-label" htmlFor="default-locale-native">{bn ? "ইন্টারফেস ভাষা" : "Interface locale"}</FieldLabel>
                    <select className="sr-only" id="default-locale-native" name="defaultLocale" tabIndex={-1} aria-hidden="true" value={defaultLocale} onChange={(event) => { setDefaultLocale(event.target.value as "bn" | "en"); markDirty(); }}>
                      <option value="bn">বাংলা</option>
                      <option value="en">English</option>
                    </select>
                    <Select value={defaultLocale} onValueChange={(value) => { setDefaultLocale(value as "bn" | "en"); markDirty(); }}>
                      <SelectTrigger id="default-locale" aria-label={bn ? "ভাষা নির্বাচন" : "Select language"}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem value="bn">বাংলা</SelectItem><SelectItem value="en">English</SelectItem></SelectGroup></SelectContent>
                    </Select>
                    <FieldDescription>{bn ? "ডিফল্ট ভাষা নির্ধারণ করে; আপনার বর্তমান পেজ বা বিদ্যমান অ্যাকাউন্ট বদলাবে না।" : "Sets the centre’s preferred default language. It does not change your current page or existing account preferences."}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel id="guardian-sms-locale-label" htmlFor="guardian-sms-locale-native">{bn ? "অভিভাবক SMS ভাষা" : "Guardian SMS locale"}</FieldLabel>
                    <select className="sr-only" id="guardian-sms-locale-native" name="defaultGuardianSmsLocale" tabIndex={-1} aria-hidden="true" value={defaultGuardianSmsLocale} onChange={(event) => { setDefaultGuardianSmsLocale(event.target.value as "bn" | "en"); markDirty(); }}>
                      <option value="bn">বাংলা</option>
                      <option value="en">English</option>
                    </select>
                    <Select value={defaultGuardianSmsLocale} onValueChange={(value) => { setDefaultGuardianSmsLocale(value as "bn" | "en"); markDirty(); }}>
                      <SelectTrigger id="guardian-sms-locale" aria-label={bn ? "অভিভাবক SMS ভাষা নির্বাচন" : "Select guardian SMS language"}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup><SelectItem value="bn">বাংলা</SelectItem><SelectItem value="en">English</SelectItem></SelectGroup></SelectContent>
                    </Select>
                    <FieldDescription>{bn ? "স্বয়ংক্রিয় অভিভাবক বার্তার প্রাথমিক ভাষা।" : "The default language for automatic guardian messages."}</FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card id="settings-features" className="settings-card">
              <CardHeader className="settings-card-header">
                <CardTitle className="settings-card-title">
                  <ToggleRight aria-hidden="true" />
                  {bn ? "সুবিধা" : "Features"}
                </CardTitle>
                <CardDescription>
                  {bn ? "পাবলিক ভর্তি এবং স্বয়ংক্রিয় অভিভাবক যোগাযোগ চালু বা বন্ধ করুন।" : "Control public admissions and automatic guardian communication."}
                </CardDescription>
              </CardHeader>
              <CardContent className="settings-card-content settings-toggle-list">
                <div className="settings-toggle-row">
                  <div className="settings-toggle-copy">
                    <div className="settings-toggle-heading"><span>{bn ? "পাবলিক ভর্তি আবেদন" : "Public Admissions"}</span></div>
                    <p>{bn ? "ওয়েবসাইট থেকে আগ্রহী শিক্ষার্থীদের আবেদন করার সুযোগ দিন।" : "Allow prospective students to submit applications from the public website."}</p>
                  </div>
                  <Switch checked={publicAdmissionsOpen} onCheckedChange={(checked) => { setPublicAdmissionsOpen(checked); markDirty(); }} aria-label={bn ? "পাবলিক ভর্তি আবেদন চালু বা বন্ধ করুন" : "Toggle public admissions"} />
                </div>
                <Separator />
                <div className="settings-toggle-row">
                  <div className="settings-toggle-copy">
                    <div className="settings-toggle-heading"><span>{bn ? "SMS ডেলিভারি" : "SMS Delivery"}</span></div>
                    <p>{bn ? "ভর্তি, বিলম্ব/অনুপস্থিতি এবং পেমেন্টের জন্য অভিভাবকদের স্বয়ংক্রিয় SMS পাঠান।" : "Send automatic guardian SMS for admissions, late or absent attendance, and payments."}</p>
                    <div className="settings-provider-status">
                      <Badge variant={settings.smsConfigured ? "success" : "danger"}>{settings.smsConfigured ? (bn ? "API কী কনফিগার করা" : "API key configured") : (bn ? "API কী নেই" : "API key missing")}</Badge>
                      <Badge variant={settings.smsSenderIdConfigured ? "success" : "danger"}>{settings.smsSenderIdConfigured ? (bn ? "সেন্ডার আইডি কনফিগার করা" : "Sender ID configured") : (bn ? "সেন্ডার আইডি নেই" : "Sender ID missing")}</Badge>
                    </div>
                    {!settings.smsConfigured || !settings.smsSenderIdConfigured ? <p className="settings-inline-warning">{bn ? "সতর্কতা: কনফিগারেশন সম্পূর্ণ না হলে SMS পাঠানো ব্যর্থ হবে।" : "SMS delivery will fail until both the provider API key and sender ID are configured."}</p> : null}
                  </div>
                  <Switch checked={smsEnabled} onCheckedChange={(checked) => { setSmsEnabled(checked); markDirty(); }} aria-label={bn ? "SMS ডেলিভারি চালু বা বন্ধ করুন" : "Toggle SMS delivery"} />
                </div>
              </CardContent>
            </Card>

            <Card id="settings-receipts" className="settings-card">
              <CardHeader className="settings-card-header">
                <CardTitle className="settings-card-title">
                  <FileText aria-hidden="true" />
                  {bn ? "রশিদের ফুটার" : "Receipt footer"}
                </CardTitle>
                <CardDescription>
                  {bn ? "প্রিন্ট করা পেমেন্ট রশিদের নিচে দেখানো বার্তা লিখুন।" : "Write the message printed at the bottom of payment receipts."}
                </CardDescription>
              </CardHeader>
              <CardContent className="settings-card-content">
                <FieldGroup className="settings-field-grid">
                  <Field>
                    <FieldLabel htmlFor="receipt-footer-bn">বাংলা</FieldLabel>
                    <Textarea id="receipt-footer-bn" name="receiptFooterBn" value={receiptFooterBn} onChange={(event) => { setReceiptFooterBn(event.target.value); markDirty(); }} rows={4} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="receipt-footer-en">English</FieldLabel>
                    <Textarea id="receipt-footer-en" name="receiptFooterEn" value={receiptFooterEn} onChange={(event) => { setReceiptFooterEn(event.target.value); markDirty(); }} rows={4} />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Feedback value={feedback} />

            <div className="settings-save-bar" data-dirty={isDirty ? "true" : "false"}>
              <div className="settings-save-status">
                <span className="settings-save-status-icon" aria-hidden="true">{isDirty ? "•" : "✓"}</span>
                <div>
                  <strong>{isDirty ? (bn ? "অসংরক্ষিত পরিবর্তন" : "Unsaved changes") : (bn ? "সব পরিবর্তন সংরক্ষিত" : "All changes saved")}</strong>
                  <span>{isDirty ? (bn ? "সংরক্ষণ করতে নিচের বোতামটি চাপুন।" : "Save when you’re ready to apply them.") : (bn ? "এই সেটিংস সর্বশেষ সংরক্ষিত অবস্থায় আছে।" : "These settings match the latest saved version.")}</span>
                </div>
              </div>
              <div className="settings-save-actions">
                <Button type="submit" disabled={busy || !isDirty} loading={saveBusy}><Save data-icon="inline-start" />{bn ? "সংরক্ষণ করুন" : "Save settings"}</Button>
              </div>
            </div>
          </div>
      </form>
    </>
  );
}

export function LegacyOwnerWebsiteEditor({ locale }: { locale: "bn" | "en" }) {
  const [key, setKey] = useState<(typeof keys)[number]>("hero");
  const preview = useQuery(api.publicSite.cms.getContentPreview, { key });
  const save = useMutation(api.publicSite.cms.saveContentDraft);
  const publish = useMutation(api.publicSite.cms.publishContent);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const bn = locale === "bn";
  if (preview === undefined)
    return <PortalPageState state="loading" locale={locale} />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setFeedback(null);
    try {
      await save({
        key,
        content: {
          titleBn: String(data.get("titleBn") || ""),
          titleEn: String(data.get("titleEn") || ""),
          bodyBn: String(data.get("bodyBn") || ""),
          bodyEn: String(data.get("bodyEn") || ""),
          primaryCtaLabelBn:
            String(data.get("primaryCtaLabelBn") || "") || null,
          primaryCtaLabelEn:
            String(data.get("primaryCtaLabelEn") || "") || null,
          primaryCtaHref: String(data.get("primaryCtaHref") || "") || null,
          mediaStorageId: preview?.mediaStorageId ?? null,
        },
      });
      setFeedback({
        ok: true,
        text: bn
          ? "খসড়া সংরক্ষিত হয়েছে। প্রকাশ না করা পর্যন্ত এটি পাবলিক হবে না।"
          : "Draft saved. It remains private until published.",
      });
    } catch (cause) {
      setFeedback({
        ok: false,
        text: cause instanceof Error ? cause.message : "Could not save draft",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">CMS</p>
        <h1>{bn ? "পাবলিক ওয়েবসাইট" : "Public website"}</h1>
        <p>
          {bn
            ? "নির্ধারিত দ্বিভাষিক কনটেন্ট স্লট সম্পাদনা, প্রিভিউ এবং প্রকাশ করুন।"
            : "Edit, preview, and publish fixed bilingual content slots."}
        </p>
      </header>
      <label className="standalone-field">
        {bn ? "কনটেন্ট অংশ" : "Content section"}
        <select
          value={key}
          onChange={(event) => {
            setKey(event.target.value as (typeof keys)[number]);
            setFeedback(null);
          }}
        >
          {keys.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <form
        className="operation-form"
        key={`${key}:${preview?.updatedAt ?? 0}`}
        onSubmit={submit}
      >
        <fieldset>
          <legend>{bn ? "শিরোনাম" : "Titles"}</legend>
          <div className="form-grid">
            <label>
              বাংলা
              <input name="titleBn" defaultValue={preview?.titleBn} />
            </label>
            <label>
              English
              <input name="titleEn" defaultValue={preview?.titleEn} />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>{bn ? "মূল লেখা" : "Body"}</legend>
          <div className="form-grid">
            <label>
              বাংলা
              <textarea name="bodyBn" rows={8} defaultValue={preview?.bodyBn} />
            </label>
            <label>
              English
              <textarea name="bodyEn" rows={8} defaultValue={preview?.bodyEn} />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>CTA</legend>
          <div className="form-grid">
            <label>
              বাংলা
              <input
                name="primaryCtaLabelBn"
                defaultValue={preview?.primaryCtaLabelBn ?? ""}
              />
            </label>
            <label>
              English
              <input
                name="primaryCtaLabelEn"
                defaultValue={preview?.primaryCtaLabelEn ?? ""}
              />
            </label>
            <label>
              URL
              <input
                name="primaryCtaHref"
                defaultValue={preview?.primaryCtaHref ?? ""}
                placeholder="/bn/admission"
              />
            </label>
          </div>
        </fieldset>
        {preview && (
          <p className="editor-meta">
            {bn ? "সর্বশেষ সম্পাদনা" : "Last edited"}:{" "}
            {new Date(preview.updatedAt).toLocaleString()} ·{" "}
            {bn ? "খসড়া" : "Draft"} v{preview.draftRevision} ·{" "}
            {bn ? "প্রকাশিত" : "Published"} v{preview.publishedRevision}
          </p>
        )}
        <Feedback value={feedback} />
        <div className="form-actions">
          <button className="button button-secondary" disabled={busy}>
            {bn ? "খসড়া সংরক্ষণ" : "Save draft"}
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !preview}
            onClick={async () => {
              setBusy(true);
              try {
                await publish({ key });
                setFeedback({
                  ok: true,
                  text: bn ? "কনটেন্ট প্রকাশিত হয়েছে।" : "Content published.",
                });
              } catch (cause) {
                setFeedback({
                  ok: false,
                  text:
                    cause instanceof Error
                      ? cause.message
                      : "Could not publish",
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            {bn ? "প্রকাশ করুন" : "Publish"}
          </button>
        </div>
      </form>
    </>
  );
}

export { WebsiteCmsEditor as OwnerWebsiteEditor };
