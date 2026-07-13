"use client";

import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";
import { PaginationControls } from "./shared/PaginationControls";
import {
  SessionRecordEditor,
  CourseRecordEditor,
  BatchRecordEditor,
  SubjectRecordEditor,
} from "./record-editors";

interface AcademicRecordsProps {
  locale: "bn" | "en";
  subTab: "sessions" | "courses" | "batches" | "subjects";
  onSubTabChange: (
    tab: "sessions" | "courses" | "batches" | "subjects",
  ) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
}

export function AcademicRecords({
  locale,
  subTab,
  onSubTabChange,
  selectedId,
  onSelectId,
}: AcademicRecordsProps) {
  const bn = locale === "bn";

  // Scoped selections
  const [filterSessionId, setFilterSessionId] = useState<
    Id<"academicSessions"> | ""
  >("");
  const [filterCourseId, setFilterCourseId] = useState<Id<"courses"> | "">("");

  // Pagination cursor stacks
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  // Load baseline options for filters
  const workspaceOptions = useQuery(api.academics.options.ownerWorkspace, {});

  // Reset pagination when subTab or scoped filters change
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- external tab/filter props require resetting cursor state as one synchronization step */
    setCursors([null]);
    setPageIndex(0);
    onSelectId(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // onSelectId is an imperative parent reset callback; including unstable callback identities would re-run this reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, filterSessionId, filterCourseId]);

  const effectiveSessionId =
    filterSessionId || workspaceOptions?.sessions[0]?.sessionId || "";
  const effectiveCourseId =
    filterCourseId || workspaceOptions?.courses[0]?.courseId || "";

  const currentCursor = cursors[pageIndex];

  // Queries based on subTab
  const sessionsQuery = useQuery(
    api.academics.sessions.list,
    subTab === "sessions"
      ? {
          status: "active",
          paginationOpts: { numItems: 20, cursor: currentCursor },
        }
      : "skip",
  );

  const coursesQuery = useQuery(
    api.academics.courses.list,
    subTab === "courses" && effectiveSessionId
      ? {
          academicSessionId: effectiveSessionId,
          status: "active",
          paginationOpts: { numItems: 20, cursor: currentCursor },
        }
      : "skip",
  );

  const batchesQuery = useQuery(
    api.academics.batches.list,
    subTab === "batches" && effectiveCourseId
      ? {
          courseId: effectiveCourseId,
          status: "active",
          paginationOpts: { numItems: 20, cursor: currentCursor },
        }
      : "skip",
  );

  const subjectsQuery = useQuery(
    api.academics.subjects.list,
    subTab === "subjects"
      ? {
          status: "active",
          paginationOpts: { numItems: 20, cursor: currentCursor },
        }
      : "skip",
  );

  if (!workspaceOptions) {
    return <PortalPageState state="loading" locale={locale} />;
  }

  // Determine pagination helpers and page list
  type PageRecord = {
    _id: string;
    nameBn: string;
    nameEn: string;
    status: string;
    code?: string;
    startDate?: string;
    endDate?: string;
  };
  let pageList: PageRecord[] = [];
  let isDone = true;
  let continueCursor: string | null = null;
  let isLoadingData = false;

  if (subTab === "sessions") {
    isLoadingData = sessionsQuery === undefined;
    pageList = sessionsQuery?.page ?? [];
    isDone = sessionsQuery?.isDone ?? true;
    continueCursor = sessionsQuery?.continueCursor ?? null;
  } else if (subTab === "courses") {
    isLoadingData = coursesQuery === undefined;
    pageList = coursesQuery?.page ?? [];
    isDone = coursesQuery?.isDone ?? true;
    continueCursor = coursesQuery?.continueCursor ?? null;
  } else if (subTab === "batches") {
    isLoadingData = batchesQuery === undefined;
    pageList = batchesQuery?.page ?? [];
    isDone = batchesQuery?.isDone ?? true;
    continueCursor = batchesQuery?.continueCursor ?? null;
  } else if (subTab === "subjects") {
    isLoadingData = subjectsQuery === undefined;
    pageList = subjectsQuery?.page ?? [];
    isDone = subjectsQuery?.isDone ?? true;
    continueCursor = subjectsQuery?.continueCursor ?? null;
  }

  const handleNextPage = (nextCursor: string) => {
    setCursors((prev) => [...prev, nextCursor]);
    setPageIndex((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (pageIndex > 0) {
      setPageIndex((prev) => prev - 1);
    }
  };

  const clearSelection = () => {
    onSelectId(null);
  };

  return (
    <div>
      {/* Sub tabs list */}
      <div
        className="tab-list"
        role="tablist"
        aria-label={bn ? "রেকর্ড ফিল্টার" : "Filter records"}
      >
        {(["sessions", "courses", "batches", "subjects"] as const).map((t) => {
          const labels = {
            sessions: { bn: "সেশন", en: "Sessions" },
            courses: { bn: "কোর্স", en: "Courses" },
            batches: { bn: "ব্যাচ", en: "Batches" },
            subjects: { bn: "বিষয়", en: "Subjects" },
          };
          return (
            <button
              key={t}
              role="tab"
              aria-selected={subTab === t}
              onClick={() => onSubTabChange(t)}
            >
              {bn ? labels[t].bn : labels[t].en}
            </button>
          );
        })}
      </div>

      <div className="master-detail" style={{ marginTop: "16px" }}>
        {/* Left Side: Scoped filter & Selector list */}
        <section>
          {subTab === "courses" && (
            <div style={{ marginBottom: "16px" }}>
              <label className="standalone-field" style={{ width: "100%" }}>
                {bn ? "সেশন অনুযায়ী ফিল্টার করুন" : "Filter by session"}
                <select
                  value={filterSessionId}
                  onChange={(e) =>
                    setFilterSessionId(e.target.value as Id<"academicSessions">)
                  }
                >
                  <option value="">—</option>
                  {workspaceOptions.sessions.map((s) => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {bn ? s.nameBn : s.nameEn}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {subTab === "batches" && (
            <div style={{ marginBottom: "16px" }}>
              <label className="standalone-field" style={{ width: "100%" }}>
                {bn ? "কোর্স অনুযায়ী ফিল্টার করুন" : "Filter by course"}
                <select
                  value={filterCourseId}
                  onChange={(e) =>
                    setFilterCourseId(e.target.value as Id<"courses">)
                  }
                >
                  <option value="">—</option>
                  {workspaceOptions.courses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>
                      {bn ? c.nameBn : c.nameEn}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {isLoadingData ? (
            <div style={{ padding: "20px 0" }}>
              {bn ? "লোড হচ্ছে..." : "Loading..."}
            </div>
          ) : pageList.length === 0 ? (
            <p className="empty-panel">
              {bn ? "কোনো রেকর্ড পাওয়া যায়নি।" : "No records found."}
            </p>
          ) : (
            <div className="selection-list">
              {pageList.map((row) => {
                const isSelected = selectedId === row._id;
                let title = "";
                let code = "";

                if (subTab === "sessions") {
                  title = bn ? row.nameBn : row.nameEn;
                  code = `${row.startDate} ~ ${row.endDate}`;
                } else if (subTab === "courses") {
                  title = bn ? row.nameBn : row.nameEn;
                  code = row.code ?? "";
                } else if (subTab === "batches") {
                  title = bn ? row.nameBn : row.nameEn;
                  code = row.code ?? "";
                } else if (subTab === "subjects") {
                  title = bn ? row.nameBn : row.nameEn;
                  code = row.code ?? "";
                }

                return (
                  <button
                    key={row._id}
                    className={isSelected ? "selected" : ""}
                    onClick={() => onSelectId(isSelected ? null : row._id)}
                  >
                    <strong style={{ fontSize: "14px" }}>{title}</strong>
                    <span
                      style={{ fontSize: "11px", color: "var(--ink-mute)" }}
                    >
                      {code}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <PaginationControls
            pageIndex={pageIndex}
            isDone={isDone}
            continueCursor={continueCursor}
            onNext={handleNextPage}
            onPrev={handlePrevPage}
            locale={locale}
          />
        </section>

        {/* Right Side: Inline record editor */}
        <section>
          {selectedId ? (
            <div key={selectedId}>
              {subTab === "sessions" && (
                <SessionRecordEditor
                  locale={locale}
                  sessionId={selectedId as Id<"academicSessions">}
                  onArchiveSuccess={clearSelection}
                />
              )}
              {subTab === "courses" && (
                <CourseRecordEditor
                  locale={locale}
                  courseId={selectedId as Id<"courses">}
                  onArchiveSuccess={clearSelection}
                />
              )}
              {subTab === "batches" && (
                <BatchRecordEditor
                  locale={locale}
                  batchId={selectedId as Id<"batches">}
                  onArchiveSuccess={clearSelection}
                />
              )}
              {subTab === "subjects" && (
                <SubjectRecordEditor
                  locale={locale}
                  subjectId={selectedId as Id<"subjects">}
                  onArchiveSuccess={clearSelection}
                />
              )}
            </div>
          ) : (
            <div
              className="empty-panel"
              style={{
                display: "grid",
                placeItems: "center",
                height: "200px",
                textAlign: "center",
                alignContent: "center",
              }}
            >
              <p>
                {bn
                  ? "সম্পাদনা করার জন্য বাম পাশের তালিকা থেকে একটি রেকর্ড নির্বাচন করুন।"
                  : "Select a record from the list on the left to edit its details."}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
