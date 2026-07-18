"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "./PortalPageState";
import { WebsiteCmsEditor } from "./WebsiteCmsEditor";
import {
  Save,
  Mail,
  AlertTriangle,
  Sliders,
  ToggleLeft,
  FileText,
} from "lucide-react";
import type { FunctionReturnType } from "convex/server";

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
  return value ? (
    <p
      className={`form-message ${value.ok ? "success" : "error"}`}
      role={value.ok ? "status" : "alert"}
    >
      {value.text}
    </p>
  ) : null;
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
  const seed = useMutation(api.messaging.templateFunctions.seedDefaults);
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
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
      setBusy(false);
    }
  }

  const markDirty = () => {
    setIsDirty(true);
    setFeedback(null);
  };

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
        <div
          className="operation-form compact-form alert-warning"
          style={{
            padding: "16px",
            marginBottom: "16px",
            borderLeft: "4px solid var(--warning)",
            backgroundColor: "var(--canvas-soft)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderRadius: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <AlertTriangle style={{ color: "var(--warning)", flexShrink: 0 }} />
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--ink)",
              }}
            >
              {bn
                ? "অন্য একজন মালিক সেটিংস পরিবর্তন করেছেন!"
                : "Settings were updated by another owner!"}
            </p>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--ink-secondary)",
            }}
          >
            {bn
              ? "সংরক্ষণ করার আগে পরিবর্তনটি যাচাই করুন। আপনার পরিবর্তনগুলো রাখলে পূর্ববর্তী পরিবর্তনটি ওভাররাইট হয়ে যাবে।"
              : "Review before saving. Keeping your edits and saving will overwrite the changes made elsewhere."}
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="button button-secondary"
              type="button"
              style={{
                padding: "4px 10px",
                minHeight: "auto",
                fontSize: "12px",
              }}
              onClick={handleReload}
            >
              {bn ? "সর্বশেষ সেটিংস লোড করুন" : "Reload latest settings"}
            </button>
            <button
              className="button button-tertiary"
              type="button"
              style={{
                padding: "4px 10px",
                minHeight: "auto",
                fontSize: "12px",
              }}
              onClick={handleKeepEdits}
            >
              {bn ? "আমার এডিটগুলো রাখুন" : "Keep my edits"}
            </button>
          </div>
        </div>
      )}

      <form className="operation-form" onSubmit={submit}>
        <fieldset>
          <legend style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Sliders size={16} />
            {bn ? "ডিফল্ট" : "Defaults"}
          </legend>
          <div className="form-grid-thirds">
            <label>
              {bn ? "ইন্টারফেস ভাষা" : "Interface locale"}
              <select
                name="defaultLocale"
                value={defaultLocale}
                onChange={(e) => {
                  setDefaultLocale(e.target.value as "bn" | "en");
                  markDirty();
                }}
              >
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </select>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--ink-mute)",
                  marginTop: "2px",
                }}
              >
                {bn
                  ? "কোচিং সেন্টারের পছন্দের ডিফল্ট ভাষা নির্ধারণ করে। এটি আপনার বর্তমান পেজের ভাষা পরিবর্তন করবে না।"
                  : "Sets the coaching centre’s preferred default language for supported workflows. It does not change your current page language or existing account preferences."}
              </span>
            </label>
            <label>
              {bn ? "অভিভাবক SMS ভাষা" : "Guardian SMS locale"}
              <select
                name="defaultGuardianSmsLocale"
                value={defaultGuardianSmsLocale}
                onChange={(e) => {
                  setDefaultGuardianSmsLocale(e.target.value as "bn" | "en");
                  markDirty();
                }}
              >
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ToggleLeft size={16} />
            {bn ? "সুবিধা" : "Features"}
          </legend>
          <div
            className="card-grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
              marginTop: "8px",
            }}
          >
            <label className="feature-option-card">
              <input
                name="publicAdmissionsOpen"
                type="checkbox"
                checked={publicAdmissionsOpen}
                onChange={(e) => {
                  setPublicAdmissionsOpen(e.target.checked);
                  markDirty();
                }}
                style={{
                  width: "18px",
                  height: "18px",
                  marginTop: "2px",
                  flexShrink: 0,
                }}
              />
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {bn ? "পাবলিক ভর্তি আবেদন" : "Public Admissions"}
                </strong>
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "var(--ink-mute)",
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  {bn
                    ? "পাবলিক ভর্তি আবেদন চালু করুন যেন আগ্রহী শিক্ষার্থীরা ওয়েবসাইট থেকে আবেদন করতে পারে।"
                    : "Enable public online application submissions for prospective students on the public website."}
                </span>
              </div>
            </label>

            <label className="feature-option-card">
              <input
                name="smsEnabled"
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => {
                  setSmsEnabled(e.target.checked);
                  markDirty();
                }}
                style={{
                  width: "18px",
                  height: "18px",
                  marginTop: "2px",
                  flexShrink: 0,
                }}
              />
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {bn ? "SMS ডেলিভারি" : "SMS Delivery"}
                </strong>
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "var(--ink-mute)",
                    marginTop: "4px",
                    lineHeight: "1.4",
                  }}
                >
                  {bn
                    ? "উপস্থিতি, পেমেন্ট ও পরীক্ষার ফলাফলের জন্য অভিভাবকদের স্বয়ংক্রিয় SMS নোটিফিকেশন পাঠান।"
                    : "Send automated SMS notifications to guardians for attendance records, manual payments, and exam results."}
                </span>
                <div
                  style={{
                    marginTop: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {settings.smsConfigured ? (
                    <span
                      className="status-pill active"
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        alignSelf: "flex-start",
                      }}
                    >
                      {bn
                        ? "SMS গেটওয়ে কনফিগার করা আছে"
                        : "SMS Gateway Configured"}
                    </span>
                  ) : (
                    <span
                      className="status-pill suspended"
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        alignSelf: "flex-start",
                      }}
                    >
                      {bn
                        ? "SMS গেটওয়ে কনফিগার করা নেই"
                        : "SMS Gateway Not Configured"}
                    </span>
                  )}
                  {!settings.smsConfigured && (
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--danger)",
                        fontWeight: 500,
                        lineHeight: "1.3",
                      }}
                    >
                      {bn
                        ? "সতর্কতা: সার্ভার এনভায়রনমেন্ট ভেরিয়েবলে SMS প্রোভাইডার API কী পাওয়া যায়নি। চালুর পরেও SMS ডেলিভারি ব্যর্থ হবে।"
                        : "Warning: SMS provider API key is missing in environment variables. SMS delivery will fail even if enabled."}
                    </span>
                  )}
                  {settings.smsSenderIdConfigured ? (
                    <span
                      className="status-pill active"
                      style={{
                        fontSize: "11px",
                        padding: "1px 6px",
                        alignSelf: "flex-start",
                      }}
                    >
                      {bn
                        ? "সেন্ডার আইডি কনফিগার করা আছে"
                        : "Sender ID Configured"}
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "block",
                        fontSize: "11px",
                        color: "var(--ink-mute)",
                        lineHeight: "1.3",
                      }}
                    >
                      {bn
                        ? "সেন্ডার আইডি কনফিগার করা নেই; প্রোভাইডারের ডিফল্ট সেন্ডার ব্যবহারের অনুরোধ করা হবে।"
                        : "Sender ID not configured; the provider’s default sender will be requested."}
                    </span>
                  )}
                </div>
              </div>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FileText size={16} />
            {bn ? "রশিদের ফুটার" : "Receipt footer"}
          </legend>
          <div className="form-grid">
            <label>
              বাংলা
              <textarea
                name="receiptFooterBn"
                value={receiptFooterBn}
                onChange={(e) => {
                  setReceiptFooterBn(e.target.value);
                  markDirty();
                }}
                rows={3}
              />
            </label>
            <label>
              English
              <textarea
                name="receiptFooterEn"
                value={receiptFooterEn}
                onChange={(e) => {
                  setReceiptFooterEn(e.target.value);
                  markDirty();
                }}
                rows={3}
              />
            </label>
          </div>
          <span
            style={{
              display: "block",
              fontSize: "12px",
              color: "var(--ink-mute)",
              marginTop: "8px",
            }}
          >
            {bn
              ? "প্রতিটি প্রিন্ট করা রশিদের নিচে এই টেক্সটটি প্রদর্শিত হবে।"
              : "This message is printed at the bottom of payment receipts."}
          </span>
        </fieldset>

        <Feedback value={feedback} />

        <div className="form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            <Save
              size={16}
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />
            {busy
              ? bn
                ? "সংরক্ষণ করা হচ্ছে..."
                : "Saving..."
              : bn
                ? "সংরক্ষণ করুন"
                : "Save settings"}
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setFeedback(null);
              try {
                const count = await seed({});
                setFeedback({
                  ok: true,
                  text: `${count} ${bn ? "টি SMS টেমপ্লেট যোগ হয়েছে।" : "SMS templates added."} (Seeding is idempotent; existing templates were kept)`,
                });
              } catch (cause) {
                setFeedback({
                  ok: false,
                  text:
                    cause instanceof Error
                      ? cause.message
                      : "Could not seed templates",
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Mail
              size={16}
              style={{ marginRight: "6px", verticalAlign: "middle" }}
            />
            {busy
              ? bn
                ? "টেমপ্লেট তৈরি হচ্ছে..."
                : "Seeding..."
              : bn
                ? "ডিফল্ট SMS টেমপ্লেট তৈরি"
                : "Seed SMS templates"}
          </button>
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
