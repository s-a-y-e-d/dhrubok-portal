"use client";

import { Moon, MoreHorizontal, Search, Sun, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const copy = {
  bn: {
    eyebrow: "ডেভেলপমেন্ট প্রিভিউ",
    title: "ধ্রুবক UI ভিত্তি",
    description: "বাংলা-প্রথম ড্যাশবোর্ড কম্পোনেন্টের অনুমোদিত অবস্থা ও আচরণ।",
    actions: "বাটন ও কাজ",
    forms: "ফর্ম কন্ট্রোল",
    overlays: "ডায়ালগ, ড্রয়ার ও মেনু",
    states: "স্ট্যাটাস ও লোডিং",
    compositions: "কাজের উপযোগী কম্পোজিশন",
    lightMode: "লাইট মোড দেখুন",
    darkMode: "ডার্ক মোড দেখুন",
    primary: "শিক্ষার্থী যোগ করুন",
    secondary: "বাতিল",
    ghost: "বিস্তারিত দেখুন",
    danger: "মুছে ফেলুন",
    loading: "সংরক্ষণ হচ্ছে",
    name: "শিক্ষার্থীর নাম",
    phone: "অভিভাবকের ফোন",
    batch: "ব্যাচ",
    notes: "অভ্যন্তরীণ নোট",
    consent: "অভিভাবকের তথ্য যাচাই করা হয়েছে",
    chooseBatch: "ব্যাচ নির্বাচন করুন",
    invalidHelp: "সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।",
    dialogTitle: "শিক্ষার্থী যোগ করুন",
    dialogDescription: "প্রয়োজনীয় পরিচয় ও যোগাযোগের তথ্য দিন। পরে ভর্তি তথ্য যোগ করা যাবে।",
    save: "শিক্ষার্থী সংরক্ষণ করুন",
    drawerTitle: "দ্রুত সম্পাদনা",
    drawerDescription: "রেকর্ডের প্রাথমিক তথ্য পরিবর্তন করুন।",
    menu: "আরও কাজ",
    edit: "সম্পাদনা করুন",
    archive: "আর্কাইভ করুন",
    deleteTitle: "রেকর্ডটি মুছে ফেলবেন?",
    deleteDescription: "এই কাজটি ফিরিয়ে নেওয়া যাবে না। সংশ্লিষ্ট ভর্তি তথ্যও প্রভাবিত হতে পারে।",
    active: "সক্রিয়",
    pending: "পর্যালোচনাধীন",
    overdue: "বকেয়া",
    published: "প্রকাশিত",
    neutral: "খসড়া",
    searchPlaceholder: "নাম, আইডি বা ফোন দিয়ে খুঁজুন",
    allStatuses: "সব অবস্থা",
    readOnly: "শিক্ষার্থী আইডি (শুধু দেখা যাবে)",
    disabled: "স্বয়ংক্রিয়ভাবে নির্ধারিত ব্যাচ",
    optionalConsent: "প্রচারমূলক SMS পাঠানোর অনুমতি আছে",
    student: "সাদিয়া রহমান",
    studentMeta: "ID 2026-0142 · Science A",
    due: "বকেয়া ৳২,৫০০",
  },
  en: {
    eyebrow: "Development preview",
    title: "Dhrubok UI foundation",
    description: "Approved states and behaviour for Bangla-first dashboard components.",
    actions: "Buttons and actions",
    forms: "Form controls",
    overlays: "Dialogs, drawers and menus",
    states: "Status and loading",
    compositions: "Useful compositions",
    lightMode: "Show light mode",
    darkMode: "Show dark mode",
    primary: "Add student",
    secondary: "Cancel",
    ghost: "View details",
    danger: "Delete",
    loading: "Saving",
    name: "Student name",
    phone: "Guardian phone",
    batch: "Batch",
    notes: "Internal notes",
    consent: "Guardian information has been verified",
    chooseBatch: "Choose a batch",
    invalidHelp: "Enter a valid Bangladeshi mobile number.",
    dialogTitle: "Add student",
    dialogDescription: "Enter the required identity and contact details. Enrolment can be added afterward.",
    save: "Save student",
    drawerTitle: "Quick edit",
    drawerDescription: "Update the record's primary information.",
    menu: "More actions",
    edit: "Edit record",
    archive: "Archive record",
    deleteTitle: "Delete this record?",
    deleteDescription: "This cannot be undone. Related enrolment information may also be affected.",
    active: "Active",
    pending: "Under review",
    overdue: "Overdue",
    published: "Published",
    neutral: "Draft",
    searchPlaceholder: "Search by name, ID or phone",
    allStatuses: "All statuses",
    readOnly: "Student ID (read only)",
    disabled: "Automatically assigned batch",
    optionalConsent: "May receive promotional SMS",
    student: "Sadia Rahman",
    studentMeta: "ID 2026-0142 · Science A",
    due: "BDT 2,500 overdue",
  },
} as const;

const darkThemeTokens = {
  "--ink": "#f5f5f5",
  "--ink-secondary": "#d4d4d4",
  "--ink-mute": "#a3a3a3",
  "--ink-faint": "#737373",
  "--ink-disabled": "#525252",
  "--canvas": "#171717",
  "--canvas-soft": "#111111",
  "--canvas-subtle": "#262626",
  "--border": "#333333",
  "--border-strong": "#525252",
  "--border-muted": "#2b2b2b",
  "--brand-muted": "#12382b",
  "--success-muted": "#10271a",
  "--warning-muted": "#2c210d",
  "--danger-muted": "#321515",
  "--info-muted": "#14213d",
  "--shadow-1": "0 1px 3px rgba(0, 0, 0, 0.32)",
  "--shadow-2": "0 6px 18px rgba(0, 0, 0, 0.4)",
  "--shadow-3": "0 18px 48px rgba(0, 0, 0, 0.5)",
} as const;

export function UiShowcase({ locale }: { locale: "bn" | "en" }) {
  const [checked, setChecked] = useState(true);
  const [dark, setDark] = useState(false);
  const t = copy[locale];

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.uiShowcaseTheme = dark ? "dark" : "light";
    if (dark) {
      Object.entries(darkThemeTokens).forEach(([token, value]) => root.style.setProperty(token, value));
    } else {
      Object.keys(darkThemeTokens).forEach((token) => root.style.removeProperty(token));
    }
    return () => {
      delete root.dataset.uiShowcaseTheme;
      Object.keys(darkThemeTokens).forEach((token) => root.style.removeProperty(token));
    };
  }, [dark]);

  return (
    <TooltipProvider>
      <main id="main-content" className="min-h-screen bg-[var(--canvas-soft)] px-4 py-8 text-[var(--ink)] sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6">
          <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">{t.eyebrow}</p>
              <h1 className="text-3xl font-semibold leading-tight tracking-[-0.02em] [:lang(bn)_&]:tracking-normal sm:text-4xl">{t.title}</h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--ink-mute)]">{t.description}</p>
            </div>
            <Button variant="secondary" onClick={() => setDark((value) => !value)} aria-pressed={dark} className="self-start">
              {dark ? <Sun /> : <Moon />}{dark ? t.lightMode : t.darkMode}
            </Button>
          </header>

          <ShowcaseSection title={t.actions}>
            <div className="flex flex-wrap items-center gap-3">
              <Button>{t.primary}</Button>
              <Button variant="secondary">{t.secondary}</Button>
              <Button variant="ghost">{t.ghost}</Button>
              <Button variant="danger"><Trash2 />{t.danger}</Button>
              <Button loading>{t.loading}</Button>
              <Button disabled>{t.primary}</Button>
              <Button size="sm" variant="secondary">{t.edit}</Button>
              <Tooltip><TooltipTrigger asChild><Button variant="secondary" size="icon" aria-label={t.menu}><Search /></Button></TooltipTrigger><TooltipContent>{t.menu}</TooltipContent></Tooltip>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title={t.forms}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label={t.name} htmlFor="student-name"><Input id="student-name" placeholder={locale === "bn" ? "যেমন: সাদিয়া রহমান" : "For example: Sadia Rahman"} /></Field>
              <Field label={t.phone} htmlFor="guardian-phone" help={t.invalidHelp} invalid><Input id="guardian-phone" defaultValue="017" aria-invalid="true" aria-describedby="guardian-phone-help" /></Field>
              <Field label={t.batch} htmlFor="batch-select"><Select><SelectTrigger id="batch-select"><SelectValue placeholder={t.chooseBatch} /></SelectTrigger><SelectContent><SelectItem value="science-a">Science A · 2026</SelectItem><SelectItem value="science-b">Science B · 2026</SelectItem><SelectItem value="commerce">Commerce · 2026</SelectItem></SelectContent></Select></Field>
              <Field label={t.notes} htmlFor="notes"><Textarea id="notes" placeholder={locale === "bn" ? "শুধু মালিকদের জন্য দৃশ্যমান" : "Visible to owners only"} /></Field>
              <Field label={t.readOnly} htmlFor="read-only"><Input id="read-only" value="2026-0142" readOnly /></Field>
              <Field label={t.disabled} htmlFor="disabled-field"><Input id="disabled-field" value="Science A · 2026" disabled /></Field>
              <div className="flex items-start gap-3 md:col-span-2"><Checkbox id="verified" checked={checked} onCheckedChange={(value) => setChecked(value === true)} /><Label htmlFor="verified" className="min-h-5 cursor-pointer font-normal">{t.consent}</Label></div>
              <div className="flex items-start gap-3 md:col-span-2"><Checkbox id="optional-consent" /><Label htmlFor="optional-consent" className="min-h-5 cursor-pointer font-normal">{t.optionalConsent}</Label></div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title={t.compositions}>
            <div className="grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ink-mute)]" aria-hidden="true" />
                  <Input className="ps-9" aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder} />
                </div>
                <Select defaultValue="all"><SelectTrigger className="sm:w-48" aria-label={t.allStatuses}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t.allStatuses}</SelectItem><SelectItem value="active">{t.active}</SelectItem><SelectItem value="pending">{t.pending}</SelectItem></SelectContent></Select>
              </div>
              <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><p className="font-medium leading-6">{t.student}</p><p className="text-sm leading-6 text-[var(--ink-mute)]">{t.studentMeta}</p></div>
                <div className="flex flex-wrap items-center gap-2"><Badge variant="danger">{t.due}</Badge><Button size="sm" variant="secondary">{t.ghost}</Button><Button size="sm">{locale === "bn" ? "পেমেন্ট নিন" : "Collect payment"}</Button></div>
              </div>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title={t.overlays}>
            <div className="flex flex-wrap gap-3">
              <Dialog><DialogTrigger asChild><Button>{t.dialogTitle}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{t.dialogTitle}</DialogTitle><DialogDescription>{t.dialogDescription}</DialogDescription></DialogHeader><div className="grid gap-4"><Field label={t.name} htmlFor="dialog-name"><Input id="dialog-name" /></Field><Field label={t.phone} htmlFor="dialog-phone"><Input id="dialog-phone" inputMode="tel" /></Field></div><DialogFooter><DialogClose asChild><Button variant="secondary">{t.secondary}</Button></DialogClose><Button>{t.save}</Button></DialogFooter></DialogContent></Dialog>
              <Sheet><SheetTrigger asChild><Button variant="secondary">{t.drawerTitle}</Button></SheetTrigger><SheetContent><SheetHeader><SheetTitle>{t.drawerTitle}</SheetTitle><SheetDescription>{t.drawerDescription}</SheetDescription></SheetHeader><div className="grid gap-4"><Field label={t.name} htmlFor="sheet-name"><Input id="sheet-name" defaultValue={locale === "bn" ? "সাদিয়া রহমান" : "Sadia Rahman"} /></Field><Field label={t.batch} htmlFor="sheet-batch"><Input id="sheet-batch" defaultValue="Science A · 2026" disabled /></Field></div><SheetFooter><SheetClose asChild><Button variant="secondary">{t.secondary}</Button></SheetClose><Button>{t.save}</Button></SheetFooter></SheetContent></Sheet>
              <AlertDialog><AlertDialogTrigger asChild><Button variant="danger">{t.danger}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t.secondary}</AlertDialogCancel><AlertDialogAction>{t.danger}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="secondary"><MoreHorizontal />{t.menu}</Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuLabel>{t.menu}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem>{t.edit}</DropdownMenuItem><DropdownMenuItem>{t.archive}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-[var(--danger)] focus:bg-[var(--danger-muted)] focus:text-[var(--danger-deep)]">{t.danger}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>
          </ShowcaseSection>

          <ShowcaseSection title={t.states}>
            <div className="flex flex-wrap gap-2"><Badge variant="success">{t.active}</Badge><Badge variant="warning">{t.pending}</Badge><Badge variant="danger">{t.overdue}</Badge><Badge variant="info">{t.published}</Badge><Badge>{t.neutral}</Badge></div>
            <Separator className="my-5" />
            <div className="grid max-w-xl gap-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-11 w-full" /><div className="grid grid-cols-3 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div></div>
          </ShowcaseSection>
        </div>
      </main>
    </TooltipProvider>
  );
}

function ShowcaseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--canvas)] p-5 shadow-[var(--shadow-1)] sm:p-6"><h2 className="mb-5 text-lg font-semibold leading-7">{title}</h2>{children}</section>;
}

function Field({ label, htmlFor, help, invalid, children }: { label: string; htmlFor: string; help?: string; invalid?: boolean; children: React.ReactNode }) {
  return <div className="grid content-start gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}{help ? <p id={`${htmlFor}-help`} className={invalid ? "text-xs leading-5 text-[var(--danger)]" : "text-xs leading-5 text-[var(--ink-mute)]"}>{help}</p> : null}</div>;
}
