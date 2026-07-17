import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { enqueueSms } from "../messaging/model";
import { estimateSmsSegments } from "../messaging/templates";
import { requireOwner } from "../model/auth";
import { normalizeBangladeshPhone } from "../model/normalization";
import {
  aggregateExamResult,
  competitionMeritRanks,
  formatScaledMark,
} from "./model";

function meritLabel(
  scope: "batch" | "selected_batches" | "course" | "none",
  locale: "bn" | "en",
) {
  if (locale === "bn")
    return scope === "batch"
      ? "ব্যাচ মেধাস্থান"
      : scope === "selected_batches"
        ? "নির্বাচিত ব্যাচসমূহে মেধাস্থান"
        : scope === "course"
          ? "কোর্স মেধাস্থান"
          : "";
  return scope === "batch"
    ? "Batch merit"
    : scope === "selected_batches"
      ? "Selected-batches merit"
      : scope === "course"
        ? "Course merit"
        : "";
}
function message(input: {
  locale: "bn" | "en";
  correction: boolean;
  examName: string;
  studentName: string;
  total: number;
  full: number;
  passed: boolean;
  scope: "batch" | "selected_batches" | "course" | "none";
  position?: number;
  population?: number;
  batchPosition?: number;
  batchPopulation?: number;
}) {
  const score = `${formatScaledMark(input.total)}/${formatScaledMark(input.full)}`;
  const official = input.position
    ? `${meritLabel(input.scope, input.locale)}: ${input.position}/${input.population}`
    : "";
  const batch = input.batchPosition
    ? `${input.locale === "bn" ? "ব্যাচ মেধাস্থান" : "Batch merit"}: ${input.batchPosition}/${input.batchPopulation}`
    : "";
  return input.locale === "bn"
    ? `${input.correction ? "সংশোধিত ফলাফল" : "ফলাফল"}: ${input.examName} পরীক্ষায় ${input.studentName}-এর নম্বর ${score}। ${input.passed ? "উত্তীর্ণ" : "অনুত্তীর্ণ"}। ${[official, batch].filter(Boolean).join("। ")}`.trim()
    : `${input.correction ? "Corrected result" : "Result"}: ${input.studentName} scored ${score} in ${input.examName}. ${input.passed ? "Passed" : "Failed"}. ${[official, batch].filter(Boolean).join(". ")}`.trim();
}

async function build(
  ctx: Parameters<typeof requireOwner>[0],
  examId: Id<"exams">,
) {
  const exam = await ctx.db.get("exams", examId);
  if (!exam || (exam.modelVersion !== 2 && exam.modelVersion !== 3))
    throw new Error("New-model exam not found");
  const settings = (await ctx.db.query("coachingSettings").take(1))[0];
  const candidates = await ctx.db
    .query("examCandidates")
    .withIndex("by_examId_and_status", (q) =>
      q.eq("examId", examId).eq("status", "included"),
    )
    .take(501);
  const subjects = await ctx.db
    .query("examSubjects")
    .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", examId))
    .take(100);
  const subjectResults = await ctx.db
    .query("examSubjectResults")
    .withIndex("by_examId_and_studentId", (q) => q.eq("examId", examId))
    .take(10001);
  if (
    !candidates.length ||
    subjectResults.length !== candidates.length * subjects.length ||
    subjectResults.some(
      (row) =>
        row.entryStatus !== "submitted" ||
        row.totalScoreScaled === undefined ||
        row.passed === undefined,
    )
  )
    throw new Error("Cannot publish incomplete results");
  const aggregates = candidates.map((candidate) => {
    const rows = subjectResults.filter(
      (row) => row.candidateId === candidate._id,
    );
    const aggregate = aggregateExamResult(
      rows.map((row) => {
        const subject = subjects.find(
          (item) => item._id === row.examSubjectId,
        )!;
        return {
          isRequired: subject.isRequired ?? true,
          participation: row.participation,
          totalScoreScaled: row.totalScoreScaled!,
          totalFullMarksScaled: subject.totalFullMarksScaled!,
          writtenScoreScaled: row.writtenScoreScaled,
          mcqScoreScaled: row.mcqScoreScaled,
          passed: row.passed!,
        };
      }),
    );
    return { candidate, rows, ...aggregate };
  });
  const eligible = aggregates.filter(
    (row) => (exam.rankFailedStudents || row.passed) && !row.absent,
  );
  const officialRanks =
    exam.meritMode === "none"
      ? new Map<string, number>()
      : competitionMeritRanks(
          eligible.map((row) => ({
            key: row.candidate._id,
            totalScoreScaled: row.grandTotalScaled,
            writtenTotalScaled: row.writtenTotalScaled,
            mcqTotalScaled: row.mcqTotalScaled,
          })),
        );
  const batchRanks = new Map<string, Map<string, number>>();
  if (exam.meritMode === "official_and_batch")
    for (const batchId of new Set(
      eligible.map((row) => row.candidate.batchId),
    )) {
      const group = eligible.filter((row) => row.candidate.batchId === batchId);
      batchRanks.set(
        batchId,
        competitionMeritRanks(
          group.map((row) => ({
            key: row.candidate._id,
            totalScoreScaled: row.grandTotalScaled,
            writtenTotalScaled: row.writtenTotalScaled,
            mcqTotalScaled: row.mcqTotalScaled,
          })),
        ),
      );
    }
  return {
    exam,
    candidates,
    subjects,
    subjectResults,
    aggregates,
    eligible,
    officialRanks,
    batchRanks,
    settings,
  };
}

export const preview = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const data = await build(ctx, args.examId);
    const recipients = new Set<string>();
    const invalid = [];
    for (const aggregate of data.aggregates) {
      const student = await ctx.db.get(
        "students",
        aggregate.candidate.studentId,
      );
      if (!student) continue;
      const phones =
        student.smsRecipient === "mother"
          ? [student.motherPhone]
          : student.smsRecipient === "both"
            ? [student.guardianPhone, student.motherPhone]
            : [student.guardianPhone];
      for (const phone of phones) {
        if (!phone) {
          invalid.push({ studentId: student._id, reason: "missing" });
          continue;
        }
        try {
          recipients.add(`${student._id}:${normalizeBangladeshPhone(phone)}`);
        } catch {
          invalid.push({ studentId: student._id, reason: "invalid" });
        }
      }
    }
    const sample = data.aggregates[0];
    const sampleStudent = sample
      ? await ctx.db.get("students", sample.candidate.studentId)
      : null;
    const sampleBn = sample
      ? `${data.settings?.shortNameBn ?? data.settings?.nameBn ?? "Dhrubok"}: ${message(
          {
            locale: "bn",
            correction: data.exam.publicationVersion > 0,
            examName: data.exam.nameBn,
            studentName: sampleStudent?.displayName ?? "",
            total: sample.grandTotalScaled,
            full: sample.grandFullMarksScaled,
            passed: sample.passed,
            scope: data.exam.officialMeritScope ?? "none",
            position: data.officialRanks.get(sample.candidate._id),
            population: data.eligible.length,
          },
        )}`
      : "";
    const sampleEn = sample
      ? `${data.settings?.shortNameEn ?? data.settings?.nameEn ?? "Dhrubok"}: ${message(
          {
            locale: "en",
            correction: data.exam.publicationVersion > 0,
            examName: data.exam.nameEn,
            studentName: sampleStudent?.displayName ?? "",
            total: sample.grandTotalScaled,
            full: sample.grandFullMarksScaled,
            passed: sample.passed,
            scope: data.exam.officialMeritScope ?? "none",
            position: data.officialRanks.get(sample.candidate._id),
            population: data.eligible.length,
          },
        )}`
      : "";
    return {
      publicationVersion: data.exam.publicationVersion + 1,
      candidateCount: data.aggregates.length,
      passCount: data.aggregates.filter((row) => row.passed).length,
      failCount: data.aggregates.filter((row) => !row.passed).length,
      absentCount: data.aggregates.filter((row) => row.absent).length,
      officialMeritScope: data.exam.officialMeritScope,
      officialPopulation: data.eligible.length,
      recipientCount: recipients.size,
      skippedContacts: invalid,
      sampleBn,
      sampleEn,
      estimatedSegmentsBn: estimateSmsSegments(sampleBn).segmentCount,
      estimatedSegmentsEn: estimateSmsSegments(sampleEn).segmentCount,
    };
  },
});

export const publish = mutation({
  args: { examId: v.id("exams"), acknowledged: v.boolean() },
  returns: v.object({
    publicationVersion: v.number(),
    resultCount: v.number(),
    recipientCount: v.number(),
    processing: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (!args.acknowledged)
      throw new Error("Publication acknowledgement is required");
    const data = await build(ctx, args.examId);
    if (data.exam.status !== "ready_for_review")
      throw new Error("Exam is not ready for publication");
    const now = Date.now();
    const version = data.exam.publicationVersion + 1;
    const previous = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", data.exam._id).eq("status", "published"),
      )
      .take(10);
    const publicationId = await ctx.db.insert("examPublications", {
      examId: data.exam._id,
      version,
      status: "processing",
      candidateCount: data.aggregates.length,
      passCount: data.aggregates.filter((row) => row.passed).length,
      failCount: data.aggregates.filter((row) => !row.passed).length,
      absentCount: data.aggregates.filter((row) => row.absent).length,
      officialMeritScope: data.exam.officialMeritScope ?? "none",
      meritMode: data.exam.meritMode ?? "none",
      officialPopulation: data.eligible.length,
      rankFailedStudents: data.exam.rankFailedStudents ?? false,
      publishedAt: now,
      publishedByAccountId: account._id,
    });
    if (data.subjectResults.length > 1000) {
      const recipients = new Set<string>();
      for (const aggregate of data.aggregates) {
        const student = await ctx.db.get(
          "students",
          aggregate.candidate.studentId,
        );
        if (!student) continue;
        const phones =
          student.smsRecipient === "mother"
            ? [student.motherPhone]
            : student.smsRecipient === "both"
              ? [student.guardianPhone, student.motherPhone]
              : [student.guardianPhone];
        for (const phone of phones) {
          if (!phone) continue;
          try {
            recipients.add(`${student._id}:${normalizeBangladeshPhone(phone)}`);
          } catch {
            /* preview reports skipped contacts */
          }
        }
      }
      await ctx.db.patch("exams", data.exam._id, {
        status: "publication_processing",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.exams.publication.publishBatch, {
        publicationId,
        offset: 0,
      });
      await ctx.db.insert("examAuditEvents", {
        examId: data.exam._id,
        eventType: "publication_processing_started",
        publicationVersion: version,
        actorAccountId: account._id,
        createdAt: now,
      });
      return {
        publicationVersion: version,
        resultCount: data.aggregates.length,
        recipientCount: recipients.size,
        processing: true,
      };
    }
    for (const row of previous)
      await ctx.db.patch("examPublications", row._id, { status: "superseded" });
    let recipientCount = 0;
    for (const aggregate of data.aggregates) {
      const position = data.officialRanks.get(aggregate.candidate._id);
      const batchGroup = data.eligible.filter(
        (row) => row.candidate.batchId === aggregate.candidate.batchId,
      );
      const batchPosition = data.batchRanks
        .get(aggregate.candidate.batchId)
        ?.get(aggregate.candidate._id);
      const publishedResultId = await ctx.db.insert("examPublishedResults", {
        publicationId,
        examId: data.exam._id,
        version,
        candidateId: aggregate.candidate._id,
        studentId: aggregate.candidate.studentId,
        batchId: aggregate.candidate.batchId,
        grandTotalScaled: aggregate.grandTotalScaled,
        grandFullMarksScaled: aggregate.grandFullMarksScaled,
        writtenTotalScaled: aggregate.writtenTotalScaled,
        mcqTotalScaled: aggregate.mcqTotalScaled,
        passed: aggregate.passed,
        absent: aggregate.absent,
        officialMeritPosition: position,
        officialMeritPopulation: position ? data.eligible.length : undefined,
        batchMeritPosition: batchPosition,
        batchMeritPopulation: batchPosition ? batchGroup.length : undefined,
        publishedAt: now,
      });
      for (const row of aggregate.rows) {
        const subject = data.subjects.find(
          (item) => item._id === row.examSubjectId,
        )!;
        const subjectDoc = await ctx.db.get("subjects", subject.subjectId);
        await ctx.db.insert("examPublishedSubjectResults", {
          publicationId,
          publishedResultId,
          examId: data.exam._id,
          version,
          studentId: aggregate.candidate.studentId,
          subjectId: subject.subjectId,
          subjectNameBn: subjectDoc?.nameBn ?? "",
          subjectNameEn: subjectDoc?.nameEn ?? "",
          sortOrder: subject.sortOrder,
          mode: subject.mode!,
          participation: row.participation,
          mcqScoreScaled: row.mcqScoreScaled,
          writtenScoreScaled: row.writtenScoreScaled,
          totalScoreScaled: row.totalScoreScaled!,
          totalFullMarksScaled: subject.totalFullMarksScaled!,
          passed: row.passed!,
          teacherCommentBn: row.teacherCommentBn,
          teacherCommentEn: row.teacherCommentEn,
        });
      }
      const student = await ctx.db.get(
        "students",
        aggregate.candidate.studentId,
      );
      if (!student) continue;
      const body = `${student.preferredSmsLocale === "bn" ? (data.settings?.shortNameBn ?? data.settings?.nameBn ?? "Dhrubok") : (data.settings?.shortNameEn ?? data.settings?.nameEn ?? "Dhrubok")}: ${message(
        {
          locale: student.preferredSmsLocale,
          correction: version > 1,
          examName:
            student.preferredSmsLocale === "bn"
              ? data.exam.nameBn
              : data.exam.nameEn,
          studentName: student.displayName,
          total: aggregate.grandTotalScaled,
          full: aggregate.grandFullMarksScaled,
          passed: aggregate.passed,
          scope: data.exam.officialMeritScope ?? "none",
          position,
          population: data.eligible.length,
          batchPosition,
          batchPopulation: batchGroup.length,
        },
      )}`;
      const ids = await enqueueSms(ctx, {
        idempotencyKey: `exam:${data.exam._id}:v${version}:${student._id}`,
        eventType: version > 1 ? "result_corrected" : "result_published",
        relatedEntityType: "exam",
        relatedEntityId: data.exam._id,
        studentId: student._id,
        guardianPhone: student.guardianPhone,
        locale: student.preferredSmsLocale,
        body,
      });
      recipientCount += ids.length;
    }
    await ctx.db.patch("examPublications", publicationId, {
      status: "published",
      recipientCount,
    });
    await ctx.db.patch("exams", data.exam._id, {
      status: "published",
      publicationVersion: version,
      publishedAt: now,
      publishedByAccountId: account._id,
      updatedAt: now,
    });
    await ctx.db.insert("examAuditEvents", {
      examId: data.exam._id,
      eventType: version > 1 ? "results_republished" : "results_published",
      publicationVersion: version,
      actorAccountId: account._id,
      createdAt: now,
    });
    return {
      publicationVersion: version,
      resultCount: data.aggregates.length,
      recipientCount,
      processing: false,
    };
  },
});

export const publishBatch = internalMutation({
  args: { publicationId: v.id("examPublications"), offset: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const publication = await ctx.db.get(
      "examPublications",
      args.publicationId,
    );
    if (!publication || publication.status !== "processing") return null;
    const data = await build(ctx, publication.examId);
    if (data.exam.status !== "publication_processing") return null;
    const end = Math.min(data.aggregates.length, args.offset + 20);
    const now = publication.publishedAt;
    let recipientCount = publication.recipientCount ?? 0;
    for (const aggregate of data.aggregates.slice(args.offset, end)) {
      const existing = await ctx.db
        .query("examPublishedResults")
        .withIndex("by_publicationId_and_studentId", (q) =>
          q
            .eq("publicationId", publication._id)
            .eq("studentId", aggregate.candidate.studentId),
        )
        .unique();
      if (existing) continue;
      const position = data.officialRanks.get(aggregate.candidate._id);
      const batchGroup = data.eligible.filter(
        (row) => row.candidate.batchId === aggregate.candidate.batchId,
      );
      const batchPosition = data.batchRanks
        .get(aggregate.candidate.batchId)
        ?.get(aggregate.candidate._id);
      const publishedResultId = await ctx.db.insert("examPublishedResults", {
        publicationId: publication._id,
        examId: data.exam._id,
        version: publication.version,
        candidateId: aggregate.candidate._id,
        studentId: aggregate.candidate.studentId,
        batchId: aggregate.candidate.batchId,
        grandTotalScaled: aggregate.grandTotalScaled,
        grandFullMarksScaled: aggregate.grandFullMarksScaled,
        writtenTotalScaled: aggregate.writtenTotalScaled,
        mcqTotalScaled: aggregate.mcqTotalScaled,
        passed: aggregate.passed,
        absent: aggregate.absent,
        officialMeritPosition: position,
        officialMeritPopulation: position ? data.eligible.length : undefined,
        batchMeritPosition: batchPosition,
        batchMeritPopulation: batchPosition ? batchGroup.length : undefined,
        publishedAt: now,
      });
      for (const row of aggregate.rows) {
        const subject = data.subjects.find(
          (item) => item._id === row.examSubjectId,
        )!;
        const subjectDoc = await ctx.db.get("subjects", subject.subjectId);
        await ctx.db.insert("examPublishedSubjectResults", {
          publicationId: publication._id,
          publishedResultId,
          examId: data.exam._id,
          version: publication.version,
          studentId: aggregate.candidate.studentId,
          subjectId: subject.subjectId,
          subjectNameBn: subjectDoc?.nameBn ?? "",
          subjectNameEn: subjectDoc?.nameEn ?? "",
          sortOrder: subject.sortOrder,
          mode: subject.mode!,
          participation: row.participation,
          mcqScoreScaled: row.mcqScoreScaled,
          writtenScoreScaled: row.writtenScoreScaled,
          totalScoreScaled: row.totalScoreScaled!,
          totalFullMarksScaled: subject.totalFullMarksScaled!,
          passed: row.passed!,
          teacherCommentBn: row.teacherCommentBn,
          teacherCommentEn: row.teacherCommentEn,
        });
      }
      const student = await ctx.db.get(
        "students",
        aggregate.candidate.studentId,
      );
      if (!student) continue;
      const body = `${student.preferredSmsLocale === "bn" ? (data.settings?.shortNameBn ?? data.settings?.nameBn ?? "Dhrubok") : (data.settings?.shortNameEn ?? data.settings?.nameEn ?? "Dhrubok")}: ${message(
        {
          locale: student.preferredSmsLocale,
          correction: publication.version > 1,
          examName:
            student.preferredSmsLocale === "bn"
              ? data.exam.nameBn
              : data.exam.nameEn,
          studentName: student.displayName,
          total: aggregate.grandTotalScaled,
          full: aggregate.grandFullMarksScaled,
          passed: aggregate.passed,
          scope: data.exam.officialMeritScope ?? "none",
          position,
          population: data.eligible.length,
          batchPosition,
          batchPopulation: batchGroup.length,
        },
      )}`;
      const ids = await enqueueSms(ctx, {
        idempotencyKey: `exam:${data.exam._id}:v${publication.version}:${student._id}`,
        eventType:
          publication.version > 1 ? "result_corrected" : "result_published",
        relatedEntityType: "exam",
        relatedEntityId: data.exam._id,
        studentId: student._id,
        guardianPhone: student.guardianPhone,
        locale: student.preferredSmsLocale,
        body,
      });
      recipientCount += ids.length;
    }
    await ctx.db.patch("examPublications", publication._id, { recipientCount });
    if (end < data.aggregates.length)
      await ctx.scheduler.runAfter(0, internal.exams.publication.publishBatch, {
        publicationId: publication._id,
        offset: end,
      });
    else {
      const previous = await ctx.db
        .query("examPublications")
        .withIndex("by_examId_and_status", (q) =>
          q.eq("examId", data.exam._id).eq("status", "published"),
        )
        .take(10);
      for (const row of previous)
        await ctx.db.patch("examPublications", row._id, {
          status: "superseded",
        });
      await ctx.db.patch("examPublications", publication._id, {
        status: "published",
      });
      await ctx.db.patch("exams", data.exam._id, {
        status: "published",
        publicationVersion: publication.version,
        publishedAt: now,
        publishedByAccountId: publication.publishedByAccountId,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("examAuditEvents", {
        examId: data.exam._id,
        eventType:
          publication.version > 1 ? "results_republished" : "results_published",
        publicationVersion: publication.version,
        actorAccountId: publication.publishedByAccountId,
        createdAt: Date.now(),
        metadata: JSON.stringify({ publishedInBatches: true }),
      });
    }
    return null;
  },
});

export const reopen = mutation({
  args: { examId: v.id("exams"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { account } = await requireOwner(ctx);
    if (!args.reason.trim()) throw new Error("A reopen reason is required");
    const exam = await ctx.db.get("exams", args.examId);
    if (
      !exam ||
      (exam.modelVersion !== 2 && exam.modelVersion !== 3) ||
      exam.status !== "published"
    )
      throw new Error("Only a published new-model exam can be reopened");
    const now = Date.now();
    const currentPublication = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_version", (q) =>
        q.eq("examId", exam._id).eq("version", exam.publicationVersion),
      )
      .unique();
    if (currentPublication)
      await ctx.db.patch("examPublications", currentPublication._id, {
        reopenReason: args.reason.trim(),
      });
    await ctx.db.patch("exams", exam._id, {
      status: "reopened",
      updatedAt: now,
    });
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", exam._id))
      .take(200);
    for (const row of assignments)
      await ctx.db.patch("examTeacherAssignments", row._id, {
        status: "returned",
        returnedAt: now,
        returnReason: args.reason.trim(),
        updatedAt: now,
      });
    const results = await ctx.db
      .query("examSubjectResults")
      .withIndex("by_examId_and_studentId", (q) => q.eq("examId", exam._id))
      .take(10001);
    for (const row of results)
      await ctx.db.patch("examSubjectResults", row._id, {
        entryStatus: "draft",
        submittedAt: undefined,
        updatedAt: now,
      });
    await ctx.db.insert("examAuditEvents", {
      examId: exam._id,
      eventType: "results_reopened",
      publicationVersion: exam.publicationVersion,
      reason: args.reason.trim(),
      actorAccountId: account._id,
      createdAt: now,
    });
    return null;
  },
});

export const history = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const publications = [];
    for (const status of ["published", "superseded", "processing"] as const)
      publications.push(
        ...(await ctx.db
          .query("examPublications")
          .withIndex("by_examId_and_status", (q) =>
            q.eq("examId", args.examId).eq("status", status),
          )
          .take(50)),
      );
    const events = await ctx.db
      .query("examAuditEvents")
      .withIndex("by_examId_and_createdAt", (q) => q.eq("examId", args.examId))
      .order("desc")
      .take(100);
    const smsMessages = await ctx.db
      .query("smsMessages")
      .withIndex("by_relatedEntityType_and_relatedEntityId", (q) =>
        q.eq("relatedEntityType", "exam").eq("relatedEntityId", args.examId),
      )
      .take(1000);
    return {
      publications: publications.sort((a, b) => b.version - a.version),
      events,
      smsMessages,
    };
  },
});
