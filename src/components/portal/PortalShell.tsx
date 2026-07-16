"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  BookOpen,
  CalendarCheck,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Bell,
  BarChart3,
  Globe,
  Settings,
  Clock,
  GraduationCap,
  Receipt,
  User,
  LogOut,
  Menu,
  X,
  Languages,
  Moon,
  Sun,
  MessageSquare,
} from "lucide-react";
import styles from "./portal.module.css";
import { DevAccountSwitcher } from "./DevAccountSwitcher";

// Navigation Item Definition
interface NavItemDef {
  labelEn: string;
  labelBn: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroupDef {
  groupLabelEn: string;
  groupLabelBn: string;
  items: NavItemDef[];
}

const ownerNavGroups: NavGroupDef[] = [
  {
    groupLabelEn: "Operations",
    groupLabelBn: "কার্যক্রম",
    items: [
      {
        labelEn: "Overview",
        labelBn: "ওভারভিউ",
        path: "",
        icon: LayoutDashboard,
      },
      {
        labelEn: "Admissions",
        labelBn: "ভর্তি",
        path: "/admissions",
        icon: UserPlus,
      },
      {
        labelEn: "Students",
        labelBn: "শিক্ষার্থী",
        path: "/students",
        icon: Users,
      },
      {
        labelEn: "Academics",
        labelBn: "একাডেমিক",
        path: "/courses",
        icon: BookOpen,
      },
      {
        labelEn: "Attendance",
        labelBn: "উপস্থিতি",
        path: "/attendance",
        icon: CalendarCheck,
      },
      {
        labelEn: "Finance",
        labelBn: "অর্থায়ন",
        path: "/finance",
        icon: DollarSign,
      },
      {
        labelEn: "Exams",
        labelBn: "পরীক্ষা",
        path: "/exams",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    groupLabelEn: "Communication",
    groupLabelBn: "যোগাযোগ",
    items: [
      {
        labelEn: "Materials",
        labelBn: "শেখার সামগ্রী",
        path: "/materials",
        icon: FileText,
      },
      {
        labelEn: "Notices/SMS",
        labelBn: "নোটিশ ও SMS",
        path: "/notices",
        icon: Bell,
      },
      {
        labelEn: "Messages & SMS",
        labelBn: "বার্তা ও SMS",
        path: "/messages",
        icon: MessageSquare,
      },
    ],
  },
  {
    groupLabelEn: "System",
    groupLabelBn: "সিস্টেম",
    items: [
      {
        labelEn: "Reports",
        labelBn: "প্রতিবেদন",
        path: "/reports",
        icon: BarChart3,
      },
      {
        labelEn: "Website",
        labelBn: "ওয়েবসাইট",
        path: "/website",
        icon: Globe,
      },
      {
        labelEn: "Settings",
        labelBn: "সেটিংস",
        path: "/settings",
        icon: Settings,
      },
    ],
  },
];

const teacherNavGroups: NavGroupDef[] = [
  {
    groupLabelEn: "My Work",
    groupLabelBn: "আমার কাজ",
    items: [
      {
        labelEn: "Overview",
        labelBn: "ওভারভিউ",
        path: "",
        icon: LayoutDashboard,
      },
      {
        labelEn: "My batches",
        labelBn: "আমার ব্যাচ",
        path: "/batches",
        icon: BookOpen,
      },
      { labelEn: "Routine", labelBn: "রুটিন", path: "/routine", icon: Clock },
      {
        labelEn: "Attendance",
        labelBn: "উপস্থিতি",
        path: "/attendance",
        icon: CalendarCheck,
      },
      {
        labelEn: "Exams/marks",
        labelBn: "পরীক্ষা ও নম্বর",
        path: "/exams",
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    groupLabelEn: "Resources",
    groupLabelBn: "রিসোর্স",
    items: [
      {
        labelEn: "Materials",
        labelBn: "শেখার সামগ্রী",
        path: "/materials",
        icon: FileText,
      },
      { labelEn: "Notices", labelBn: "নোটিশ", path: "/notices", icon: Bell },
    ],
  },
  {
    groupLabelEn: "Account",
    groupLabelBn: "অ্যাকাউন্ট",
    items: [
      { labelEn: "Profile", labelBn: "প্রোফাইল", path: "/profile", icon: User },
    ],
  },
];

const studentNavGroups: NavGroupDef[] = [
  {
    groupLabelEn: "My Portal",
    groupLabelBn: "আমার পোর্টাল",
    items: [
      {
        labelEn: "Overview",
        labelBn: "ওভারভিউ",
        path: "",
        icon: LayoutDashboard,
      },
      { labelEn: "Routine", labelBn: "রুটিন", path: "/routine", icon: Clock },
      {
        labelEn: "Attendance",
        labelBn: "উপস্থিতি",
        path: "/attendance",
        icon: CalendarCheck,
      },
      {
        labelEn: "Fees/receipts",
        labelBn: "ফি ও রশিদ",
        path: "/fees",
        icon: Receipt,
      },
      {
        labelEn: "Results",
        labelBn: "ফলাফল",
        path: "/results",
        icon: GraduationCap,
      },
    ],
  },
  {
    groupLabelEn: "Learning",
    groupLabelBn: "শেখার অংশ",
    items: [
      {
        labelEn: "Materials",
        labelBn: "শেখার সামগ্রী",
        path: "/materials",
        icon: FileText,
      },
      { labelEn: "Notices", labelBn: "নোটিশ", path: "/notices", icon: Bell },
    ],
  },
  {
    groupLabelEn: "Account",
    groupLabelBn: "অ্যাকাউন্ট",
    items: [
      { labelEn: "Profile", labelBn: "প্রোফাইল", path: "/profile", icon: User },
    ],
  },
];

// Owner Quick Actions Definition
const ownerQuickActions = [
  {
    labelEn: "Add student",
    labelBn: "শিক্ষার্থী যোগ করুন",
    path: "/students?add=true",
    icon: UserPlus,
  },
  {
    labelEn: "Collect payment",
    labelBn: "ফি সংগ্রহ করুন",
    path: "/finance?view=collect",
    icon: DollarSign,
  },
  {
    labelEn: "Take attendance",
    labelBn: "উপস্থিতি নিন",
    path: "/attendance",
    icon: CalendarCheck,
  },
  {
    labelEn: "Create exam",
    labelBn: "পরীক্ষা তৈরি করুন",
    path: "/exams",
    icon: FileSpreadsheet,
  },
  {
    labelEn: "Send reminders",
    labelBn: "বকেয়া তাগিদ পাঠান",
    path: "/finance?view=dues",
    icon: Bell,
  },
];

// Route Auto-resolved Metadata
const navMetadata: Record<
  string,
  { titleEn: string; titleBn: string; descEn: string; descBn: string }
> = {
  "": {
    titleEn: "Overview",
    titleBn: "ওভারভিউ",
    descEn: "Overview of system status and quick stats.",
    descBn: "সিস্টেমের অবস্থা এবং পরিসংখ্যানের সংক্ষিপ্ত বিবরণ।",
  },
  "/admissions": {
    titleEn: "Admissions",
    titleBn: "ভর্তি",
    descEn: "Manage admission applications and convert them to students.",
    descBn: "ভর্তির আবেদনসমূহ পরিচালনা করুন এবং শিক্ষার্থীদের তথ্য আপলোড করুন।",
  },
  "/students": {
    titleEn: "Students",
    titleBn: "শিক্ষার্থী",
    descEn: "View and manage registered student profiles and enrolments.",
    descBn: "নিবন্ধিত শিক্ষার্থীদের প্রোফাইল এবং কোর্স তালিকা পরিচালনা করুন।",
  },
  "/courses": {
    titleEn: "Academics",
    titleBn: "একাডেমিক",
    descEn: "Manage courses, subjects, batches, and class routines.",
    descBn: "কোর্স, বিষয়, ব্যাচ এবং ক্লাস রুটিন পরিচালনা করুন।",
  },
  "/attendance": {
    titleEn: "Attendance",
    titleBn: "উপস্থিতি",
    descEn: "Track daily student attendance and manage class rosters.",
    descBn:
      "শিক্ষার্থীদের দৈনিক উপস্থিতি ট্র্যাক করুন এবং তালিকা পরিচালনা করুন।",
  },
  "/finance": {
    titleEn: "Finance",
    titleBn: "অর্থায়ন",
    descEn: "Record payments, track student dues, and print A5 receipts.",
    descBn: "ফি সংগ্রহ, শিক্ষার্থীদের বকেয়া ট্র্যাক এবং রশিদ প্রিন্ট করুন।",
  },
  "/exams": {
    titleEn: "Exams",
    titleBn: "পরীক্ষা",
    descEn: "Schedule offline exams, enter marks, and publish results.",
    descBn: "পরীক্ষার রুটিন, নম্বর এন্ট্রি এবং ফলাফল প্রকাশ পরিচালনা করুন।",
  },
  "/fees": {
    titleEn: "Fees & Receipts",
    titleBn: "ফি ও রশিদ",
    descEn: "View fee statements, outstanding dues, and download receipts.",
    descBn: "ফি বিবরণী, বকেয়া এবং পেমেন্ট রশিদের তালিকা দেখুন।",
  },
  "/notices": {
    titleEn: "Notices & Announcements",
    titleBn: "নোটিশ ও ঘোষণা",
    descEn: "Post bulletins, create announcements, and monitor communication.",
    descBn: "নোটিশ বোর্ড, নতুন ঘোষণা এবং নোটিফিকেশন স্ট্যাটাস দেখুন।",
  },
  "/materials": {
    titleEn: "Materials",
    titleBn: "শেখার সামগ্রী",
    descEn: "Access and share lecture sheets, syllabus, and study materials.",
    descBn: "লেকচার শিট, সিলেবাস এবং অন্যান্য পড়ার সামগ্রী ডাউনলোড করুন।",
  },
  "/reports": {
    titleEn: "Reports",
    titleBn: "প্রতিবেদন",
    descEn: "Generate academic and financial performance reports.",
    descBn: "একাডেমিক এবং আর্থিক অগ্রগতির প্রতিবেদন তৈরি করুন।",
  },
  "/website": {
    titleEn: "Website Config",
    titleBn: "ওয়েবসাইট কনফিগ",
    descEn: "Configure public website pages and information.",
    descBn: "পাবলিক ওয়েবসাইটের পেজ এবং তথ্য কনফিগার করুন।",
  },
  "/settings": {
    titleEn: "Settings",
    titleBn: "সেটিংস",
    descEn: "Configure coaching parameters, fees, and SMS templates.",
    descBn: "কোচিংয়ের সাধারণ সেটিংস, ফি এবং SMS টেমপ্লেট কনফিগার করুন।",
  },
  "/batches": {
    titleEn: "My Batches",
    titleBn: "আমার ব্যাচ",
    descEn: "View assigned student batches and schedules.",
    descBn: "আপনার দায়িত্বপ্রাপ্ত ব্যাচ এবং রুটিন দেখুন।",
  },
  "/routine": {
    titleEn: "Class Routine",
    titleBn: "ক্লাস রুটিন",
    descEn: "Weekly routine and class schedules.",
    descBn: "সাপ্তাহিক রুটিন এবং ক্লাসের সময়সূচী।",
  },
  "/results": {
    titleEn: "Exam Results",
    titleBn: "পরীক্ষার ফলাফল",
    descEn: "View academic transcripts, pass indicators, and rankings.",
    descBn: "পরীক্ষার ফলাফল, পাসের হার এবং মেধা তালিকা দেখুন।",
  },
  "/profile": {
    titleEn: "Profile Settings",
    titleBn: "প্রোফাইল সেটিংস",
    descEn: "Manage your account settings and personal details.",
    descBn: "আপনার অ্যাকাউন্ট সেটিংস এবং ব্যক্তিগত বিবরণ পরিচালনা করুন।",
  },
};

interface PortalShellProps {
  role: "owner" | "teacher" | "student";
  locale: "bn" | "en";
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PortalShell({
  role,
  locale,
  title,
  subtitle,
  actions,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  const isBn = locale === "bn";

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("dhrubok-portal-theme");
    const preferredTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    queueMicrotask(() => setTheme(preferredTheme));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.portalTheme = theme;
    return () => {
      delete root.dataset.portalTheme;
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      window.localStorage.setItem("dhrubok-portal-theme", next);
      return next;
    });
  };

  const navGroups =
    role === "owner"
      ? ownerNavGroups
      : role === "teacher"
        ? teacherNavGroups
        : studentNavGroups;

  // Active state matching helper
  const isItemActive = (itemPath: string) => {
    const baseRoute = `/${locale}/${role}`;
    const fullPath = itemPath === "" ? baseRoute : `${baseRoute}${itemPath}`;
    if (itemPath === "") {
      return pathname === baseRoute;
    }
    return pathname === fullPath || pathname.startsWith(fullPath + "/");
  };

  // Resolve metadata automatically if not overridden by props
  const getPageMeta = () => {
    const baseRoute = `/${locale}/${role}`;
    const cleanSubPath = pathname.replace(baseRoute, "");
    // Extract base subroute (e.g. /students/add -> /students)
    const segments = cleanSubPath.split("/");
    const primarySubPath = segments.length > 1 ? `/${segments[1]}` : "";
    const meta = navMetadata[primarySubPath] || navMetadata[""];
    return {
      title: isBn ? meta.titleBn : meta.titleEn,
      subtitle: isBn ? meta.descBn : meta.descEn,
    };
  };

  const resolvedMeta = getPageMeta();
  const displayTitle = title ?? resolvedMeta.title;
  const displaySubtitle = subtitle ?? resolvedMeta.subtitle;

  // Language switcher logic preserving subpath and query parameters
  const toggleLanguage = () => {
    const targetLocale = locale === "bn" ? "en" : "bn";
    const suffix = pathname.replace(/^\/(bn|en)/, "") || "";
    const queryString = searchParams?.toString();
    const targetUrl = `/${targetLocale}${suffix}${queryString ? `?${queryString}` : ""}`;
    router.push(targetUrl);
  };

  // Close drawer on Escape press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    if (drawerOpen) {
      drawerWasOpen.current = true;
      document.addEventListener("keydown", handleKeyDown);
      const firstFocusable =
        drawerRef.current?.querySelector<HTMLElement>("button, a[href]");
      firstFocusable?.focus();
    } else if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      menuButtonRef.current?.focus({ preventScroll: true });
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [drawerOpen]);

  // Bottom Nav bar configurations (max 5 items)
  // For owner: Overview, Admissions, Students, Attendance + More
  // For teacher: Overview, Batches, Routine, Attendance + More
  // For student: Overview, Routine, Attendance, Fees + More
  const getBottomNavItems = () => {
    if (role === "owner") {
      return [
        {
          labelEn: "Overview",
          labelBn: "ওভারভিউ",
          path: "",
          icon: LayoutDashboard,
        },
        {
          labelEn: "Collect Fee",
          labelBn: "ফি সংগ্রহ",
          path: "/finance?view=collect",
          icon: DollarSign,
        },
        {
          labelEn: "Students",
          labelBn: "শিক্ষার্থী",
          path: "/students",
          icon: Users,
        },
        {
          labelEn: "Attendance",
          labelBn: "উপস্থিতি",
          path: "/attendance",
          icon: CalendarCheck,
        },
      ];
    } else if (role === "teacher") {
      return [
        {
          labelEn: "Overview",
          labelBn: "ওভারভিউ",
          path: "",
          icon: LayoutDashboard,
        },
        {
          labelEn: "Batches",
          labelBn: "আমার ব্যাচ",
          path: "/batches",
          icon: BookOpen,
        },
        { labelEn: "Routine", labelBn: "রুটিন", path: "/routine", icon: Clock },
        {
          labelEn: "Attendance",
          labelBn: "উপস্থিতি",
          path: "/attendance",
          icon: CalendarCheck,
        },
      ];
    } else {
      return [
        {
          labelEn: "Overview",
          labelBn: "ওভারভিউ",
          path: "",
          icon: LayoutDashboard,
        },
        { labelEn: "Routine", labelBn: "রুটিন", path: "/routine", icon: Clock },
        {
          labelEn: "Attendance",
          labelBn: "উপস্থিতি",
          path: "/attendance",
          icon: CalendarCheck,
        },
        { labelEn: "Fees", labelBn: "ফি ও রশিদ", path: "/fees", icon: Receipt },
      ];
    }
  };

  const bottomNavPrimary = getBottomNavItems();

  // Get user initial or safe display text
  const userInitial = user?.firstName
    ? user.firstName.charAt(0).toUpperCase()
    : user?.primaryEmailAddress?.emailAddress?.charAt(0).toUpperCase() || "U";
  const userSafeName =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "User";

  return (
    <div className={styles.portalContainer} data-theme={theme}>
      {/* DESKTOP/TABLET SIDEBAR NAVIGATION */}
      <aside
        className={styles.sidebar}
        data-print-hidden
        aria-label={isBn ? "প্রধান নেভিগেশন" : "Main Navigation"}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo} aria-hidden="true">
            {isBn ? "ধ্রু" : "Dh"}
          </div>
          <span className={styles.sidebarTitle}>
            {isBn ? "ধ্রুবক পোর্টাল" : "Dhrubok Portal"}
          </span>
        </div>

        <nav
          className={styles.navList}
          aria-label={isBn ? "পোর্টাল লিঙ্কসমূহ" : "Portal Links"}
        >
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupLabelEn} style={{ marginBottom: "8px" }}>
              <div
                className={styles.sidebarSectionHeader}
                style={
                  groupIdx === 0
                    ? { borderTop: "none", marginTop: 0, paddingTop: "8px" }
                    : undefined
                }
              >
                {isBn ? group.groupLabelBn : group.groupLabelEn}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.labelEn}
                    href={`/${locale}/${role}${item.path}`}
                    className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={styles.navIcon}>
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className={styles.navLabelContainer}>
                      <span className={styles.navLabelPrimary}>
                        {isBn ? item.labelBn : item.labelEn}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Owner Quick Actions Section */}
          {role === "owner" && (
            <>
              <div className={styles.sidebarSectionHeader}>
                {isBn ? "ত্বরিত কাজ (Actions)" : "Quick Actions"}
              </div>
              {ownerQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.labelEn}
                    href={`/${locale}/owner${action.path}`}
                    className={styles.navItem}
                  >
                    <span
                      className={styles.navIcon}
                      style={{ color: "var(--brand)" }}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className={styles.navLabelContainer}>
                      <span className={styles.navLabelPrimary}>
                        {isBn ? action.labelBn : action.labelEn}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <DevAccountSwitcher locale={locale} />
          <div className={styles.profileCard}>
            <div className={styles.avatar} aria-hidden="true">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className={styles.avatarImage}
                />
              ) : (
                userInitial
              )}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{userSafeName}</span>
              <span className={styles.profileRole}>
                {role === "owner"
                  ? isBn
                    ? "মালিক"
                    : "Owner"
                  : role === "teacher"
                    ? isBn
                      ? "শিক্ষক"
                      : "Teacher"
                    : isBn
                      ? "শিক্ষার্থী"
                      : "Student"}
              </span>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: `/${locale}/sign-in` })}
            className={styles.signOutButton}
            aria-label={isBn ? "লগ আউট" : "Sign out"}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{isBn ? "লগ আউট / Sign Out" : "Sign Out / লগ আউট"}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className={styles.mainContentWrapper} data-portal-content>
        {/* DESKTOP HEADER (Landmark banner) */}
        <header className={styles.pageHeader} data-print-hidden role="banner">
          <div className={styles.headerTitleArea}>
            <h1 className={styles.headerTitle}>{displayTitle}</h1>
            {displaySubtitle && (
              <p className={styles.headerMeta}>{displaySubtitle}</p>
            )}
          </div>
          <div className={styles.headerActions}>
            {actions}
            <button
              onClick={toggleTheme}
              className={styles.iconButton}
              aria-label={
                theme === "dark"
                  ? isBn
                    ? "লাইট মোড চালু করুন"
                    : "Use light mode"
                  : isBn
                    ? "ডার্ক মোড চালু করুন"
                    : "Use dark mode"
              }
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun aria-hidden="true" />
              ) : (
                <Moon aria-hidden="true" />
              )}
            </button>
            <button
              onClick={toggleLanguage}
              className={styles.langSwitchBtn}
              aria-label={isBn ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
            >
              <Languages className="w-4 h-4" aria-hidden="true" />
              <span>{isBn ? "English" : "বাংলা"}</span>
            </button>
          </div>
        </header>

        {/* MOBILE TOPBAR */}
        <header className={styles.mobileTopbar} data-print-hidden>
          <button
            ref={menuButtonRef}
            onClick={() => setDrawerOpen(true)}
            className={styles.mobileMenuBtn}
            aria-label={isBn ? "মেনু খুলুন" : "Open Menu"}
            aria-expanded={drawerOpen}
          >
            <Menu className="w-6 h-6" aria-hidden="true" />
          </button>
          <div className={styles.mobileBrand}>
            <div className={styles.mobileLogo} aria-hidden="true">
              {isBn ? "ধ্রু" : "Dh"}
            </div>
            <span className={styles.mobileTitle}>{displayTitle}</span>
          </div>
          <button
            onClick={toggleLanguage}
            className={styles.langSwitchBtn}
            aria-label={isBn ? "Switch to English" : "বাংলায় পরিবর্তন করুন"}
          >
            <span>{isBn ? "EN" : "বাংলা"}</span>
          </button>
          <button
            onClick={toggleTheme}
            className={styles.iconButton}
            aria-label={
              theme === "dark"
                ? isBn
                  ? "লাইট মোড চালু করুন"
                  : "Use light mode"
                : isBn
                  ? "ডার্ক মোড চালু করুন"
                  : "Use dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun aria-hidden="true" />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </button>
        </header>

        {/* ACCESSIBLE MAIN CONTENT (id matches skip link target) */}
        <main
          id="main-content"
          className={styles.pageContentArea}
          tabIndex={-1}
        >
          {children}
        </main>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav
          className={styles.mobileBottomNav}
          data-print-hidden
          aria-label={isBn ? "মোবাইল নেভিগেশন" : "Mobile Navigation"}
        >
          <ul className={styles.bottomNavList}>
            {bottomNavPrimary.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.path);
              return (
                <li key={item.labelEn} className={styles.bottomNavItem}>
                  <Link
                    href={`/${locale}/${role}${item.path}`}
                    className={`${styles.bottomNavLink} ${active ? styles.bottomNavLinkActive : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={styles.bottomNavIcon} aria-hidden="true" />
                    <span className={styles.bottomNavLabel}>
                      {isBn ? item.labelBn : item.labelEn}
                    </span>
                  </Link>
                </li>
              );
            })}
            {/* MORE BUTTON */}
            <li className={styles.bottomNavItem}>
              <button
                onClick={() => setDrawerOpen(true)}
                className={styles.bottomNavLink}
                aria-label={isBn ? "আরও মেনু" : "More Menu"}
                aria-expanded={drawerOpen}
              >
                <Menu className={styles.bottomNavIcon} aria-hidden="true" />
                <span className={styles.bottomNavLabel}>
                  {isBn ? "আরও / More" : "More / আরও"}
                </span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* ACCESSIBLE DRAWER (Mobile Slide-out) */}
      <div
        className={`${styles.drawerBackdrop} ${drawerOpen ? styles.drawerBackdropOpen : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        data-print-hidden
        ref={drawerRef}
        className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ""}`}
        role={drawerOpen ? "dialog" : undefined}
        aria-modal={drawerOpen ? "true" : undefined}
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        aria-label={isBn ? "নেভিগেশন মেনু" : "Navigation Menu"}
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>
            {isBn ? "মেনু" : "Navigation"}
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className={styles.drawerCloseBtn}
            aria-label={isBn ? "মেনু বন্ধ করুন" : "Close Menu"}
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        <nav
          className={styles.drawerContent}
          aria-label={isBn ? "মোবাইল মেনু লিঙ্কসমূহ" : "Mobile Menu Links"}
        >
          {navGroups.map((group, groupIdx) => (
            <div key={group.groupLabelEn} style={{ marginBottom: "8px" }}>
              <div
                className={styles.sidebarSectionHeader}
                style={
                  groupIdx === 0
                    ? { borderTop: "none", marginTop: 0, paddingTop: "8px" }
                    : undefined
                }
              >
                {isBn ? group.groupLabelBn : group.groupLabelEn}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.path);
                return (
                  <Link
                    key={item.labelEn}
                    href={`/${locale}/${role}${item.path}`}
                    className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className={styles.navIcon}>
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className={styles.navLabelContainer}>
                      <span className={styles.navLabelPrimary}>
                        {isBn ? item.labelBn : item.labelEn}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Mobile Drawer Owner Quick Actions */}
          {role === "owner" && (
            <>
              <div className={styles.sidebarSectionHeader}>
                {isBn ? "ত্বরিত কাজ (Actions)" : "Quick Actions"}
              </div>
              {ownerQuickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.labelEn}
                    href={`/${locale}/owner${action.path}`}
                    className={styles.navItem}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <span
                      className={styles.navIcon}
                      style={{ color: "var(--brand)" }}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div className={styles.navLabelContainer}>
                      <span className={styles.navLabelPrimary}>
                        {isBn ? action.labelBn : action.labelEn}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className={styles.drawerFooter}>
          <div className={styles.profileCard}>
            <div className={styles.avatar} aria-hidden="true">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className={styles.avatarImage}
                />
              ) : (
                userInitial
              )}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{userSafeName}</span>
              <span className={styles.profileRole}>
                {role === "owner"
                  ? isBn
                    ? "মালিক"
                    : "Owner"
                  : role === "teacher"
                    ? isBn
                      ? "শিক্ষক"
                      : "Teacher"
                    : isBn
                      ? "শিক্ষার্থী"
                      : "Student"}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setDrawerOpen(false);
              signOut({ redirectUrl: `/${locale}/sign-in` });
            }}
            className={styles.signOutButton}
            aria-label={isBn ? "লগ আউট" : "Sign out"}
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{isBn ? "লগ আউট / Sign Out" : "Sign Out / লগ আউট"}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
