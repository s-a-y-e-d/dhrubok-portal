"use client";

/* eslint-disable @next/next/no-img-element -- Convex returns short-lived signed URLs that cannot be allowlisted as a stable image host. */

import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";

type Locale = "bn" | "en";
type FeedbackValue = { ok: boolean; text: string } | null;
type ContentKey = "hero" | "about_summary" | "contact" | "achievement_intro" | "admission_intro" | "footer";

const contentKeys: ContentKey[] = ["hero", "about_summary", "contact", "achievement_intro", "admission_intro", "footer"];
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 8 * 1024 * 1024;

function Feedback({ value }: { value: FeedbackValue }) {
  return value ? <p className={`form-message ${value.ok ? "success" : "error"}`} role={value.ok ? "status" : "alert"}>{value.text}</p> : null;
}

function formatEditor(name: string | null, updatedAt: number, locale: Locale) {
  const bn = locale === "bn";
  const date = new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(updatedAt);
  return `${name || (bn ? "অজানা সম্পাদক" : "Unknown editor")} · ${date}`;
}

function validateClientImage(file: File) {
  if (!allowedImageTypes.has(file.type.toLowerCase())) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > maxImageBytes) throw new Error("Image must be 8 MB or smaller.");
}

function CmsImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} width={960} height={540} style={{ width: "100%", height: "auto" }} />;
}

function ContentEditor({ locale }: { locale: Locale }) {
  const [key, setKey] = useState<ContentKey>("hero");
  const preview = useQuery(api.publicSite.cms.getContentPreview, { key });
  if (preview === undefined) return <PortalPageState state="loading" locale={locale} />;
  return <ContentDraftForm key={`${key}:${preview?.updatedAt ?? 0}`} locale={locale} contentKey={key} preview={preview} onKeyChange={setKey} />;
}

function ContentDraftForm({ locale, contentKey, preview, onKeyChange }: {
  locale: Locale;
  contentKey: ContentKey;
  preview: NonNullable<ReturnType<typeof useQuery<typeof api.publicSite.cms.getContentPreview>>> | null;
  onKeyChange: (key: ContentKey) => void;
}) {
  const bn = locale === "bn";
  const [language, setLanguage] = useState<Locale>(locale);
  const [draft, setDraft] = useState({
    titleBn: preview?.titleBn ?? "", titleEn: preview?.titleEn ?? "", bodyBn: preview?.bodyBn ?? "", bodyEn: preview?.bodyEn ?? "",
    primaryCtaLabelBn: preview?.primaryCtaLabelBn ?? "", primaryCtaLabelEn: preview?.primaryCtaLabelEn ?? "", primaryCtaHref: preview?.primaryCtaHref ?? "",
  });
  const [mediaStorageId, setMediaStorageId] = useState<Id<"_storage"> | null>(preview?.mediaStorageId ?? null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(preview?.mediaUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackValue>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const save = useMutation(api.publicSite.cms.saveContentDraft);
  const publish = useMutation(api.publicSite.cms.publishContent);
  const generateUploadUrl = useMutation(api.publicSite.cms.generateImageUploadUrl);

  async function upload(file: File) {
    validateClientImage(file);
    setBusy(true);
    setFeedback(null);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Image upload failed.");
      const result = await response.json() as { storageId: Id<"_storage"> };
      setMediaStorageId(result.storageId);
      setMediaUrl(URL.createObjectURL(file));
      setFeedback({ ok: true, text: bn ? "ছবি আপলোড হয়েছে। খসড়া সংরক্ষণ করুন।" : "Image uploaded. Save the draft to attach it." });
    } catch (cause) {
      setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not upload image." });
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await save({
        key: contentKey,
        content: {
          ...draft,
          primaryCtaLabelBn: draft.primaryCtaLabelBn || null,
          primaryCtaLabelEn: draft.primaryCtaLabelEn || null,
          primaryCtaHref: draft.primaryCtaHref || null,
          mediaStorageId,
        },
      });
      setFeedback({ ok: true, text: bn ? "খসড়া সংরক্ষিত হয়েছে; প্রকাশ না করা পর্যন্ত এটি ব্যক্তিগত থাকবে।" : "Draft saved; it remains private until published." });
      setConfirmPublish(false);
    } catch (cause) {
      setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not save draft." });
    } finally {
      setBusy(false);
    }
  }

  async function publishDraft() {
    setBusy(true);
    setFeedback(null);
    try {
      await publish({ key: contentKey });
      setFeedback({ ok: true, text: bn ? "সংরক্ষিত খসড়াটি প্রকাশিত হয়েছে।" : "The saved draft is now published." });
      setConfirmPublish(false);
    } catch (cause) {
      setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not publish content." });
    } finally {
      setBusy(false);
    }
  }

  const title = language === "bn" ? draft.titleBn : draft.titleEn;
  const body = language === "bn" ? draft.bodyBn : draft.bodyEn;
  const cta = language === "bn" ? draft.primaryCtaLabelBn : draft.primaryCtaLabelEn;
  return <>
    <label className="standalone-field">{bn ? "কনটেন্ট অংশ" : "Content section"}
      <select value={contentKey} onChange={(event) => { onKeyChange(event.target.value as ContentKey); setFeedback(null); }}>{contentKeys.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
    </label>
    <div className="status-tabs" role="tablist" aria-label={bn ? "সম্পাদনার ভাষা" : "Editing language"}>
      <button type="button" role="tab" aria-selected={language === "bn"} onClick={() => setLanguage("bn")}>বাংলা</button>
      <button type="button" role="tab" aria-selected={language === "en"} onClick={() => setLanguage("en")}>English</button>
    </div>
    <form className="operation-form" onSubmit={submit}>
      <fieldset><legend>{language === "bn" ? "বাংলা কনটেন্ট" : "English content"}</legend>
        <label>{language === "bn" ? "শিরোনাম" : "Title"}<input value={title} onChange={(event) => setDraft((current) => ({ ...current, [language === "bn" ? "titleBn" : "titleEn"]: event.target.value }))} /></label>
        <label>{language === "bn" ? "মূল লেখা" : "Body"}<textarea rows={8} value={body} onChange={(event) => setDraft((current) => ({ ...current, [language === "bn" ? "bodyBn" : "bodyEn"]: event.target.value }))} /></label>
        <label>{language === "bn" ? "বোতামের লেখা" : "CTA label"}<input value={cta} onChange={(event) => setDraft((current) => ({ ...current, [language === "bn" ? "primaryCtaLabelBn" : "primaryCtaLabelEn"]: event.target.value }))} /></label>
      </fieldset>
      <fieldset><legend>{bn ? "লিংক ও মিডিয়া" : "Link and media"}</legend>
        <label>CTA URL<input value={draft.primaryCtaHref} onChange={(event) => setDraft((current) => ({ ...current, primaryCtaHref: event.target.value }))} placeholder={`/${locale}/admission`} /></label>
        <label>{bn ? "ছবি (JPEG, PNG বা WebP; সর্বোচ্চ ৮ MB)" : "Image (JPEG, PNG, or WebP; 8 MB maximum)"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label>
      </fieldset>
      <article className="content-card" aria-label={bn ? "খসড়া প্রিভিউ" : "Draft preview"}>
        <p className="eyebrow">{bn ? "খসড়া প্রিভিউ" : "Draft preview"} · {language === "bn" ? "বাংলা" : "English"}</p>
        {mediaUrl && <CmsImage src={mediaUrl} alt="" />}
        <h2>{title || (bn ? "শিরোনাম নেই" : "Untitled")}</h2><p>{body || (bn ? "মূল লেখা নেই" : "No body copy")}</p>
        {cta && <span className="button button-primary">{cta}</span>}
      </article>
      {preview && <p className="editor-meta">{formatEditor(preview.updatedByDisplayName, preview.updatedAt, locale)} · {bn ? "খসড়া" : "Draft"} v{preview.draftRevision} · {bn ? "প্রকাশিত" : "Published"} v{preview.publishedRevision}</p>}
      <Feedback value={feedback} />
      {confirmPublish && <div className="irreversible-confirmation" role="alert"><p>{bn ? "সর্বশেষ সংরক্ষিত খসড়াটি এখনই সবার জন্য প্রকাশিত হবে। বর্তমান ফর্মের অসংরক্ষিত পরিবর্তন প্রকাশিত হবে না।" : "The latest saved draft will become public now. Unsaved form changes will not be published."}</p><div className="form-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void publishDraft()}>{bn ? "প্রকাশ নিশ্চিত করুন" : "Confirm publish"}</button><button type="button" className="button button-secondary" onClick={() => setConfirmPublish(false)}>{bn ? "বাতিল" : "Cancel"}</button></div></div>}
      <div className="form-actions"><button className="button button-secondary" disabled={busy}>{bn ? "খসড়া সংরক্ষণ" : "Save draft"}</button><button className="button button-primary" type="button" disabled={busy || !preview} onClick={() => setConfirmPublish(true)}>{bn ? "প্রকাশ করুন" : "Publish"}</button></div>
    </form>
  </>;
}

function GalleryEditor({ locale }: { locale: Locale }) {
  const items = useQuery(api.publicSite.cms.listGalleryPreviews, {});
  const [editingId, setEditingId] = useState<Id<"galleryItems"> | null>(null);
  if (items === undefined) return <PortalPageState state="loading" locale={locale} />;
  const editing = items.find((item) => item.id === editingId) ?? null;
  return <>
    <GalleryDraftForm key={`${editing?.id ?? "new"}:${editing?.updatedAt ?? 0}`} locale={locale} item={editing} onDone={() => setEditingId(null)} />
    <div className="card-grid">
      {items.map((item) => <GalleryCard key={item.id} locale={locale} item={item} onEdit={() => setEditingId(item.id)} />)}
    </div>
  </>;
}

type GalleryPreview = NonNullable<ReturnType<typeof useQuery<typeof api.publicSite.cms.listGalleryPreviews>>>[number];

function GalleryDraftForm({ locale, item, onDone }: { locale: Locale; item: GalleryPreview | null; onDone: () => void }) {
  const bn = locale === "bn";
  const [language, setLanguage] = useState<Locale>(locale);
  const [fields, setFields] = useState({ titleBn: item?.titleBn ?? "", titleEn: item?.titleEn ?? "", altBn: item?.altBn ?? "", altEn: item?.altEn ?? "", sortOrder: item?.sortOrder ?? 0 });
  const [storageId, setStorageId] = useState<Id<"_storage"> | null>(item?.imageStorageId ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackValue>(null);
  const create = useMutation(api.publicSite.cms.createGalleryItem);
  const update = useMutation(api.publicSite.cms.updateGalleryItem);
  const generateUploadUrl = useMutation(api.publicSite.cms.generateImageUploadUrl);

  async function upload(file: File) {
    validateClientImage(file);
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Image upload failed.");
      const result = await response.json() as { storageId: Id<"_storage"> };
      setStorageId(result.storageId); setImageUrl(URL.createObjectURL(file));
      setFeedback({ ok: true, text: bn ? "ছবি আপলোড হয়েছে। খসড়া সংরক্ষণ করুন।" : "Image uploaded. Save the draft to attach it." });
    } catch (cause) {
      setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not upload image." });
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!storageId) { setFeedback({ ok: false, text: bn ? "একটি ছবি নির্বাচন করুন।" : "Choose an image." }); return; }
    setBusy(true); setFeedback(null);
    try {
      if (item) await update({ galleryItemId: item.id, ...fields, imageStorageId: storageId });
      else await create({ ...fields, imageStorageId: storageId });
      setFeedback({ ok: true, text: bn ? "গ্যালারি খসড়া সংরক্ষিত হয়েছে।" : "Gallery draft saved." });
      if (item) onDone();
      else { setFields({ titleBn: "", titleEn: "", altBn: "", altEn: "", sortOrder: 0 }); setStorageId(null); setImageUrl(null); }
    } catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not save gallery draft." }); }
    finally { setBusy(false); }
  }

  const title = language === "bn" ? fields.titleBn : fields.titleEn;
  const alt = language === "bn" ? fields.altBn : fields.altEn;
  return <form className="operation-form" onSubmit={submit}>
    <fieldset><legend>{item ? (bn ? "গ্যালারি খসড়া সম্পাদনা" : "Edit gallery draft") : (bn ? "নতুন গ্যালারি খসড়া" : "New gallery draft")}</legend>
      <div className="status-tabs" role="tablist" aria-label={bn ? "সম্পাদনার ভাষা" : "Editing language"}><button type="button" role="tab" aria-selected={language === "bn"} onClick={() => setLanguage("bn")}>বাংলা</button><button type="button" role="tab" aria-selected={language === "en"} onClick={() => setLanguage("en")}>English</button></div>
      <label>{language === "bn" ? "শিরোনাম" : "Title"}<input required value={title} onChange={(event) => setFields((current) => ({ ...current, [language === "bn" ? "titleBn" : "titleEn"]: event.target.value }))} /></label>
      <label>{language === "bn" ? "বিকল্প বর্ণনা" : "Alternative text"}<textarea required rows={3} value={alt} onChange={(event) => setFields((current) => ({ ...current, [language === "bn" ? "altBn" : "altEn"]: event.target.value }))} /><small>{bn ? "ছবিতে কী দেখা যাচ্ছে তা সংক্ষেপে লিখুন।" : "Briefly describe what the image shows."}</small></label>
      <div className="form-grid"><label>{bn ? "ক্রম" : "Sort order"}<input type="number" min={0} max={100000} required value={fields.sortOrder} onChange={(event) => setFields((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></label><label>{bn ? "ছবি (JPEG, PNG বা WebP; সর্বোচ্চ ৮ MB)" : "Image (JPEG, PNG, or WebP; 8 MB maximum)"}<input type="file" accept="image/jpeg,image/png,image/webp" required={!storageId} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} /></label></div>
      {imageUrl && <CmsImage src={imageUrl} alt={alt} />}
    </fieldset>
    <Feedback value={feedback} />
    <div className="form-actions"><button className="button button-secondary" disabled={busy}>{bn ? "খসড়া সংরক্ষণ" : "Save draft"}</button>{item && <button type="button" className="button button-secondary" onClick={onDone}>{bn ? "বাতিল" : "Cancel"}</button>}</div>
  </form>;
}

function GalleryCard({ locale, item, onEdit }: { locale: Locale; item: GalleryPreview; onEdit: () => void }) {
  const bn = locale === "bn";
  const [action, setAction] = useState<"publish" | "archive" | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackValue>(null);
  const publish = useMutation(api.publicSite.cms.publishGalleryItem);
  const archive = useMutation(api.publicSite.cms.archiveGalleryItem);
  async function execute() {
    if (!action) return;
    setBusy(true); setFeedback(null);
    try {
      if (action === "publish") await publish({ galleryItemId: item.id }); else await archive({ galleryItemId: item.id });
      setFeedback({ ok: true, text: action === "publish" ? (bn ? "ছবিটি প্রকাশিত হয়েছে।" : "Image published.") : (bn ? "ছবিটি আর্কাইভ হয়েছে।" : "Image archived.") });
      setAction(null);
    } catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not update gallery item." }); }
    finally { setBusy(false); }
  }
  return <article className="content-card">
    {item.imageUrl && <CmsImage src={item.imageUrl} alt={bn ? item.altBn : item.altEn} />}
    <p className="eyebrow">{item.status} · #{item.sortOrder}</p><h2>{bn ? item.titleBn : item.titleEn}</h2><p>{bn ? item.altBn : item.altEn}</p>
    <p className="editor-meta">{formatEditor(item.updatedByDisplayName, item.updatedAt, locale)}</p><Feedback value={feedback} />
    {action && <div className="irreversible-confirmation" role="alert"><p>{action === "publish" ? (bn ? "এই ছবি এখন সবার জন্য প্রকাশিত হবে।" : "This image will become public now.") : (bn ? "এই ছবি পাবলিক গ্যালারি থেকে সরিয়ে আর্কাইভ করা হবে।" : "This image will be removed from the public gallery and archived.")}</p><div className="form-actions"><button type="button" className="button button-primary" disabled={busy} onClick={() => void execute()}>{bn ? "নিশ্চিত করুন" : "Confirm"}</button><button type="button" className="button button-secondary" onClick={() => setAction(null)}>{bn ? "বাতিল" : "Cancel"}</button></div></div>}
    {item.status !== "archived" && <div className="form-actions"><button type="button" className="button button-secondary" onClick={onEdit}>{bn ? "সম্পাদনা" : "Edit"}</button>{item.status === "draft" && <button type="button" className="button button-primary" onClick={() => setAction("publish")}>{bn ? "প্রকাশ" : "Publish"}</button>}<button type="button" className="button button-secondary" onClick={() => setAction("archive")}>{bn ? "আর্কাইভ" : "Archive"}</button></div>}
  </article>;
}

function PublicationEditor({ locale }: { locale: Locale }) {
  const data = useQuery(api.publicSite.cms.getPublicationWorkspace, {});
  if (data === undefined) return <PortalPageState state="loading" locale={locale} />;
  return <div className="detail-grid"><PublicationList locale={locale} kind="course" rows={data.courses} /><PublicationList locale={locale} kind="teacher" rows={data.teachers} /></div>;
}

function PublicationList({ locale, kind, rows }: {
  locale: Locale;
  kind: "course" | "teacher";
  rows: Array<{ courseId?: Id<"courses">; teacherId?: Id<"teachers">; nameBn?: string; nameEn?: string; displayName?: string; isPublic: boolean; publicSortOrder: number }>;
}) {
  const bn = locale === "bn";
  return <section><h2>{kind === "course" ? (bn ? "পাবলিক কোর্স" : "Public courses") : (bn ? "পাবলিক শিক্ষক" : "Public teachers")}</h2>{rows.map((row) => <PublicationRow key={String(row.courseId ?? row.teacherId)} locale={locale} kind={kind} row={row} />)}</section>;
}

function PublicationRow({ locale, kind, row }: {
  locale: Locale;
  kind: "course" | "teacher";
  row: { courseId?: Id<"courses">; teacherId?: Id<"teachers">; nameBn?: string; nameEn?: string; displayName?: string; isPublic: boolean; publicSortOrder: number };
}) {
  const bn = locale === "bn";
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackValue>(null);
  const setCourse = useMutation(api.publicSite.cms.setCoursePublication);
  const setTeacher = useMutation(api.publicSite.cms.setTeacherPublication);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setFeedback(null);
    try {
      const isPublic = data.get("isPublic") === "on"; const publicSortOrder = Number(data.get("publicSortOrder"));
      if (kind === "course" && row.courseId) await setCourse({ courseId: row.courseId, isPublic, publicSortOrder });
      if (kind === "teacher" && row.teacherId) await setTeacher({ teacherId: row.teacherId, isPublic, publicSortOrder });
      setFeedback({ ok: true, text: bn ? "প্রকাশনার অবস্থা সংরক্ষিত হয়েছে।" : "Publication status saved." });
    } catch (cause) { setFeedback({ ok: false, text: cause instanceof Error ? cause.message : "Could not save publication status." }); }
    finally { setBusy(false); }
  }
  return <form className="operation-form" onSubmit={submit}><h3>{kind === "course" ? (bn ? row.nameBn : row.nameEn) : row.displayName}</h3><div className="form-grid"><label className="check-row"><input name="isPublic" type="checkbox" defaultChecked={row.isPublic} /><span>{bn ? "পাবলিক ওয়েবসাইটে দেখান" : "Show on public website"}</span></label><label>{bn ? "ক্রম" : "Sort order"}<input name="publicSortOrder" type="number" min={0} max={100000} defaultValue={row.publicSortOrder} required /></label></div><Feedback value={feedback} /><button className="button button-secondary" disabled={busy}>{bn ? "সংরক্ষণ" : "Save"}</button></form>;
}

export function WebsiteCmsEditor({ locale }: { locale: Locale }) {
  const bn = locale === "bn";
  const [section, setSection] = useState<"content" | "gallery" | "publication">("content");
  return <>
    <header className="portal-page-header"><p className="eyebrow">CMS</p><h1>{bn ? "পাবলিক ওয়েবসাইট" : "Public website"}</h1><p>{bn ? "দ্বিভাষিক কনটেন্ট, মিডিয়া ও প্রকাশনার দৃশ্যমানতা পরিচালনা করুন।" : "Manage bilingual content, media, and public visibility."}</p></header>
    <div className="status-tabs" role="tablist" aria-label={bn ? "ওয়েবসাইট পরিচালনা" : "Website management"}><button type="button" role="tab" aria-selected={section === "content"} onClick={() => setSection("content")}>{bn ? "কনটেন্ট" : "Content"}</button><button type="button" role="tab" aria-selected={section === "gallery"} onClick={() => setSection("gallery")}>{bn ? "গ্যালারি" : "Gallery"}</button><button type="button" role="tab" aria-selected={section === "publication"} onClick={() => setSection("publication")}>{bn ? "দৃশ্যমানতা" : "Visibility"}</button></div>
    {section === "content" ? <ContentEditor locale={locale} /> : section === "gallery" ? <GalleryEditor locale={locale} /> : <PublicationEditor locale={locale} />}
  </>;
}
