import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  academicStatusValidator,
  accountStatusValidator,
  attendanceStatusValidator,
  auditMetadataValidator,
  chargeTypeValidator,
  examModeValidator,
  localeValidator,
  paymentMethodValidator,
  smsEventTypeValidator,
  smsStatusValidator,
  studentStatusValidator,
} from "./model/validators";

const portalAccountBase = {
  status: accountStatusValidator,
  tokenIdentifier: v.optional(v.string()),
  loginEmail: v.string(),
  normalizedLoginEmail: v.string(),
  locale: localeValidator,
  lastSignedInAt: v.optional(v.number()),
  claimedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdByAccountId: v.optional(v.id("portalAccounts")),
};

export default defineSchema({
  coachingSettings: defineTable({
    nameBn: v.string(), nameEn: v.string(), shortNameBn: v.string(), shortNameEn: v.string(),
    addressBn: v.string(), addressEn: v.string(), phone: v.string(), email: v.string(),
    websiteUrl: v.optional(v.string()), timezone: v.literal("Asia/Dhaka"), currency: v.literal("BDT"),
    defaultLocale: localeValidator, defaultGuardianSmsLocale: localeValidator, monthlyDueDay: v.number(),
    logoStorageId: v.optional(v.id("_storage")), faviconStorageId: v.optional(v.id("_storage")),
    receiptPrefix: v.string(), studentIdPrefix: v.string(), applicationPrefix: v.string(),
    receiptFooterBn: v.string(), receiptFooterEn: v.string(), smsSenderId: v.optional(v.string()),
    smsEnabled: v.boolean(), publicAdmissionsOpen: v.boolean(), activeAcademicSessionId: v.optional(v.id("academicSessions")),
    createdAt: v.number(), updatedAt: v.number(), updatedByAccountId: v.optional(v.id("portalAccounts")),
  }),

  portalAccounts: defineTable(v.union(
    v.object({ ...portalAccountBase, role: v.literal("owner"), ownerProfileId: v.id("ownerProfiles") }),
    v.object({ ...portalAccountBase, role: v.literal("teacher"), teacherId: v.id("teachers") }),
    v.object({ ...portalAccountBase, role: v.literal("student"), studentId: v.id("students") }),
  ))
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_role_and_status", ["role", "status"])
    .index("by_studentId", ["studentId"])
    .index("by_teacherId", ["teacherId"]),

  accountClaimAttempts: defineTable({
    tokenIdentifier: v.string(), windowStartedAt: v.number(), attemptCount: v.number(), lastAttemptAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  devImpersonationSessions: defineTable({
    controllerTokenIdentifier: v.string(), selectedAccountId: v.id("portalAccounts"), updatedAt: v.number(),
  }).index("by_controllerTokenIdentifier", ["controllerTokenIdentifier"]),

  ownerProfiles: defineTable({
    displayName: v.string(), email: v.string(), phone: v.optional(v.string()), avatarStorageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("disabled")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_status", ["status"]),

  numberSequences: defineTable({
    key: v.union(v.literal("student"), v.literal("application"), v.literal("receipt"), v.literal("payment"), v.literal("exam"), v.literal("charge")),
    prefix: v.string(), nextValue: v.number(), yearScope: v.optional(v.number()), updatedAt: v.number(),
  }).index("by_key", ["key"]).index("by_key_and_yearScope", ["key", "yearScope"]),

  academicSessions: defineTable({
    nameBn: v.string(), nameEn: v.string(), startDate: v.string(), endDate: v.string(), status: academicStatusValidator,
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_status", ["status"]).index("by_startDate", ["startDate"]),

  subjects: defineTable({ code: v.string(), nameBn: v.string(), nameEn: v.string(), status: v.union(v.literal("active"), v.literal("archived")), createdAt: v.number(), updatedAt: v.number() })
    .index("by_code", ["code"]).index("by_status", ["status"]),

  courses: defineTable({
    academicSessionId: v.id("academicSessions"), code: v.string(), slug: v.string(), nameBn: v.string(), nameEn: v.string(),
    shortDescriptionBn: v.string(), shortDescriptionEn: v.string(), descriptionBn: v.string(), descriptionEn: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("completed"), v.literal("archived")), isPublic: v.boolean(),
    publicSortOrder: v.number(), coverStorageId: v.optional(v.id("_storage")), createdAt: v.number(), updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"), updatedByAccountId: v.id("portalAccounts"),
  }).index("by_academicSessionId_and_status", ["academicSessionId", "status"]).index("by_slug", ["slug"])
    .index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"])
    .index("by_isPublic_and_status_and_publicSortOrder", ["isPublic", "status", "publicSortOrder"]).index("by_code", ["code"]).index("by_status", ["status"]),

  courseSubjects: defineTable({ courseId: v.id("courses"), subjectId: v.id("subjects"), sortOrder: v.number(), createdAt: v.number() })
    .index("by_courseId_and_sortOrder", ["courseId", "sortOrder"]).index("by_subjectId", ["subjectId"])
    .index("by_courseId_and_subjectId", ["courseId", "subjectId"]),

  teachers: defineTable({
    employeeCode: v.string(), displayName: v.string(), nameBn: v.optional(v.string()), nameEn: v.optional(v.string()),
    loginEmail: v.string(), normalizedLoginEmail: v.string(), phone: v.string(), bioBn: v.string(), bioEn: v.string(),
    qualificationsBn: v.string(), qualificationsEn: v.string(), photoStorageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("archived")), isPublic: v.boolean(), publicSortOrder: v.number(),
    joinedAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_employeeCode", ["employeeCode"]).index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_status", ["status"]).index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"])
    .index("by_isPublic_and_status_and_publicSortOrder", ["isPublic", "status", "publicSortOrder"]),

  batches: defineTable({
    academicSessionId: v.id("academicSessions"), courseId: v.id("courses"), code: v.string(), slug: v.string(), nameBn: v.string(), nameEn: v.string(),
    roomBn: v.optional(v.string()), roomEn: v.optional(v.string()), startDate: v.optional(v.string()), endDate: v.optional(v.string()),
    capacity: v.optional(v.number()), status: academicStatusValidator, admissionOpen: v.boolean(), isPublic: v.boolean(), publicSortOrder: v.number(),
    createdAt: v.number(), updatedAt: v.number(),
  }).index("by_courseId_and_status", ["courseId", "status"]).index("by_academicSessionId_and_status", ["academicSessionId", "status"])
    .index("by_slug", ["slug"]).index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"]).index("by_code", ["code"])
    .index("by_status", ["status"]).index("by_isPublic_and_status_and_publicSortOrder", ["isPublic", "status", "publicSortOrder"]),

  teacherBatchAssignments: defineTable({
    teacherId: v.id("teachers"), batchId: v.id("batches"), subjectId: v.optional(v.id("subjects")), startsOn: v.string(), endsOn: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended")), createdAt: v.number(), createdByAccountId: v.id("portalAccounts"),
  }).index("by_teacherId_and_status", ["teacherId", "status"]).index("by_batchId_and_status", ["batchId", "status"])
    .index("by_teacherId_and_batchId", ["teacherId", "batchId"])
    .index("by_subjectId_and_status", ["subjectId", "status"]),

  batchSchedules: defineTable({
    batchId: v.id("batches"), teacherId: v.id("teachers"), subjectId: v.optional(v.id("subjects")), weekday: v.number(), startMinutes: v.number(),
    endMinutes: v.number(), roomBn: v.optional(v.string()), roomEn: v.optional(v.string()), effectiveFrom: v.string(), effectiveUntil: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("cancelled")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_batchId_and_status", ["batchId", "status"]).index("by_teacherId_and_status", ["teacherId", "status"])
    .index("by_weekday_and_status", ["weekday", "status"]).index("by_batchId_and_weekday_and_status", ["batchId", "weekday", "status"])
    .index("by_teacherId_and_weekday_and_status", ["teacherId", "weekday", "status"])
    .index("by_subjectId_and_status", ["subjectId", "status"]),

  admissionApplications: defineTable({
    applicationNumber: v.string(), submittedAt: v.number(), locale: localeValidator, studentDisplayName: v.string(),
    studentNameBn: v.optional(v.string()), studentNameEn: v.optional(v.string()), studentEmail: v.string(), normalizedStudentEmail: v.string(),
    studentPhone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), gender: v.optional(v.string()), schoolCollege: v.string(), currentClass: v.string(),
    address: v.optional(v.string()), guardianName: v.string(), guardianPhone: v.string(), normalizedGuardianPhone: v.string(), guardianRelationship: v.string(),
    alternateGuardianPhone: v.optional(v.string()), preferredSmsLocale: localeValidator, requestedCourseId: v.id("courses"), requestedBatchId: v.id("batches"),
    applicantNote: v.optional(v.string()), photoStorageId: v.optional(v.id("_storage")), status: v.union(v.literal("new"), v.literal("under_review"), v.literal("accepted"), v.literal("rejected"), v.literal("withdrawn")),
    reviewedByAccountId: v.optional(v.id("portalAccounts")), reviewedAt: v.optional(v.number()), rejectionReason: v.optional(v.string()),
    acceptedStudentId: v.optional(v.id("students")), conversionKey: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(), submissionKey: v.string(),
  }).index("by_status_and_submittedAt", ["status", "submittedAt"]).index("by_applicationNumber", ["applicationNumber"])
    .index("by_normalizedStudentEmail", ["normalizedStudentEmail"]).index("by_normalizedGuardianPhone", ["normalizedGuardianPhone"])
    .index("by_requestedCourseId_and_status", ["requestedCourseId", "status"]).index("by_conversionKey", ["conversionKey"])
    .index("by_submissionKey", ["submissionKey"]),

  students: defineTable({
    studentNumber: v.string(), rollNumber: v.optional(v.string()), displayName: v.string(), nameBn: v.optional(v.string()), nameEn: v.optional(v.string()),
    loginEmail: v.string(), normalizedLoginEmail: v.string(), phone: v.optional(v.string()), dateOfBirth: v.optional(v.string()), gender: v.optional(v.string()),
    schoolCollege: v.string(), currentClass: v.string(), address: v.optional(v.string()), photoStorageId: v.optional(v.id("_storage")), guardianName: v.string(),
    guardianPhone: v.string(), normalizedGuardianPhone: v.string(), guardianRelationship: v.string(), alternateGuardianPhone: v.optional(v.string()),
    preferredSmsLocale: localeValidator, admissionDate: v.string(), status: studentStatusValidator, sourceApplicationId: v.optional(v.id("admissionApplications")),
    internalNote: v.optional(v.string()), searchText: v.string(), createdAt: v.number(), updatedAt: v.number(), createdByAccountId: v.id("portalAccounts"), updatedByAccountId: v.id("portalAccounts"),
  }).index("by_studentNumber", ["studentNumber"]).index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_normalizedGuardianPhone", ["normalizedGuardianPhone"]).index("by_status_and_admissionDate", ["status", "admissionDate"])
    .searchIndex("search_searchText", { searchField: "searchText", filterFields: ["status"] }),

  enrolments: defineTable({
    studentId: v.id("students"), courseId: v.id("courses"), batchId: v.id("batches"), academicSessionId: v.id("academicSessions"), enrolledOn: v.string(),
    endedOn: v.optional(v.string()), status: v.union(v.literal("active"), v.literal("completed"), v.literal("withdrawn"), v.literal("transferred")),
    feePlanId: v.optional(v.id("feePlans")), agreedMonthlyAmountMinor: v.optional(v.number()), agreedCourseAmountMinor: v.optional(v.number()),
    discountPolicyId: v.optional(v.id("discountPolicies")), createdAt: v.number(), updatedAt: v.number(), createdByAccountId: v.id("portalAccounts"),
  }).index("by_studentId_and_status", ["studentId", "status"]).index("by_batchId_and_status", ["batchId", "status"])
    .index("by_courseId_and_status", ["courseId", "status"]).index("by_studentId_and_batchId", ["studentId", "batchId"])
    .index("by_feePlanId_and_status", ["feePlanId", "status"]).index("by_status", ["status"]),

  studentProfileChangeRequests: defineTable({
    studentId: v.id("students"), requestedByAccountId: v.id("portalAccounts"), fieldKey: v.string(), oldValue: v.string(), requestedValue: v.string(),
    reason: v.optional(v.string()), status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedByAccountId: v.optional(v.id("portalAccounts")), reviewedAt: v.optional(v.number()), createdAt: v.number(),
  }).index("by_studentId_and_status", ["studentId", "status"]).index("by_status_and_createdAt", ["status", "createdAt"]),

  classSessions: defineTable({
    sessionKey: v.string(), batchId: v.id("batches"), teacherId: v.id("teachers"), subjectId: v.optional(v.id("subjects")), scheduleId: v.optional(v.id("batchSchedules")),
    sessionDate: v.string(), startsAt: v.number(), endsAt: v.number(), roomBn: v.optional(v.string()), roomEn: v.optional(v.string()),
    topicBn: v.optional(v.string()), topicEn: v.optional(v.string()), status: v.union(v.literal("open"), v.literal("submitted"), v.literal("cancelled")),
    submittedAt: v.optional(v.number()), submittedByAccountId: v.optional(v.id("portalAccounts")), rosterCount: v.number(), presentCount: v.optional(v.number()),
    lateCount: v.optional(v.number()), absentCount: v.optional(v.number()), createdAt: v.number(),
  }).index("by_batchId_and_sessionDate", ["batchId", "sessionDate"]).index("by_teacherId_and_sessionDate", ["teacherId", "sessionDate"])
    .index("by_status_and_sessionDate", ["status", "sessionDate"]).index("by_scheduleId_and_sessionDate", ["scheduleId", "sessionDate"])
    .index("by_sessionKey", ["sessionKey"]),

  attendanceRecords: defineTable({
    sessionId: v.id("classSessions"), batchId: v.id("batches"), studentId: v.id("students"), enrolmentId: v.id("enrolments"),
    status: attendanceStatusValidator, submittedAt: v.number(), submittedByAccountId: v.id("portalAccounts"),
  }).index("by_sessionId", ["sessionId"]).index("by_sessionId_and_studentId", ["sessionId", "studentId"])
    .index("by_studentId_and_submittedAt", ["studentId", "submittedAt"]).index("by_batchId_and_submittedAt", ["batchId", "submittedAt"])
    .index("by_studentId_and_status", ["studentId", "status"]),

  feePlans: defineTable({
    courseId: v.optional(v.id("courses")), batchId: v.optional(v.id("batches")), nameBn: v.string(), nameEn: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")), defaultDueDay: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_courseId_and_status", ["courseId", "status"]).index("by_batchId_and_status", ["batchId", "status"]).index("by_status", ["status"]),

  feePlanItems: defineTable({
    feePlanId: v.id("feePlans"), chargeType: chargeTypeValidator, labelBn: v.string(), labelEn: v.string(), amountMinor: v.number(),
    recurrence: v.union(v.literal("once"), v.literal("monthly")), dueDay: v.optional(v.number()), sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_feePlanId_and_status", ["feePlanId", "status"]).index("by_feePlanId_and_sortOrder", ["feePlanId", "sortOrder"]),

  discountPolicies: defineTable({
    studentId: v.optional(v.id("students")), enrolmentId: v.optional(v.id("enrolments")), feePlanItemId: v.optional(v.id("feePlanItems")),
    kind: v.union(v.literal("fixed"), v.literal("percentage")), valueMinor: v.optional(v.number()), percentageBasisPoints: v.optional(v.number()),
    reason: v.string(), startsOn: v.string(), endsOn: v.optional(v.string()), status: v.union(v.literal("active"), v.literal("ended")),
    approvedByAccountId: v.id("portalAccounts"), createdAt: v.number(),
  }).index("by_studentId_and_status", ["studentId", "status"]).index("by_enrolmentId_and_status", ["enrolmentId", "status"])
    .index("by_feePlanItemId_and_status", ["feePlanItemId", "status"]),

  studentCharges: defineTable({
    chargeNumber: v.string(), studentId: v.id("students"), enrolmentId: v.optional(v.id("enrolments")), feePlanItemId: v.optional(v.id("feePlanItems")),
    type: chargeTypeValidator, periodKey: v.optional(v.string()), descriptionBn: v.string(), descriptionEn: v.string(), originalAmountMinor: v.number(),
    discountAmountMinor: v.number(), netAmountMinor: v.number(), paidAmountMinor: v.number(), dueDate: v.string(),
    status: v.union(v.literal("upcoming"), v.literal("due"), v.literal("partially_paid"), v.literal("paid"), v.literal("waived"), v.literal("voided")),
    generationKey: v.string(), createdAt: v.number(), createdByAccountId: v.optional(v.id("portalAccounts")), voidedAt: v.optional(v.number()),
    voidedByAccountId: v.optional(v.id("portalAccounts")), voidReason: v.optional(v.string()),
  }).index("by_studentId_and_dueDate", ["studentId", "dueDate"]).index("by_studentId_and_status", ["studentId", "status"])
    .index("by_enrolmentId_and_periodKey", ["enrolmentId", "periodKey"]).index("by_status_and_dueDate", ["status", "dueDate"])
    .index("by_generationKey", ["generationKey"]),

  payments: defineTable({
    paymentNumber: v.string(), receiptNumber: v.string(), studentId: v.id("students"), amountMinor: v.number(), allocatedAmountMinor: v.number(),
    advanceAmountMinor: v.number(), method: paymentMethodValidator, externalReference: v.optional(v.string()), paidAt: v.number(), note: v.optional(v.string()),
    status: v.union(v.literal("posted"), v.literal("voided")), collectedByAccountId: v.id("portalAccounts"), createdAt: v.number(),
    voidedAt: v.optional(v.number()), voidedByAccountId: v.optional(v.id("portalAccounts")), voidReason: v.optional(v.string()),
    reversalOfPaymentId: v.optional(v.id("payments")),
  }).index("by_studentId_and_paidAt", ["studentId", "paidAt"]).index("by_status_and_paidAt", ["status", "paidAt"])
    .index("by_receiptNumber", ["receiptNumber"]).index("by_paymentNumber", ["paymentNumber"]).index("by_method_and_paidAt", ["method", "paidAt"])
    .index("by_reversalOfPaymentId", ["reversalOfPaymentId"]),

  paymentAllocations: defineTable({
    paymentId: v.id("payments"), chargeId: v.id("studentCharges"), studentId: v.id("students"), amountMinor: v.number(),
    chargeDescriptionBnSnapshot: v.string(), chargeDescriptionEnSnapshot: v.string(), createdAt: v.number(), reversedAt: v.optional(v.number()),
  }).index("by_paymentId", ["paymentId"]).index("by_chargeId", ["chargeId"]).index("by_studentId_and_createdAt", ["studentId", "createdAt"])
    .index("by_paymentId_and_chargeId", ["paymentId", "chargeId"]),

  studentFinancialSummaries: defineTable({
    studentId: v.id("students"), totalChargedMinor: v.number(), totalDiscountMinor: v.number(), totalPaidMinor: v.number(), totalVoidedMinor: v.number(),
    outstandingMinor: v.number(), advanceCreditMinor: v.number(), overdueMinor: v.number(), lastPaymentAt: v.optional(v.number()), updatedAt: v.number(),
  }).index("by_studentId", ["studentId"]).index("by_outstandingMinor", ["outstandingMinor"]).index("by_overdueMinor", ["overdueMinor"]),

  exams: defineTable({
    examNumber: v.string(), courseId: v.id("courses"), nameBn: v.string(), nameEn: v.string(), examDate: v.string(), mode: examModeValidator,
    mcqFullMarksScaled: v.optional(v.number()), writtenFullMarksScaled: v.optional(v.number()), totalFullMarksScaled: v.number(), passMarksScaled: v.number(),
    status: v.union(v.literal("draft"), v.literal("marks_entry"), v.literal("ready_for_review"), v.literal("published"), v.literal("reopened"), v.literal("archived")),
    publicationVersion: v.number(), publishedAt: v.optional(v.number()), publishedByAccountId: v.optional(v.id("portalAccounts")),
    createdAt: v.number(), updatedAt: v.number(), createdByAccountId: v.id("portalAccounts"),
  }).index("by_courseId_and_examDate", ["courseId", "examDate"]).index("by_status_and_examDate", ["status", "examDate"])
    .index("by_courseId_and_status", ["courseId", "status"]).index("by_examNumber", ["examNumber"]),

  examSubjects: defineTable({ examId: v.id("exams"), subjectId: v.id("subjects"), sortOrder: v.number() })
    .index("by_examId_and_sortOrder", ["examId", "sortOrder"]).index("by_examId_and_subjectId", ["examId", "subjectId"]),
  examBatches: defineTable({ examId: v.id("exams"), batchId: v.id("batches") })
    .index("by_examId", ["examId"]).index("by_batchId", ["batchId"]).index("by_examId_and_batchId", ["examId", "batchId"]),
  examTeacherAssignments: defineTable({ examId: v.id("exams"), teacherId: v.id("teachers"), batchId: v.optional(v.id("batches")), createdAt: v.number() })
    .index("by_examId", ["examId"]).index("by_teacherId", ["teacherId"]).index("by_examId_and_teacherId", ["examId", "teacherId"]),

  examResults: defineTable({
    examId: v.id("exams"), courseId: v.id("courses"), studentId: v.id("students"), enrolmentId: v.id("enrolments"),
    participation: v.union(v.literal("present"), v.literal("absent")), mcqScoreScaled: v.optional(v.number()), writtenScoreScaled: v.optional(v.number()),
    totalScoreScaled: v.optional(v.number()), passed: v.optional(v.boolean()), meritPosition: v.optional(v.number()), teacherCommentBn: v.optional(v.string()),
    teacherCommentEn: v.optional(v.string()), entryStatus: v.union(v.literal("missing"), v.literal("draft"), v.literal("ready"), v.literal("published")),
    enteredByAccountId: v.optional(v.id("portalAccounts")), enteredAt: v.optional(v.number()), publicationVersion: v.optional(v.number()),
    publishedAt: v.optional(v.number()), updatedAt: v.number(),
    publishedParticipation: v.optional(v.union(v.literal("present"), v.literal("absent"))), publishedMcqScoreScaled: v.optional(v.number()),
    publishedWrittenScoreScaled: v.optional(v.number()), publishedTotalScoreScaled: v.optional(v.number()), publishedPassed: v.optional(v.boolean()),
    publishedMeritPosition: v.optional(v.number()), publishedTeacherCommentBn: v.optional(v.string()), publishedTeacherCommentEn: v.optional(v.string()),
  }).index("by_examId_and_studentId", ["examId", "studentId"]).index("by_examId_and_entryStatus", ["examId", "entryStatus"])
    .index("by_courseId_and_studentId", ["courseId", "studentId"]).index("by_studentId_and_publishedAt", ["studentId", "publishedAt"])
    .index("by_examId_and_totalScoreScaled", ["examId", "totalScoreScaled"])
    .index("by_examId_and_entryStatus_and_totalScoreScaled", ["examId", "entryStatus", "totalScoreScaled"]),

  materials: defineTable({
    courseId: v.id("courses"), batchId: v.optional(v.id("batches")), subjectId: v.optional(v.id("subjects")), titleBn: v.string(), titleEn: v.string(),
    descriptionBn: v.string(), descriptionEn: v.string(), kind: v.union(v.literal("file"), v.literal("link"), v.literal("text")),
    storageId: v.optional(v.id("_storage")), externalUrl: v.optional(v.string()), visibility: v.union(v.literal("course"), v.literal("batch")),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")), publishedAt: v.optional(v.number()),
    createdByAccountId: v.id("portalAccounts"), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_courseId_and_status", ["courseId", "status"]).index("by_batchId_and_status", ["batchId", "status"])
    .index("by_createdByAccountId_and_status", ["createdByAccountId", "status"]).index("by_publishedAt", ["publishedAt"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"]).index("by_storageId", ["storageId"]),

  notices: defineTable({
    titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
    audienceType: v.union(v.literal("public"), v.literal("all_students"), v.literal("course"), v.literal("batch"), v.literal("individual_students")),
    courseId: v.optional(v.id("courses")), batchId: v.optional(v.id("batches")), status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    sendSms: v.boolean(), publishedAt: v.optional(v.number()), createdByAccountId: v.id("portalAccounts"), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_audienceType_and_status", ["audienceType", "status"]).index("by_courseId_and_status", ["courseId", "status"])
    .index("by_batchId_and_status", ["batchId", "status"]).index("by_status_and_publishedAt", ["status", "publishedAt"])
    .index("by_createdByAccountId_and_status", ["createdByAccountId", "status"]),

  noticeRecipients: defineTable({ noticeId: v.id("notices"), studentId: v.id("students"), readAt: v.optional(v.number()) })
    .index("by_noticeId", ["noticeId"]).index("by_studentId_and_readAt", ["studentId", "readAt"])
    .index("by_noticeId_and_studentId", ["noticeId", "studentId"]),

  smsMessages: defineTable({
    idempotencyKey: v.string(), eventType: smsEventTypeValidator, relatedEntityType: v.string(), relatedEntityId: v.string(), studentId: v.optional(v.id("students")),
    guardianPhone: v.string(), normalizedRecipient: v.string(), locale: localeValidator, body: v.string(), segmentEstimate: v.number(),
    status: smsStatusValidator, provider: v.literal("sms_bd"), providerRequestId: v.optional(v.string()), providerStatus: v.optional(v.string()),
    providerChargeMinor: v.optional(v.number()), attemptCount: v.number(), nextAttemptAt: v.optional(v.number()), lastAttemptAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()), lastErrorMessage: v.optional(v.string()), createdAt: v.number(), updatedAt: v.number(),
    sentAt: v.optional(v.number()), deliveredAt: v.optional(v.number()),
  }).index("by_idempotencyKey", ["idempotencyKey"]).index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"]).index("by_providerRequestId", ["providerRequestId"])
    .index("by_eventType_and_createdAt", ["eventType", "createdAt"]),

  smsTemplates: defineTable({
    key: v.string(), name: v.string(), bodyBn: v.string(), bodyEn: v.string(), enabled: v.boolean(), variables: v.array(v.string()),
    updatedAt: v.number(), updatedByAccountId: v.id("portalAccounts"),
  }).index("by_key", ["key"]).index("by_enabled", ["enabled"]),
  smsProviderSnapshots: defineTable({ checkedAt: v.number(), balanceMinor: v.optional(v.number()), providerStatus: v.string(), error: v.optional(v.string()) })
    .index("by_checkedAt", ["checkedAt"]),

  siteContentBlocks: defineTable({
    key: v.union(v.literal("hero"), v.literal("about_summary"), v.literal("contact"), v.literal("achievement_intro"), v.literal("admission_intro"), v.literal("footer")),
    titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(), primaryCtaLabelBn: v.optional(v.string()),
    primaryCtaLabelEn: v.optional(v.string()), primaryCtaHref: v.optional(v.string()), mediaStorageId: v.optional(v.id("_storage")),
    draftRevision: v.number(), publishedRevision: v.number(), status: v.union(v.literal("draft"), v.literal("published")),
    updatedAt: v.number(), updatedByAccountId: v.id("portalAccounts"),
  }).index("by_key", ["key"]).index("by_status", ["status"]),
  siteContentRevisions: defineTable({
    contentBlockId: v.id("siteContentBlocks"), revision: v.number(), titleBn: v.string(), titleEn: v.string(), bodyBn: v.string(), bodyEn: v.string(),
    primaryCtaLabelBn: v.optional(v.string()), primaryCtaLabelEn: v.optional(v.string()), primaryCtaHref: v.optional(v.string()),
    mediaStorageId: v.optional(v.id("_storage")), publishedAt: v.number(), publishedByAccountId: v.id("portalAccounts"),
  }).index("by_contentBlockId_and_revision", ["contentBlockId", "revision"]),
  galleryItems: defineTable({
    titleBn: v.string(), titleEn: v.string(), imageStorageId: v.id("_storage"), altBn: v.string(), altEn: v.string(), sortOrder: v.number(),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_status_and_sortOrder", ["status", "sortOrder"]),

  auditLogs: defineTable({
    actorAccountId: v.optional(v.id("portalAccounts")), actorRole: v.optional(v.union(v.literal("owner"), v.literal("teacher"), v.literal("student"))),
    action: v.string(), entityType: v.string(), entityId: v.string(), summary: v.string(), metadata: v.optional(auditMetadataValidator), occurredAt: v.number(),
  }).index("by_entityType_and_entityId", ["entityType", "entityId"]).index("by_actorAccountId_and_occurredAt", ["actorAccountId", "occurredAt"])
    .index("by_action_and_occurredAt", ["action", "occurredAt"]).index("by_occurredAt", ["occurredAt"]),

  dailyOperationalSummaries: defineTable({
    date: v.string(), activeStudentCount: v.number(), activeBatchCount: v.number(), scheduledSessionCount: v.number(), submittedSessionCount: v.number(),
    presentCount: v.number(), lateCount: v.number(), absentCount: v.number(), paymentsCount: v.number(), collectedMinor: v.number(),
    overdueStudentsCount: v.number(), overdueMinor: v.number(), updatedAt: v.number(),
  }).index("by_date", ["date"]),
});
