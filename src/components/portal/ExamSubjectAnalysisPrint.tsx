"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "./PortalPageState";
import { ReportPrintFrame } from "./ReportPrintFrame";

export function ExamSubjectAnalysisPrint({
  locale,
  examId,
}: {
  locale: "bn" | "en";
  examId: string;
}) {
  const bn = locale === "bn";
  const rows = useQuery(api.reports.exams.subjectAnalysisV2, {
    examId: examId as Id<"exams">,
  });
  const header = useQuery(api.reports.exams.header, {
    examId: examId as Id<"exams">,
  });
  if (rows === undefined || header === undefined)
    return <PortalPageState state="loading" locale={locale} />;
  if (!rows)
    return (
      <PortalPageState
        state="empty"
        locale={locale}
        emptyTitle={
          bn ? "বিষয় বিশ্লেষণ পাওয়া যায়নি" : "Subject analysis unavailable"
        }
      />
    );
  const mark = (value: number | null) =>
    value === null ? "—" : (value / 100).toFixed(2);
  return (
    <ReportPrintFrame
      locale={locale}
      eyebrow={`${header.examNumber} · ${header.examDate}`}
      title={bn ? "বিষয় বিশ্লেষণ" : "Subject analysis"}
      subtitle={bn ? header.examNameBn : header.examNameEn}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{bn ? "বিষয়" : "Subject"}</th>
              <th>{bn ? "সর্বোচ্চ" : "Highest"}</th>
              <th>{bn ? "সর্বনিম্ন" : "Lowest"}</th>
              <th>{bn ? "গড়" : "Average"}</th>
              <th>{bn ? "পাস" : "Pass"}</th>
              <th>{bn ? "পাসের হার" : "Pass rate"}</th>
              <th>{bn ? "ফেল" : "Fail"}</th>
              <th>{bn ? "অনুপস্থিত" : "Absent"}</th>
              <th>{bn ? "স্কোর ব্যান্ড" : "Score bands"}</th>
              <th>{bn ? "ব্যাচ তুলনা" : "Batch comparison"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.subjectId}>
                <td>{bn ? row.nameBn : row.nameEn}</td>
                <td>{mark(row.highestScaled)}</td>
                <td>{mark(row.lowestScaled)}</td>
                <td>{mark(row.averageScaled)}</td>
                <td>{row.passCount}</td>
                <td>{row.passRate}%</td>
                <td>{row.failCount}</td>
                <td>{row.absentCount}</td>
                <td>
                  &lt;40: {row.scoreBands.below40} · 40–59:{" "}
                  {row.scoreBands.from40To59} · 60–79:{" "}
                  {row.scoreBands.from60To79} · 80–100:{" "}
                  {row.scoreBands.from80To100}
                </td>
                <td>
                  {row.batchComparison.map((batch) => (
                    <span key={batch.batchId} style={{ display: "block" }}>
                      {bn ? batch.nameBn : batch.nameEn}:{" "}
                      {mark(batch.averageScaled)} · {batch.passRate}%
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportPrintFrame>
  );
}
