"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FlaskConical } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import styles from "./portal.module.css";

export function DevAccountSwitcher({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const impersonationEnabled = useQuery(api.devTesting.isEnabled, {});
  const personas = useQuery(api.devTesting.listPersonas, impersonationEnabled ? {} : "skip");
  const seedPersonas = useMutation(api.devTesting.seedPersonas);
  const seedAcademics = useMutation(api.devSeedData.seedAcademics);
  const seedOperations = useMutation(api.devSeedData.seedOperations);
  const resetOperations = useMutation(api.devSeedData.resetDemoOperations);
  const select = useMutation(api.devTesting.selectPersona);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const groups = useMemo(() => ({ teachers: personas?.filter((person) => person.role === "teacher") ?? [], students: personas?.filter((person) => person.role === "student") ?? [] }), [personas]);
  if (!impersonationEnabled) return null;
  async function change(accountId: string) { setBusy(true); setMessage(""); try { const role = await select({ accountId: accountId ? accountId as Id<"portalAccounts"> : undefined }); window.location.assign(`/${locale}/${role}`); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setBusy(false); } }
  async function createData() { setBusy(true); setMessage(""); try { const people = await seedPersonas({}); const academics = await seedAcademics({}); const operations = await seedOperations({}); setMessage(`${people.totalTeachers} teachers · ${people.totalStudents} students · ${academics.courses} courses · ${academics.batches} batches · ${operations.results} results`); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  async function resetData() { setBusy(true); setMessage(""); try { const result = await resetOperations({}); setMessage(`${result.removed} demo records removed. Create complete test data to rebuild them.`); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } }
  return <section className={styles.devSwitcher} aria-label={bn ? "পরীক্ষামূলক অ্যাকাউন্ট" : "Test accounts"}>
    <div className={styles.devSwitcherTitle}><FlaskConical aria-hidden="true" /> <span>{bn ? "টেস্ট মোড" : "Test mode"}</span></div>
    <button className={styles.devSeedButton} type="button" disabled={busy || personas === undefined} onClick={() => void createData()}>{busy ? (bn ? "সম্পূর্ণ ডেটা তৈরি হচ্ছে…" : "Creating complete data…") : (bn ? "সম্পূর্ণ টেস্ট ডেটা নিশ্চিত করুন" : "Ensure complete test data")}</button>
    <AlertDialog><AlertDialogTrigger asChild><Button variant="danger" className={styles.devResetButton} disabled={busy || personas === undefined}>{bn ? "ডেমো অপারেশন রিসেট করুন" : "Reset demo operations"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{bn ? "ডেমো অপারেশন রিসেট করবেন?" : "Reset demo operations?"}</AlertDialogTitle><AlertDialogDescription>{bn ? "এটি তৈরি করা ডেমো উপস্থিতি, ফি, পেমেন্ট, ফলাফল, নোটিশ ও SMS ইতিহাস মুছে দেবে। ডেমো অ্যাকাউন্ট এবং একাডেমিক সেটআপ থাকবে।" : "This removes generated demo attendance, fees, payments, results, notices, and SMS history. Demo accounts and academic setup remain."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void resetData()}>{bn ? "ডেমো রিসেট করুন" : "Reset demo"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    {personas && groups.teachers.length >= 12 && groups.students.length >= 65 ? <select className={styles.devSelect} disabled={busy} defaultValue="current" onChange={(event) => void change(event.target.value)} aria-label="Switch account">
      <option value="current" disabled>{bn ? "অ্যাকাউন্ট পরিবর্তন করুন…" : "Switch account…"}</option><option value="">{bn ? "মালিক হিসেবে ফিরুন" : "Return to owner"}</option>
      <optgroup label={`${groups.teachers.length} teachers`}>{groups.teachers.map((person) => <option key={person.accountId} value={person.accountId}>{person.code} · {person.displayName}</option>)}</optgroup>
      <optgroup label={`${groups.students.length} students`}>{groups.students.map((person) => <option key={person.accountId} value={person.accountId}>{person.code} · {person.displayName}</option>)}</optgroup>
    </select> : null}
    {message ? <p className={styles.devMessage} role="status">{message}</p> : null}
  </section>;
}
