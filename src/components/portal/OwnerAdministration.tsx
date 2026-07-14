"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { DialogModal } from "./DialogModal";

const page = { numItems: 100, cursor: null } as const;
type Locale = "bn" | "en";
type Feedback = { ok: boolean; text: string } | null;

function Message({ value }: { value: Feedback }) {
  return value ? <p className={`form-message ${value.ok ? "success" : "error"}`} role={value.ok ? "status" : "alert"}>{value.text}</p> : null;
}

function friendlyError(cause: unknown, bn: boolean) {
  const raw = cause instanceof Error ? cause.message : "";
  const message = raw.replace(/^[\s\S]*?Uncaught Error:\s*/, "").replace(/\s+Called by client[\s\S]*$/, "").trim();
  if (message === "Subject is already linked to course") return bn ? "এই বিষয়টি ইতিমধ্যে কোর্সে যুক্ত আছে।" : "This subject is already linked to the course.";
  return message || (bn ? "কাজটি সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।" : "The operation could not be completed. Please try again.");
}

function Confirm({ title, detail, danger, onCancel, onConfirm }: { title: string; detail: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="operation-form compact-form" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-detail"><h2 id="confirm-title">{title}</h2><p id="confirm-detail">{detail}</p><div className="form-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Cancel / বাতিল</button><button className={`button ${danger ? "button-danger" : "button-primary"}`} type="button" onClick={onConfirm}>Confirm / নিশ্চিত করুন</button></div></div>;
}

async function execute(work: () => Promise<unknown>, setBusy: (value: boolean) => void, setFeedback: (value: Feedback) => void, success: string, bn = false) {
  setBusy(true); setFeedback(null);
  try { await work(); setFeedback({ ok: true, text: success }); return true; }
  catch (cause) { setFeedback({ ok: false, text: friendlyError(cause, bn) }); return false; }
  finally { setBusy(false); }
}

export function OwnerAccountAdministration({ locale, hideHeader = false }: { locale: Locale; hideHeader?: boolean }) {
  const bn = locale === "bn";
  const [role, setRole] = useState<"owner" | "teacher" | "student">("owner");
  const accounts = useQuery(api.accounts.list, { role, paginationOpts: page });
  const reserve = useMutation(api.accounts.reserveOwner);
  const suspend = useMutation(api.accounts.suspendOwner);
  const reactivate = useMutation(api.accounts.reactivateOwner);
  const reset = useMutation(api.accounts.resetLoginReservation);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; detail: string; danger?: boolean; work: () => Promise<unknown> } | null>(null);
  const [resetId, setResetId] = useState<Id<"portalAccounts"> | null>(null);

  if (!accounts) return <PortalPageState state="loading" locale={locale} />;

  function submitOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void execute(() => reserve({ displayName: String(data.get("displayName")), email: String(data.get("email")), phone: String(data.get("phone")) || undefined, locale: data.get("locale") === "en" ? "en" : "bn" }), setBusy, setFeedback, bn ? "মালিকের অ্যাকাউন্ট সংরক্ষিত হয়েছে।" : "Owner account reserved.").then(() => form.reset());
  }

  return (
    <>
      {!hideHeader && (
        <header className="portal-page-header">
          <p className="eyebrow">{bn ? "অ্যাক্সেস নিয়ন্ত্রণ" : "Access control"}</p>
          <h1>{bn ? "পোর্টাল অ্যাকাউন্ট" : "Portal accounts"}</h1>
          <p>{bn ? "অনুমোদিত Google ইমেইল সংরক্ষণ, স্থগিত, পুনরায় সক্রিয় বা রিসেট করুন।" : "Reserve approved Google emails, suspend, reactivate, or reset access."}</p>
        </header>
      )}

      <Message value={feedback} />

      {confirmation && (
        <Confirm
          title={confirmation.title}
          detail={confirmation.detail}
          danger={confirmation.danger}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const item = confirmation;
            setConfirmation(null);
            void execute(item.work, setBusy, setFeedback, bn ? "অ্যাকাউন্ট আপডেট হয়েছে।" : "Account updated.");
          }}
        />
      )}

      {role === "owner" && (
        <form className="operation-form compact-form" onSubmit={submitOwner}>
          <fieldset>
            <legend>{bn ? "নতুন মালিক অনুমোদন" : "Approve a new owner"}</legend>
            <div className="form-grid">
              <label>
                {bn ? "নাম" : "Name"}
                <input name="displayName" required />
              </label>
              <label>
                {bn ? "Google ইমেইল" : "Google email"}
                <input name="email" type="email" required />
              </label>
              <label>
                {bn ? "ফোন (ঐচ্ছিক)" : "Phone (optional)"}
                <input name="phone" />
              </label>
              <label>
                {bn ? "ভাষা" : "Locale"}
                <select name="locale" defaultValue={locale}>
                  <option value="bn">বাংলা</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <button className="button button-primary" disabled={busy}>
              {bn ? "অ্যাকাউন্ট সংরক্ষণ" : "Reserve account"}
            </button>
          </fieldset>
        </form>
      )}

      <div style={{ marginBottom: "12px" }}>
        <span className="standalone-field" style={{ display: "block", marginBottom: "6px", fontWeight: 600 }}>
          {bn ? "ভূমিকা ফিল্টার করুন:" : "Filter by Role:"}
        </span>
        <div
          className="status-filter"
          role="group"
          aria-label={bn ? "ভূমিকা ফিল্টার" : "Role filter"}
          style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px" }}
        >
          {(["owner", "teacher", "student"] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`button ${role === r ? "button-primary" : "button-secondary"}`}
              aria-pressed={role === r}
              onClick={() => {
                setRole(r);
                setFeedback(null);
              }}
              style={{ whiteSpace: "nowrap" }}
            >
              {r === "owner"
                ? bn ? "মালিক" : "Owner"
                : r === "teacher"
                  ? bn ? "শিক্ষক" : "Teacher"
                  : bn ? "শিক্ষার্থী" : "Student"}
            </button>
          ))}
        </div>
      </div>

      {accounts.page.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--ink-mute)", border: "1px dashed var(--border)", borderRadius: "8px", backgroundColor: "var(--canvas-soft)" }}>
          <p style={{ margin: 0, fontWeight: 500 }}>
            {bn ? "কোনো অ্যাকাউন্ট পাওয়া যায়নি।" : "No accounts found for this role."}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{bn ? "ইমেইল" : "Email"}</th>
                <th>{bn ? "অবস্থা" : "Status"}</th>
                <th>{bn ? "শেষ সাইন-ইন" : "Last sign-in"}</th>
                <th>{bn ? "কাজ" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.page.map((account) => (
                <tr key={account.accountId}>
                  <td>{account.loginEmail}</td>
                  <td>
                    <span className={`status-pill ${account.status}`}>{account.status}</span>
                  </td>
                  <td>
                    {account.lastSignedInAt
                      ? new Date(account.lastSignedInAt).toLocaleString(locale === "bn" ? "bn-BD" : "en-BD")
                      : "—"}
                  </td>
                  <td>
                    <div className="table-actions">
                      {account.role === "owner" && account.status === "active" && (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({
                              title: bn ? "মালিক স্থগিত করবেন?" : "Suspend owner?",
                              detail: bn
                                ? "এই মালিক আর পোর্টালে ঢুকতে পারবেন না। শেষ সক্রিয় মালিককে সিস্টেম স্থগিত করতে দেবে না।"
                                : "This owner will lose portal access. The backend will reject suspending the last active owner.",
                              danger: true,
                              work: () => suspend({ accountId: account.accountId }),
                            })
                          }
                        >
                          {bn ? "স্থগিত" : "Suspend"}
                        </button>
                      )}
                      {account.role === "owner" && account.status === "suspended" && (
                        <button
                          className="button button-secondary"
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({
                              title: bn ? "মালিক পুনরায় সক্রিয় করবেন?" : "Reactivate owner?",
                              detail: bn ? "এই মালিক আবার পোর্টালে প্রবেশ করতে পারবেন।" : "This owner will regain portal access.",
                              work: () => reactivate({ accountId: account.accountId }),
                            })
                          }
                        >
                          {bn ? "সক্রিয়" : "Reactivate"}
                        </button>
                      )}
                      <button
                        className="button button-tertiary"
                        type="button"
                        disabled={busy}
                        onClick={() => setResetId(account.accountId)}
                      >
                        {bn ? "লগইন রিসেট" : "Reset login"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resetId !== null && (() => {
        const account = accounts.page.find((a) => a.accountId === resetId);
        if (!account) return null;
        return (
          <DialogModal
            isOpen={true}
            onClose={() => setResetId(null)}
            title={bn ? "Google লগইন রিসেট" : "Reset Google Login"}
            size="form"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const newEmail = String(new FormData(form).get("newEmail"));
                setConfirmation({
                  title: bn ? "Google লগইন রিসেট নিশ্চিত করবেন?" : "Reset Google login?",
                  detail: bn
                    ? `বর্তমান গুগল অ্যাকাউন্ট লিঙ্কটি বিচ্ছিন্ন হয়ে যাবে। নতুন অনুমোদিত ইমেইল (${newEmail}) দিয়ে লগইন করতে হবে। শেষ সক্রিয় মালিককে রিসেট করা যাবে না।`
                    : `The current identity will be unlinked and the new email (${newEmail}) must claim access. The last active owner cannot be unlinked.`,
                  danger: true,
                  work: () => reset({ accountId: account.accountId, newEmail }),
                });
                setResetId(null);
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ fontSize: "14px", color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ margin: 0 }}>
                    <strong>{bn ? "বর্তমান ইমেইল:" : "Current Approved Email:"}</strong> {account.loginEmail}
                  </p>
                  <div style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-deep)", padding: "12px", borderRadius: "6px", fontSize: "13px", lineHeight: "1.4" }}>
                    <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>{bn ? "সতর্কতা ও ফলাফল:" : "Warning & Consequences:"}</p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      <li>{bn ? "বর্তমান গুগল সাইন-ইন সেশনটি অবিলম্বে বাতিল হয়ে যাবে।" : "The current Google sign-in session will be severed immediately."}</li>
                      <li>{bn ? "ব্যবহারকারীকে নতুন ইমেইল এড্রেস দিয়ে সাইন-ইন করে নতুন করে অ্যাক্সেস ক্লেইম করতে হবে।" : "The user must log in using the new email to claim access."}</li>
                      <li>{bn ? "নিরাপত্তার স্বার্থে সিস্টেমের শেষ সক্রিয় মালিকের অ্যাকাউন্টটি রিসেট করা যাবে না।" : "For safety, the last active owner account cannot be unlinked."}</li>
                    </ul>
                  </div>
                </div>

                <label>
                  {bn ? "নতুন অনুমোদিত ইমেইল" : "New Approved Email"}
                  <input
                    name="newEmail"
                    type="email"
                    defaultValue={account.loginEmail}
                    required
                    style={{ width: "100%" }}
                  />
                </label>

                <div className="form-actions" style={{ justifyContent: "flex-end" }}>
                  <button className="button button-secondary" type="button" onClick={() => setResetId(null)}>
                    {bn ? "বাতিল" : "Cancel"}
                  </button>
                  <button className="button button-danger" type="submit">
                    {bn ? "লগইন রিসেট পর্যালোচনা" : "Review Reset"}
                  </button>
                </div>
              </div>
            </form>
          </DialogModal>
        );
      })()}
    </>
  );
}

export function CoachingSettingsInitializer({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const settings = useQuery(api.settings.getOwner, {});
  const initialize = useMutation(api.settings.initialize);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (settings === undefined) return <PortalPageState state="loading" locale={locale} />;
  if (settings !== null) return null;

  return (
    <form
      className="operation-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        void execute(
          () =>
            initialize({
              nameBn: String(data.get("nameBn")),
              nameEn: String(data.get("nameEn")),
              shortNameBn: String(data.get("shortNameBn")),
              shortNameEn: String(data.get("shortNameEn")),
              addressBn: String(data.get("addressBn")),
              addressEn: String(data.get("addressEn")),
              phone: String(data.get("phone")),
              email: String(data.get("email")),
              defaultLocale: data.get("defaultLocale") === "en" ? "en" : "bn",
              defaultGuardianSmsLocale: data.get("smsLocale") === "en" ? "en" : "bn",
            }),
          setBusy,
          setFeedback,
          bn ? "সেটিংস শুরু হয়েছে।" : "Settings initialized."
        );
      }}
    >
      <fieldset>
        <legend>{bn ? "কোচিং সেটিংস শুরু করুন" : "Initialize coaching settings"}</legend>
        <p>{bn ? "এই এককালীন ধাপটি প্রতিষ্ঠান পরিচিতি ও নিরাপদ ডিফল্ট তৈরি করে। SMS এবং পাবলিক ভর্তি বন্ধ অবস্থায় শুরু হবে।" : "This one-time step creates the organization identity and safe defaults. SMS and public admissions start disabled."}</p>
        <div className="form-grid">
          <label>
            বাংলা নাম
            <input name="nameBn" required />
          </label>
          <label>
            English name
            <input name="nameEn" required />
          </label>
          <label>
            সংক্ষিপ্ত নাম
            <input name="shortNameBn" required />
          </label>
          <label>
            Short name
            <input name="shortNameEn" required />
          </label>
          <label>
            বাংলা ঠিকানা
            <textarea name="addressBn" required />
          </label>
          <label>
            English address
            <textarea name="addressEn" required />
          </label>
          <label>
            {bn ? "ফোন" : "Phone"}
            <input name="phone" required />
          </label>
          <label>
            {bn ? "ইমেইল" : "Email"}
            <input name="email" type="email" required />
          </label>
          <label>
            {bn ? "ডিফল্ট ভাষা" : "Default locale"}
            <select name="defaultLocale" defaultValue={locale}>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            {bn ? "অভিভাবক SMS ভাষা" : "Guardian SMS locale"}
            <select name="smsLocale" defaultValue="bn">
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        <Message value={feedback} />
        <button className="button button-primary" disabled={busy}>
          {bn ? "সেটিংস শুরু করুন" : "Initialize settings"}
        </button>
      </fieldset>
    </form>
  );
}
