import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireOwner } from "../model/auth";

export const reconcile = query({
  args: { examId: v.id("exams") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const exam = await ctx.db.get("exams", args.examId);
    if (!exam) throw new Error("Exam not found");
    const candidates = await ctx.db
      .query("examCandidates")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", args.examId).eq("status", "included"),
      )
      .take(501);
    const subjects = await ctx.db
      .query("examSubjects")
      .withIndex("by_examId_and_sortOrder", (q) => q.eq("examId", args.examId))
      .take(100);
    const results = await ctx.db
      .query("examSubjectResults")
      .withIndex("by_examId_and_studentId", (q) => q.eq("examId", args.examId))
      .take(10001);
    const publications = await ctx.db
      .query("examPublications")
      .withIndex("by_examId_and_status", (q) =>
        q.eq("examId", args.examId).eq("status", "published"),
      )
      .take(10);
    const publication = publications.find(
      (row) => row.version === exam.publicationVersion,
    );
    const publishedResults = publication
      ? await ctx.db
          .query("examPublishedResults")
          .withIndex("by_examId_and_version", (q) =>
            q.eq("examId", args.examId).eq("version", publication.version),
          )
          .take(501)
      : [];
    const assignments = await ctx.db
      .query("examTeacherAssignments")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(200);
    const candidateIds = new Set(candidates.map((row) => row._id));
    const subjectIds = new Set(subjects.map((row) => row._id));
    const orphanedSubjectResults = results.filter(
      (row) =>
        !candidateIds.has(row.candidateId) ||
        !subjectIds.has(row.examSubjectId),
    ).length;
    const issues = [];
    if ((exam.candidateCount ?? 0) !== candidates.length)
      issues.push("candidate_count_mismatch");
    if (
      exam.status !== "draft" &&
      results.length !== candidates.length * subjects.length
    )
      issues.push("subject_result_count_mismatch");
    if (
      exam.status === "published" &&
      (!publication || publishedResults.length !== candidates.length)
    )
      issues.push("publication_count_mismatch");
    if (orphanedSubjectResults) issues.push("orphaned_subject_results");
    if (
      exam.status === "marks_initializing" &&
      Date.now() - exam.updatedAt > 10 * 60 * 1000
    )
      issues.push("marks_initialization_stuck");
    if (
      exam.status === "publication_processing" &&
      Date.now() - exam.updatedAt > 10 * 60 * 1000
    )
      issues.push("publication_processing_stuck");
    if (
      exam.status === "published" &&
      publication?.version !== exam.publicationVersion
    )
      issues.push("publication_version_mismatch");
    if (
      exam.status === "ready_for_review" &&
      assignments.some((row) => row.status !== "submitted")
    )
      issues.push("assignment_submission_mismatch");
    return {
      examId: exam._id,
      candidateCount: candidates.length,
      subjectCount: subjects.length,
      expectedSubjectResults: candidates.length * subjects.length,
      actualSubjectResults: results.length,
      publicationVersion: exam.publicationVersion,
      publishedResultCount: publishedResults.length,
      assignmentCount: assignments.length,
      submittedAssignmentCount: assignments.filter(
        (row) => row.status === "submitted",
      ).length,
      orphanedSubjectResultCount: orphanedSubjectResults,
      smsRecipientCount: publication?.recipientCount ?? 0,
      issues,
    };
  },
});
