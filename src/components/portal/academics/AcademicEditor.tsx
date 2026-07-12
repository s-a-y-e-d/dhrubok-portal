"use client";

import { useQuery } from "convex/react";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { PortalPageState } from "../PortalPageState";
import { AcademicOperations } from "./AcademicOperations";
import { AcademicRecords } from "./AcademicRecords";
import { TeacherManagement } from "./TeacherManagement";
import { AcademicRecordCreator } from "./AcademicRecordCreator";
import { QueryErrorBoundary } from "./shared/QueryErrorBoundary";

type TabType = "operations" | "records" | "teachers" | "create";
type SubTabType = "sessions" | "courses" | "batches" | "subjects";

export function AcademicEditor({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const router = useRouter();

  // 1. Initial State from URL Search Params
  const [tab, setTab] = useState<TabType>("operations");
  const [subTab, setSubTab] = useState<SubTabType>("sessions");

  // Selection states
  const [batchId, setBatchId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  // Tab button refs for keyboard navigation
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 2. Synchronize URL search params with state on load/popstate
  useEffect(() => {
    const handleUrlSync = () => {
      const params = new URLSearchParams(window.location.search);
      setTab((params.get("tab") as TabType) || "operations");
      setSubTab((params.get("subtab") as SubTabType) || "sessions");
      setBatchId(params.get("batchId"));
      setCourseId(params.get("courseId"));
      setTeacherId(params.get("teacherId"));
      setSessionId(params.get("sessionId"));
      setSubjectId(params.get("subjectId"));
    };

    handleUrlSync();
    window.addEventListener("popstate", handleUrlSync);
    return () => window.removeEventListener("popstate", handleUrlSync);
  }, []);

  // Helper to push state changes to URL
  const updateUrlParams = (newParams: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    window.history.pushState(null, "", url.pathname + url.search);
  };

  const handleTabChange = (newTab: TabType) => {
    setTab(newTab);
    updateUrlParams({ tab: newTab });
  };

  const handleSubTabChange = (newSubTab: SubTabType) => {
    setSubTab(newSubTab);
    updateUrlParams({
      subtab: newSubTab,
      sessionId: null,
      courseId: null,
      batchId: null,
      subjectId: null,
    });
    setSessionId(null);
    setCourseId(null);
    setBatchId(null);
    setSubjectId(null);
  };

  // Keyboard navigation on tabs list
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const tabsList: TabType[] = ["operations", "records", "teachers", "create"];
    let newIndex = index;

    if (e.key === "ArrowRight") {
      newIndex = (index + 1) % tabsList.length;
    } else if (e.key === "ArrowLeft") {
      newIndex = (index - 1 + tabsList.length) % tabsList.length;
    } else if (e.key === "Home") {
      newIndex = 0;
    } else if (e.key === "End") {
      newIndex = tabsList.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    tabRefs.current[newIndex]?.focus();
    handleTabChange(tabsList[newIndex]);
  };

  // Record creation redirect handler
  const handleCreationSuccess = (
    type: "sessions" | "courses" | "batches" | "subjects" | "teachers",
    id: string
  ) => {
    if (type === "teachers") {
      setTab("teachers");
      setTeacherId(id);
      updateUrlParams({ tab: "teachers", teacherId: id });
    } else {
      setTab("records");
      setSubTab(type);
      if (type === "sessions") {
        setSessionId(id);
        updateUrlParams({ tab: "records", subtab: "sessions", sessionId: id });
      } else if (type === "courses") {
        setCourseId(id);
        updateUrlParams({ tab: "records", subtab: "courses", courseId: id });
      } else if (type === "batches") {
        setBatchId(id);
        updateUrlParams({ tab: "records", subtab: "batches", batchId: id });
      } else if (type === "subjects") {
        setSubjectId(id);
        updateUrlParams({ tab: "records", subtab: "subjects", subjectId: id });
      }
    }
  };

  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "একাডেমিক সেটআপ ও অপারেশনস" : "Academic Setup & Operations"}</p>
        <h1>{bn ? "একাডেমিক পোর্টাল" : "Academic Portal"}</h1>
        <p>
          {bn
            ? "সেশন, কোর্স, ব্যাচ, বিষয় এবং শিক্ষকদের রুটিন ও ক্লাস পরিচালনা করুন।"
            : "Manage academic sessions, courses, batches, subjects, teacher assignments, and routines."}
        </p>
      </header>

      {/* Tab bar list */}
      <div className="tab-list" role="tablist" aria-label={bn ? "একাডেমিক ট্যাব" : "Academic tabs"}>
        {(["operations", "records", "teachers", "create"] as const).map((t, idx) => {
          const labels = {
            operations: { bn: "অপারেশনস (রুটিন ও ক্লাস)", en: "Operations (Routines & Classes)" },
            records: { bn: "কোর্স ও ব্যাচ", en: "Courses & Batches" },
            teachers: { bn: "শিক্ষক তালিকা", en: "Teachers Directory" },
            create: { bn: "নতুন তৈরি করুন", en: "Create New" },
          };

          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              role="tab"
              aria-selected={tab === t}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => handleTabChange(t)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
            >
              {bn ? labels[t].bn : labels[t].en}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "20px" }}>
        {tab === "operations" && (
          <AcademicOperations
            locale={locale}
            selectedBatchId={batchId}
            onSelectBatchId={(id) => {
              setBatchId(id);
              updateUrlParams({ batchId: id });
            }}
          />
        )}

        {tab === "records" && (
          <AcademicRecords
            locale={locale}
            subTab={subTab}
            onSubTabChange={handleSubTabChange}
            selectedId={
              subTab === "sessions"
                ? sessionId
                : subTab === "courses"
                  ? courseId
                  : subTab === "batches"
                    ? batchId
                    : subjectId
            }
            onSelectId={(id) => {
              if (subTab === "sessions") {
                setSessionId(id);
                updateUrlParams({ sessionId: id });
              } else if (subTab === "courses") {
                setCourseId(id);
                updateUrlParams({ courseId: id });
              } else if (subTab === "batches") {
                setBatchId(id);
                updateUrlParams({ batchId: id });
              } else if (subTab === "subjects") {
                setSubjectId(id);
                updateUrlParams({ subjectId: id });
              }
            }}
          />
        )}

        {tab === "teachers" && (
          <TeacherManagement
            locale={locale}
            selectedTeacherId={teacherId}
            onSelectTeacherId={(id) => {
              setTeacherId(id);
              updateUrlParams({ teacherId: id });
            }}
          />
        )}

        {tab === "create" && (
          <AcademicRecordCreator locale={locale} onCreationSuccess={handleCreationSuccess} />
        )}
      </div>
    </>
  );
}
