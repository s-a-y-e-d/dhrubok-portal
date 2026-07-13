"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";
import { PaginationControls } from "./shared/PaginationControls";
import { TeacherRecordEditor } from "./record-editors/TeacherRecordEditor";

interface TeacherManagementProps {
  locale: "bn" | "en";
  selectedTeacherId: string | null;
  onSelectTeacherId: (id: string | null) => void;
}

export function TeacherManagement({
  locale,
  selectedTeacherId,
  onSelectTeacherId,
}: TeacherManagementProps) {
  const bn = locale === "bn";

  // Pagination cursors stack
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  const currentCursor = cursors[pageIndex];

  const teachersQuery = useQuery(api.academics.teachers.list, {
    status: "active",
    paginationOpts: { numItems: 20, cursor: currentCursor },
  });

  if (teachersQuery === undefined) {
    return <PortalPageState state="loading" locale={locale} />;
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
    onSelectTeacherId(null);
  };

  return (
    <div className="master-detail" style={{ marginTop: "16px" }}>
      {/* Left panel: Paginated list of active teachers */}
      <section>
        {teachersQuery.page.length === 0 ? (
          <p className="empty-panel">
            {bn ? "কোনো শিক্ষক পাওয়া যায়নি।" : "No teachers found."}
          </p>
        ) : (
          <div className="selection-list">
            {teachersQuery.page.map((row) => {
              const isSelected = selectedTeacherId === row._id;
              return (
                <button
                  key={row._id}
                  className={isSelected ? "selected" : ""}
                  onClick={() => onSelectTeacherId(isSelected ? null : row._id)}
                >
                  <strong style={{ fontSize: "14px" }}>
                    {row.displayName}
                  </strong>
                  <span style={{ fontSize: "11px", color: "var(--ink-mute)" }}>
                    {row.employeeCode} · {row.loginEmail}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <PaginationControls
          pageIndex={pageIndex}
          isDone={teachersQuery.isDone}
          continueCursor={teachersQuery.continueCursor}
          onNext={handleNextPage}
          onPrev={handlePrevPage}
          locale={locale}
        />
      </section>

      {/* Right panel: Editor */}
      <section>
        {selectedTeacherId ? (
          <div key={selectedTeacherId}>
            <TeacherRecordEditor
              locale={locale}
              teacherId={selectedTeacherId as Id<"teachers">}
              onArchiveSuccess={clearSelection}
            />
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
                ? "সম্পাদনা করার জন্য বাম পাশের তালিকা থেকে শিক্ষক নির্বাচন করুন।"
                : "Select a teacher from the list on the left to edit details."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
