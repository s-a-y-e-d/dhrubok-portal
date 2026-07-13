"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PortalPageState } from "../../PortalPageState";

type Draft = {
  participation: "present" | "absent";
  mcq: string;
  written: string;
};

export function MarksWorkspace({
  locale,
  assignmentId,
  allowSubmit = true,
}: {
  locale: "bn" | "en";
  assignmentId: Id<"examTeacherAssignments">;
  allowSubmit?: boolean;
}) {
  const bn = locale === "bn";
  const [filter, setFilter] = useState<
    "all" | "incomplete" | "absent" | "complete" | "invalid"
  >("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [mobileIndex, setMobileIndex] = useState(0);
  const [batchId, setBatchId] = useState<Id<"batches"> | "">("");
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const grid = useQuery(api.exams.marks.entryGrid, {
    assignmentId,
    filter: filter === "invalid" ? "all" : filter,
    search: search || undefined,
    batchId: batchId || undefined,
    paginationOpts: { numItems: 100, cursor: null },
  });
  const save = useMutation(api.exams.marks.saveDraft);
  const submit = useMutation(api.exams.marks.submitAssignment);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(drafts).length) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts]);
  useEffect(() => {
    if (!grid || !Object.keys(drafts).length) return;
    const timer = window.setTimeout(() => {
      const rows = Object.entries(drafts)
        .slice(0, 50)
        .flatMap(([id, current]) => {
          const row = grid.page.find((item) => item.result._id === id);
          return row
            ? [
                {
                  subjectResultId: row.result._id,
                  participation: current.participation,
                  mcqScoreScaled:
                    current.participation === "absent" || !current.mcq
                      ? undefined
                      : Math.round(Number(current.mcq) * 100),
                  writtenScoreScaled:
                    current.participation === "absent" || !current.written
                      ? undefined
                      : Math.round(Number(current.written) * 100),
                },
              ]
            : [];
        });
      if (rows.length)
        void save({ assignmentId, rows }).then((result) => {
          setRowErrors((current) => ({
            ...current,
            ...Object.fromEntries(
              result.errors.map((error) => [
                error.subjectResultId,
                error.message,
              ]),
            ),
          }));
          if (!result.errors.length) {
            setSavedAt(Date.now());
            const savedIds = new Set(rows.map((row) => row.subjectResultId));
            setDrafts((current) =>
              Object.fromEntries(
                Object.entries(current).filter(
                  ([id]) => !savedIds.has(id as Id<"examSubjectResults">),
                ),
              ),
            );
          }
        });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [assignmentId, drafts, grid, save]);
  if (!grid) return <PortalPageState state="loading" locale={locale} />;
  const loadedGrid = grid;
  function value(row: NonNullable<typeof grid>["page"][number]) {
    return (
      drafts[row.result._id] ?? {
        participation: row.result.participation,
        mcq:
          row.result.mcqScoreScaled === undefined
            ? ""
            : String(row.result.mcqScoreScaled / 100),
        written:
          row.result.writtenScoreScaled === undefined
            ? ""
            : String(row.result.writtenScoreScaled / 100),
      }
    );
  }
  function previewValue(current: Draft) {
    if (current.participation === "absent")
      return { total: "—", result: bn ? "অনুপস্থিত" : "Absent" };
    const subject = grid?.subject;
    if (!subject?.mode) return { total: "—", result: "—" };
    const mcq = current.mcq === "" ? undefined : Number(current.mcq);
    const written =
      current.written === "" ? undefined : Number(current.written);
    const invalid =
      (subject.mode !== "written" &&
        (mcq === undefined ||
          !Number.isFinite(mcq) ||
          mcq < 0 ||
          mcq * 100 > (subject.mcqFullMarksScaled ?? 0))) ||
      (subject.mode !== "mcq" &&
        (written === undefined ||
          !Number.isFinite(written) ||
          written < 0 ||
          written * 100 > (subject.writtenFullMarksScaled ?? 0)));
    if (invalid) return { total: "—", result: bn ? "অবৈধ" : "Invalid" };
    const totalScaled = Math.round(((mcq ?? 0) + (written ?? 0)) * 100);
    const passed =
      totalScaled >= (subject.passMarksScaled ?? 0) &&
      (subject.mcqPassMarksScaled === undefined ||
        (mcq ?? 0) * 100 >= subject.mcqPassMarksScaled) &&
      (subject.writtenPassMarksScaled === undefined ||
        (written ?? 0) * 100 >= subject.writtenPassMarksScaled);
    return {
      total: String(totalScaled / 100),
      result: passed ? (bn ? "পাস" : "Pass") : bn ? "ফেল" : "Fail",
    };
  }
  function patch(id: string, next: Partial<Draft>, current: Draft) {
    setRowErrors((errors) =>
      Object.fromEntries(
        Object.entries(errors).filter(([rowId]) => rowId !== id),
      ),
    );
    setDrafts((rows) => ({ ...rows, [id]: { ...current, ...next } }));
  }
  function changeParticipation(
    id: string,
    next: Draft["participation"],
    current: Draft,
  ) {
    if (
      next === "absent" &&
      (current.mcq || current.written) &&
      !window.confirm(
        bn
          ? "অনুপস্থিত করলে লেখা নম্বর মুছে যাবে। চালিয়ে যাবেন?"
          : "Marking absent will clear entered marks. Continue?",
      )
    )
      return;
    patch(
      id,
      {
        participation: next,
        ...(next === "absent" ? { mcq: "", written: "" } : {}),
      },
      current,
    );
  }
  async function saveRows() {
    setBusy(true);
    setMessage(null);
    try {
      const rows = loadedGrid.page.map((row) => {
        const current = value(row);
        return {
          subjectResultId: row.result._id,
          participation: current.participation,
          mcqScoreScaled:
            current.participation === "absent" || !current.mcq
              ? undefined
              : Math.round(Number(current.mcq) * 100),
          writtenScoreScaled:
            current.participation === "absent" || !current.written
              ? undefined
              : Math.round(Number(current.written) * 100),
        };
      });
      const errors = [];
      for (let index = 0; index < rows.length; index += 50) {
        const result = await save({
          assignmentId,
          rows: rows.slice(index, index + 50),
        });
        errors.push(...result.errors);
      }
      setRowErrors(
        Object.fromEntries(
          errors.map((error) => [error.subjectResultId, error.message]),
        ),
      );
      setMessage(
        errors.length
          ? errors.map((row) => row.message).join("; ")
          : bn
            ? "খসড়া সংরক্ষিত"
            : "Draft saved",
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  async function submitAll() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await submit({ assignmentId });
      setMessage(
        bn
          ? `${result.complete}টি ফল জমা হয়েছে`
          : `${result.complete} results submitted`,
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }
  function previewImport(text: string) {
    const next: Record<string, Draft> = {};
    const errors: string[] = [];
    text
      .trim()
      .split(/\r?\n/)
      .forEach((line, index) => {
        const [studentNumber, participation, mcq = "", written = ""] = line
          .split(line.includes("\t") ? "\t" : ",")
          .map((cell) => cell.trim());
        const row = loadedGrid.page.find(
          (item) => item.student.studentNumber === studentNumber,
        );
        if (!row) {
          errors.push(`Row ${index + 1}: unknown student ${studentNumber}`);
          return;
        }
        if (participation !== "present" && participation !== "absent") {
          errors.push(
            `Row ${index + 1}: participation must be present or absent`,
          );
          return;
        }
        if (
          participation === "present" &&
          ((!mcq && !written) ||
            [mcq, written].some(
              (value) => value && !Number.isFinite(Number(value)),
            ))
        ) {
          errors.push(`Row ${index + 1}: invalid marks`);
          return;
        }
        next[row.result._id] = {
          participation,
          mcq: participation === "absent" ? "" : mcq,
          written: participation === "absent" ? "" : written,
        };
      });
    if (errors.length) {
      setMessage(errors.join("; "));
      return;
    }
    setDrafts((current) => ({ ...current, ...next }));
    setMessage(
      bn
        ? `${Object.keys(next).length}টি সারি প্রিভিউতে যোগ হয়েছে`
        : `${Object.keys(next).length} rows added to the preview`,
    );
  }
  function moveGridFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(
        event.key,
      )
    )
      return;
    const target = event.target;
    if (!(
      target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ))
      return;
    const cells = [
      ...event.currentTarget.querySelectorAll<HTMLElement>("[data-mark-cell]"),
    ].filter((cell) => !(cell instanceof HTMLInputElement && cell.disabled));
    const index = cells.indexOf(target);
    if (index < 0) return;
    const columnCount = 3;
    const offset =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowUp"
          ? -columnCount
          : event.key === "ArrowDown"
            ? columnCount
            : 1;
    const next = cells[index + offset];
    if (!next) return;
    event.preventDefault();
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
  const visibleRows =
    filter === "invalid"
      ? grid.page.filter((row) => rowErrors[row.result._id])
      : grid.page;
  const mobileRow =
    visibleRows[Math.min(mobileIndex, Math.max(0, visibleRows.length - 1))];
  return (
    <section className="marks-workspace">
      <div className="marks-toolbar">
        <input
          aria-label={bn ? "শিক্ষার্থী খুঁজুন" : "Search students"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={bn ? "নাম বা আইডি" : "Name or ID"}
        />
        <select
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          <option value="all">{bn ? "সব" : "All"}</option>
          <option value="incomplete">{bn ? "অসম্পূর্ণ" : "Incomplete"}</option>
          <option value="absent">{bn ? "অনুপস্থিত" : "Absent"}</option>
          <option value="complete">{bn ? "সম্পূর্ণ" : "Complete"}</option>
          <option value="invalid">{bn ? "ত্রুটিযুক্ত" : "Invalid"}</option>
        </select>
        {grid.batches.length > 1 && (
          <select
            value={batchId}
            onChange={(event) => {
              setBatchId(event.target.value as Id<"batches"> | "");
              setMobileIndex(0);
            }}
            aria-label={bn ? "ব্যাচ" : "Batch"}
          >
            <option value="">{bn ? "সব ব্যাচ" : "All batches"}</option>
            {grid.batches.filter(Boolean).map((batch) => (
              <option key={batch!._id} value={batch!._id}>
                {bn ? batch!.nameBn : batch!.nameEn}
              </option>
            ))}
          </select>
        )}
        <span>
          {visibleRows.length} {bn ? "শিক্ষার্থী" : "students"}
        </span>
        <span>
          {savedAt
            ? `${bn ? "স্বয়ংক্রিয়ভাবে সংরক্ষিত" : "Autosaved"} ${new Intl.DateTimeFormat(bn ? "bn-BD" : "en-GB", { timeStyle: "short" }).format(savedAt)}`
            : bn
              ? "পরিবর্তন স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে"
              : "Changes will autosave"}
        </span>
        <label className="button button-ghost">
          {bn ? "CSV নিন" : "Import CSV"}
          <input
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file)
                void file.text().then((text) => {
                  setImportText(text);
                  previewImport(text);
                });
            }}
          />
        </label>
      </div>
      <details className="editor-disclosure">
        <summary>
          {bn ? "স্প্রেডশিট থেকে পেস্ট" : "Paste from spreadsheet"}
        </summary>
        <label>
          {bn
            ? "কলাম: শিক্ষার্থী আইডি, present/absent, MCQ, CQ"
            : "Columns: student ID, present/absent, MCQ, written"}
          <textarea
            rows={6}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
          />
        </label>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => previewImport(importText)}
        >
          {bn ? "সারি যাচাই ও প্রিভিউ" : "Validate rows and preview"}
        </button>
      </details>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      <div
        className="table-wrap marks-table marks-desktop"
        onKeyDown={moveGridFocus}
      >
        <table>
          <thead>
            <tr>
              <th>{bn ? "শিক্ষার্থী" : "Student"}</th>
              <th>{bn ? "অংশগ্রহণ" : "Participation"}</th>
              <th>MCQ</th>
              <th>CQ/Written</th>
              <th>{bn ? "মোট" : "Total"}</th>
              <th>{bn ? "অবস্থা" : "State"}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const current = value(row);
              const currentPreview = previewValue(current);
              return (
                <tr key={row.result._id}>
                  <th scope="row">
                    <strong>{row.student.displayName}</strong>
                    <small>{row.student.studentNumber}</small>
                  </th>
                  <td>
                    <select
                      data-mark-cell
                      aria-label={`${row.student.displayName} participation`}
                      value={current.participation}
                      onChange={(event) =>
                        changeParticipation(
                          row.result._id,
                          event.target.value as Draft["participation"],
                          current,
                        )
                      }
                    >
                      <option value="present">
                        {bn ? "উপস্থিত" : "Present"}
                      </option>
                      <option value="absent">
                        {bn ? "অনুপস্থিত" : "Absent"}
                      </option>
                    </select>
                  </td>
                  <td>
                    <input
                      data-mark-cell
                      aria-invalid={Boolean(rowErrors[row.result._id])}
                      aria-label={`${row.student.displayName} MCQ / ${(grid.subject?.mcqFullMarksScaled ?? 0) / 100}`}
                      inputMode="decimal"
                      disabled={current.participation === "absent"}
                      value={current.mcq}
                      onChange={(event) =>
                        patch(
                          row.result._id,
                          { mcq: event.target.value },
                          current,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      data-mark-cell
                      aria-invalid={Boolean(rowErrors[row.result._id])}
                      aria-label={`${row.student.displayName} written / ${(grid.subject?.writtenFullMarksScaled ?? 0) / 100}`}
                      inputMode="decimal"
                      disabled={current.participation === "absent"}
                      value={current.written}
                      onChange={(event) =>
                        patch(
                          row.result._id,
                          { written: event.target.value },
                          current,
                        )
                      }
                    />
                  </td>
                  <td>{currentPreview.total}</td>
                  <td>
                    <span className="status-pill queued">
                      {currentPreview.result} · {row.result.entryStatus}
                    </span>
                    {rowErrors[row.result._id] && (
                      <small className="cell-error" role="alert">
                        {rowErrors[row.result._id]}
                      </small>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {mobileRow &&
        (() => {
          const current = value(mobileRow);
          const currentPreview = previewValue(current);
          return (
            <article className="mobile-marks-card" aria-live="polite">
              <header>
                <div>
                  <strong>{mobileRow.student.displayName}</strong>
                  <small>{mobileRow.student.studentNumber}</small>
                </div>
                <span>
                  {mobileIndex + 1}/{visibleRows.length}
                </span>
              </header>
              <label>
                {bn ? "অংশগ্রহণ" : "Participation"}
                <select
                  aria-label={`${mobileRow.student.displayName} participation`}
                  value={current.participation}
                  onChange={(event) =>
                    changeParticipation(
                      mobileRow.result._id,
                      event.target.value as Draft["participation"],
                      current,
                    )
                  }
                >
                  <option value="present">{bn ? "উপস্থিত" : "Present"}</option>
                  <option value="absent">{bn ? "অনুপস্থিত" : "Absent"}</option>
                </select>
              </label>
              <p>
                {bn ? "মোট / ফল" : "Total / result"}:{" "}
                <strong>
                  {currentPreview.total} · {currentPreview.result}
                </strong>
              </p>
              <label>
                MCQ
                <input
                  aria-label={`${mobileRow.student.displayName} MCQ / ${(grid.subject?.mcqFullMarksScaled ?? 0) / 100}`}
                  aria-invalid={Boolean(rowErrors[mobileRow.result._id])}
                  inputMode="decimal"
                  disabled={current.participation === "absent"}
                  value={current.mcq}
                  onChange={(event) =>
                    patch(
                      mobileRow.result._id,
                      { mcq: event.target.value },
                      current,
                    )
                  }
                />
              </label>
              <label>
                CQ/Written
                <input
                  aria-label={`${mobileRow.student.displayName} written / ${(grid.subject?.writtenFullMarksScaled ?? 0) / 100}`}
                  aria-invalid={Boolean(rowErrors[mobileRow.result._id])}
                  inputMode="decimal"
                  disabled={current.participation === "absent"}
                  value={current.written}
                  onChange={(event) =>
                    patch(
                      mobileRow.result._id,
                      { written: event.target.value },
                      current,
                    )
                  }
                />
              </label>
              <footer>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={mobileIndex === 0}
                  onClick={() =>
                    setMobileIndex((index) => Math.max(0, index - 1))
                  }
                >
                  {bn ? "আগের" : "Previous"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={mobileIndex >= visibleRows.length - 1}
                  onClick={() =>
                    setMobileIndex((index) =>
                      Math.min(visibleRows.length - 1, index + 1),
                    )
                  }
                >
                  {bn ? "পরের" : "Next"}
                </button>
              </footer>
              {rowErrors[mobileRow.result._id] && (
                <p className="form-message error" role="alert">
                  {rowErrors[mobileRow.result._id]}
                </p>
              )}
            </article>
          );
        })()}
      <div className="form-actions exam-actions">
        <button
          className="button button-secondary"
          disabled={busy || !grid.page.length}
          onClick={() => void saveRows()}
        >
          {bn ? "খসড়া সংরক্ষণ" : "Save draft"}
        </button>
        {allowSubmit && (
          <button
            className="button button-primary"
            disabled={busy || grid.assignment.status === "submitted"}
            onClick={() => setSubmitConfirm(true)}
          >
            {bn ? "পর্যালোচনার জন্য জমা" : "Submit assignment for review"}
          </button>
        )}
      </div>
      {submitConfirm && (
        <section
          className="publication-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-assignment-title"
        >
          <h3 id="submit-assignment-title">
            {bn
              ? "অ্যাসাইনমেন্ট জমা নিশ্চিত করুন"
              : "Confirm assignment submission"}
          </h3>
          <p>
            {bn ? "সম্পূর্ণ" : "Complete"}: {grid.counts.complete} ·{" "}
            {bn ? "অনুপস্থিত" : "Absent"}: {grid.counts.absent} ·{" "}
            {bn ? "অসম্পূর্ণ" : "Missing"}: {grid.counts.missing} ·{" "}
            {bn ? "অবৈধ" : "Invalid"}: {grid.counts.invalid}
          </p>
          <div className="form-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setSubmitConfirm(false)}
            >
              {bn ? "বাতিল" : "Cancel"}
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={
                busy || grid.counts.missing > 0 || grid.counts.invalid > 0
              }
              onClick={() =>
                void submitAll().then(() => setSubmitConfirm(false))
              }
            >
              {bn ? "পর্যালোচনার জন্য জমা" : "Submit for review"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
