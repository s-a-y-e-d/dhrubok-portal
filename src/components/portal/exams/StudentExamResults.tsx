"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../PortalPageState";

export function StudentExamResults({ locale }: { locale: "bn" | "en" }) {
  const bn = locale === "bn";
  const list = useQuery(api.exams.studentResults.listMine, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const legacy = useQuery(api.exams.functions.myPublishedResults, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const [selected, setSelected] = useState<Id<"exams"> | null>(null);
  const latest = list?.page[0]?.result.examId ?? null;
  const active = selected ?? latest;
  const detail = useQuery(
    api.exams.studentResults.detailMine,
    active ? { examId: active } : "skip",
  );
  if (!list || !legacy)
    return <PortalPageState state="loading" locale={locale} />;
  if (!list.page.length && !legacy.page.length)
    return (
      <>
        <header className="portal-page-header">
          <p className="eyebrow">{bn ? "প্রকাশিত" : "Published"}</p>
          <h1>{bn ? "আমার ফলাফল" : "My results"}</h1>
        </header>
        <PortalPageState
          state="empty"
          locale={locale}
          emptyTitle={
            bn ? "এখনও কোনো ফল প্রকাশিত হয়নি" : "No results published yet"
          }
        />
      </>
    );
  return (
    <>
      <header className="portal-page-header">
        <p className="eyebrow">{bn ? "প্রকাশিত" : "Published"}</p>
        <h1>{bn ? "আমার ফলাফল" : "My results"}</h1>
      </header>
      {legacy.page.length > 0 && (
        <details className="editor-disclosure">
          <summary>
            {bn ? "পুরোনো প্রকাশিত ফল" : "Legacy published results"}
          </summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{bn ? "পরীক্ষা" : "Exam"}</th>
                  <th>{bn ? "নম্বর" : "Score"}</th>
                  <th>{bn ? "ফল" : "Outcome"}</th>
                  <th>{bn ? "মেধা" : "Merit"}</th>
                </tr>
              </thead>
              <tbody>
                {legacy.page.map((row) => (
                  <tr key={`${row.examId}:${row.publicationVersion}`}>
                    <td>
                      <Link
                        href={`/${locale}/student/results/${row.examId}/print`}
                      >
                        {bn ? row.nameBn : row.nameEn}
                      </Link>
                    </td>
                    <td>
                      {row.totalScoreScaled / 100} /{" "}
                      {row.totalFullMarksScaled / 100}
                    </td>
                    <td>
                      {row.passed ? (bn ? "পাস" : "Pass") : bn ? "ফেল" : "Fail"}
                    </td>
                    <td>{row.meritPosition ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {!list.page.length ? null : (
        <div className="master-detail">
          <section className="selection-list">
            {list.page.map(({ result, exam }) => (
              <button
                key={`${result.examId}:${result.version}`}
                className={active === result.examId ? "selected" : ""}
                onClick={() => setSelected(result.examId)}
              >
                <strong>{exam ? (bn ? exam.nameBn : exam.nameEn) : "—"}</strong>
                <span>
                  {result.passed
                    ? bn
                      ? "উত্তীর্ণ"
                      : "Passed"
                    : bn
                      ? "অনুত্তীর্ণ"
                      : "Failed"}{" "}
                  · {result.grandTotalScaled / 100}/
                  {result.grandFullMarksScaled / 100} · v{result.version}
                </span>
              </button>
            ))}
          </section>
          <section>
            {detail === undefined ? (
              <PortalPageState state="loading" locale={locale} />
            ) : detail ? (
              <>
                <div className="detail-title">
                  <div>
                    <p className="eyebrow">
                      {detail.exam.examNumber} · {detail.exam.examDate}
                    </p>
                    <h2>{bn ? detail.exam.nameBn : detail.exam.nameEn}</h2>
                  </div>
                  <span
                    className={`status-pill ${detail.result.passed ? "sent" : "failed"}`}
                  >
                    {detail.result.passed
                      ? bn
                        ? "উত্তীর্ণ"
                        : "Pass"
                      : bn
                        ? "অনুত্তীর্ণ"
                        : "Fail"}
                  </span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>{bn ? "মোট" : "Grand total"}</dt>
                    <dd>
                      {detail.result.grandTotalScaled / 100} /{" "}
                      {detail.result.grandFullMarksScaled / 100}
                    </dd>
                  </div>
                  <div>
                    <dt>{bn ? "সরকারি মেধা" : "Official merit"}</dt>
                    <dd>
                      {detail.result.officialMeritPosition
                        ? `${detail.result.officialMeritPosition}/${detail.result.officialMeritPopulation}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{bn ? "ব্যাচ মেধা" : "Batch merit"}</dt>
                    <dd>
                      {detail.result.batchMeritPosition
                        ? `${detail.result.batchMeritPosition}/${detail.result.batchMeritPopulation}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>{bn ? "সংস্করণ" : "Version"}</dt>
                    <dd>
                      v{detail.result.version}
                      {detail.result.version > 1
                        ? bn
                          ? " · সংশোধিত"
                          : " · Corrected"
                        : ""}
                    </dd>
                  </div>
                </dl>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{bn ? "বিষয়" : "Subject"}</th>
                        <th>CQ/Written</th>
                        <th>MCQ</th>
                        <th>{bn ? "মোট" : "Total"}</th>
                        <th>{bn ? "ফল" : "Outcome"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.subjects.map((row) => (
                        <tr key={row._id}>
                          <td>{bn ? row.subjectNameBn : row.subjectNameEn}</td>
                          <td>
                            {row.writtenScoreScaled === undefined
                              ? "—"
                              : row.writtenScoreScaled / 100}
                          </td>
                          <td>
                            {row.mcqScoreScaled === undefined
                              ? "—"
                              : row.mcqScoreScaled / 100}
                          </td>
                          <td>
                            {row.totalScoreScaled / 100} /{" "}
                            {row.totalFullMarksScaled / 100}
                          </td>
                          <td>
                            {row.passed
                              ? bn
                                ? "পাস"
                                : "Pass"
                              : bn
                                ? "ফেল"
                                : "Fail"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Link
                  className="button button-secondary"
                  href={`/${locale}/student/results/${detail.exam._id}/print`}
                >
                  {bn ? "ফল প্রিন্ট করুন" : "Print result"}
                </Link>
              </>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
