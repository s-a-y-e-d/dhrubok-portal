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
    nameBn: v.string(),
    nameEn: v.string(),
    searchText: v.optional(v.string()),
    shortNameBn: v.string(),
    shortNameEn: v.string(),
    addressBn: v.string(),
    addressEn: v.string(),
    phone: v.string(),
    email: v.string(),
    websiteUrl: v.optional(v.string()),
    timezone: v.literal("Asia/Dhaka"),
    currency: v.literal("BDT"),
    defaultLocale: localeValidator,
    defaultGuardianSmsLocale: localeValidator,
    // Deprecated: monthly fees are always due on the first.
    monthlyDueDay: v.optional(v.number()),
    logoStorageId: v.optional(v.id("_storage")),
    faviconStorageId: v.optional(v.id("_storage")),
    receiptPrefix: v.string(),
    studentIdPrefix: v.string(),
    applicationPrefix: v.string(),
    receiptFooterBn: v.string(),
    receiptFooterEn: v.string(),
    smsSenderId: v.optional(v.string()),
    smsEnabled: v.boolean(),
    publicAdmissionsOpen: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedByAccountId: v.optional(v.id("portalAccounts")),
  }),

  portalAccounts: defineTable(
    v.union(
      v.object({
        ...portalAccountBase,
        role: v.literal("owner"),
        ownerProfileId: v.id("ownerProfiles"),
      }),
      v.object({
        ...portalAccountBase,
        role: v.literal("teacher"),
        teacherId: v.id("teachers"),
      }),
      v.object({
        ...portalAccountBase,
        role: v.literal("student"),
        studentId: v.id("students"),
      }),
    ),
  )
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_role_and_status", ["role", "status"])
    .index("by_studentId", ["studentId"])
    .index("by_teacherId", ["teacherId"]),

  accountClaimAttempts: defineTable({
    tokenIdentifier: v.string(),
    windowStartedAt: v.number(),
    attemptCount: v.number(),
    lastAttemptAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  devImpersonationSessions: defineTable({
    controllerTokenIdentifier: v.string(),
    selectedAccountId: v.id("portalAccounts"),
    updatedAt: v.number(),
  }).index("by_controllerTokenIdentifier", ["controllerTokenIdentifier"]),

  ownerProfiles: defineTable({
    displayName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    status: v.union(v.literal("active"), v.literal("disabled")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  numberSequences: defineTable({
    key: v.union(
      v.literal("student"),
      v.literal("application"),
      v.literal("receipt"),
      v.literal("payment"),
      v.literal("exam"),
      v.literal("charge"),
      v.literal("due_campaign"),
      v.literal("fee_agreement"),
      v.literal("finance_adjustment"),
    ),
    prefix: v.string(),
    nextValue: v.number(),
    yearScope: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_key_and_yearScope", ["key", "yearScope"]),

  subjects: defineTable({
    code: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),

  courseOperationalSnapshots: defineTable({
    courseId: v.id("courses"),
    lifecycleStatus: v.union(v.literal("active"), v.literal("archived")),
    qualifyingBatchCount: v.number(),
    activeBatchCount: v.number(),
    plannedBatchCount: v.number(),
    completedBatchCount: v.number(),
    archivedBatchCount: v.number(),
    activeEnrolmentCount: v.number(),
    academicReady: v.boolean(),
    feeConfigured: v.boolean(),
    missingBatchCount: v.number(),
    missingTeacherCount: v.number(),
    missingRoutineCount: v.number(),
    missingFeeCount: v.number(),
    websitePublished: v.boolean(),
    nextRoutineWeekday: v.optional(v.number()),
    nextRoutineStartMinutes: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_courseId", ["courseId"]),

  courses: defineTable({
    code: v.string(),
    slug: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    searchText: v.optional(v.string()),
    shortDescriptionBn: v.string(),
    shortDescriptionEn: v.string(),
    descriptionBn: v.string(),
    descriptionEn: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    isPublic: v.boolean(),
    publicSortOrder: v.number(),
    coverStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
    updatedByAccountId: v.id("portalAccounts"),
  })
    .index("by_slug", ["slug"])
    .index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"])
    .index("by_isPublic_and_status_and_publicSortOrder", [
      "isPublic",
      "status",
      "publicSortOrder",
    ])
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: ["status"],
    }),

  courseSubjects: defineTable({
    courseId: v.id("courses"),
    subjectId: v.id("subjects"),
    sortOrder: v.number(),
    createdAt: v.number(),
  })
    .index("by_courseId_and_sortOrder", ["courseId", "sortOrder"])
    .index("by_subjectId", ["subjectId"])
    .index("by_courseId_and_subjectId", ["courseId", "subjectId"]),

  courseTeacherDefaults: defineTable({
    courseId: v.id("courses"),
    subjectId: v.id("subjects"),
    teacherId: v.id("teachers"),
    status: v.union(v.literal("active"), v.literal("ended")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
    updatedByAccountId: v.id("portalAccounts"),
  })
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_courseId_and_subjectId", ["courseId", "subjectId"])
    .index("by_teacherId_and_status", ["teacherId", "status"])
    .index("by_subjectId_and_status", ["subjectId", "status"]),

  teachers: defineTable({
    employeeCode: v.string(),
    displayName: v.string(),
    nameBn: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    loginEmail: v.string(),
    normalizedLoginEmail: v.string(),
    phone: v.string(),
    bioBn: v.string(),
    bioEn: v.string(),
    qualificationsBn: v.string(),
    qualificationsEn: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("archived"),
    ),
    isPublic: v.boolean(),
    publicSortOrder: v.number(),
    joinedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_employeeCode", ["employeeCode"])
    .index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_status", ["status"])
    .index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"])
    .index("by_isPublic_and_status_and_publicSortOrder", [
      "isPublic",
      "status",
      "publicSortOrder",
    ]),

  batches: defineTable({
    courseId: v.id("courses"),
    code: v.string(),
    slug: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    // Deprecated during the room-removal widen/migrate/narrow rollout.
    roomBn: v.optional(v.string()),
    roomEn: v.optional(v.string()),
    startDate: v.string(),
    status: academicStatusValidator,
    admissionOpen: v.boolean(),
    isPublic: v.boolean(),
    publicSortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_slug", ["slug"])
    .index("by_isPublic_and_publicSortOrder", ["isPublic", "publicSortOrder"])
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .index("by_isPublic_and_status_and_publicSortOrder", [
      "isPublic",
      "status",
      "publicSortOrder",
    ]),

  teacherBatchAssignments: defineTable({
    teacherId: v.id("teachers"),
    batchId: v.id("batches"),
    subjectId: v.optional(v.id("subjects")),
    startsOn: v.string(),
    endsOn: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended")),
    createdAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
  })
    .index("by_status", ["status"])
    .index("by_teacherId_and_status", ["teacherId", "status"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_teacherId_and_batchId", ["teacherId", "batchId"])
    .index("by_subjectId_and_status", ["subjectId", "status"]),

  batchSchedules: defineTable({
    batchId: v.id("batches"),
    teacherId: v.id("teachers"),
    subjectId: v.optional(v.id("subjects")),
    weekday: v.number(),
    startMinutes: v.number(),
    endMinutes: v.number(),
    // Deprecated during the room-removal widen/migrate/narrow rollout.
    roomBn: v.optional(v.string()),
    roomEn: v.optional(v.string()),
    effectiveFrom: v.string(),
    effectiveUntil: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("cancelled")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_teacherId_and_status", ["teacherId", "status"])
    .index("by_status", ["status"])
    .index("by_weekday_and_status", ["weekday", "status"])
    .index("by_batchId_and_weekday_and_status", [
      "batchId",
      "weekday",
      "status",
    ])
    .index("by_teacherId_and_weekday_and_status", [
      "teacherId",
      "weekday",
      "status",
    ])
    .index("by_subjectId_and_status", ["subjectId", "status"]),

  admissionApplications: defineTable({
    applicationNumber: v.string(),
    submittedAt: v.number(),
    locale: localeValidator,
    studentDisplayName: v.string(),
    studentNameBn: v.optional(v.string()),
    studentNameEn: v.optional(v.string()),
    studentEmail: v.string(),
    normalizedStudentEmail: v.string(),
    studentPhone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.string()),
    schoolCollege: v.string(),
    currentClass: v.string(),
    address: v.optional(v.string()),
    guardianName: v.string(),
    guardianPhone: v.string(),
    normalizedGuardianPhone: v.string(),
    guardianRelationship: v.string(),
    alternateGuardianPhone: v.optional(v.string()),
    motherName: v.optional(v.string()),
    motherPhone: v.optional(v.string()),
    preferredSmsLocale: localeValidator,
    requestedCourseId: v.id("courses"),
    requestedBatchId: v.id("batches"),
    applicantNote: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    status: v.union(
      v.literal("new"),
      v.literal("under_review"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("withdrawn"),
    ),
    reviewedByAccountId: v.optional(v.id("portalAccounts")),
    reviewedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    acceptedStudentId: v.optional(v.id("students")),
    conversionKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    submissionKey: v.string(),
  })
    .index("by_status_and_submittedAt", ["status", "submittedAt"])
    .index("by_applicationNumber", ["applicationNumber"])
    .index("by_normalizedStudentEmail", ["normalizedStudentEmail"])
    .index("by_normalizedGuardianPhone", ["normalizedGuardianPhone"])
    .index("by_requestedCourseId_and_status", ["requestedCourseId", "status"])
    .index("by_conversionKey", ["conversionKey"])
    .index("by_submissionKey", ["submissionKey"]),

  students: defineTable({
    studentNumber: v.string(),
    // Deprecated during the roll-number removal migration. New writes omit it.
    rollNumber: v.optional(v.string()),
    displayName: v.string(),
    nameBn: v.optional(v.string()),
    nameEn: v.optional(v.string()),
    loginEmail: v.string(),
    normalizedLoginEmail: v.string(),
    phone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    gender: v.optional(v.string()),
    schoolCollege: v.string(),
    currentClass: v.string(),
    address: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    guardianName: v.string(),
    guardianPhone: v.string(),
    normalizedGuardianPhone: v.string(),
    guardianRelationship: v.string(),
    alternateGuardianPhone: v.optional(v.string()),
    motherName: v.optional(v.string()),
    motherPhone: v.optional(v.string()),
    smsRecipient: v.optional(
      v.union(v.literal("father"), v.literal("mother"), v.literal("both")),
    ),
    preferredSmsLocale: localeValidator,
    admissionDate: v.string(),
    // Legacy states remain accepted until the enrolment-derived migration runs.
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("left"),
      v.literal("archived"),
    ),
    sourceApplicationId: v.optional(v.id("admissionApplications")),
    internalNote: v.optional(v.string()),
    searchText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
    updatedByAccountId: v.id("portalAccounts"),
  })
    .index("by_studentNumber", ["studentNumber"])
    .index("by_normalizedLoginEmail", ["normalizedLoginEmail"])
    .index("by_normalizedGuardianPhone", ["normalizedGuardianPhone"])
    .index("by_status_and_admissionDate", ["status", "admissionDate"])
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: ["status"],
    }),

  enrolments: defineTable({
    studentId: v.id("students"),
    courseId: v.id("courses"),
    batchId: v.id("batches"),
    enrolledOn: v.string(),
    endedOn: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("withdrawn"),
      v.literal("transferred"),
    ),
    agreedMonthlyAmountMinor: v.optional(v.number()),
    firstBillingMonth: v.optional(v.string()),
    // Legacy compatibility fields; new finance workflows do not use them.
    feePlanId: v.optional(v.id("feePlans")),
    agreedCourseAmountMinor: v.optional(v.number()),
    discountPolicyId: v.optional(v.id("discountPolicies")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
  })
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_studentId_and_batchId", ["studentId", "batchId"])
    .index("by_feePlanId_and_status", ["feePlanId", "status"])
    .index("by_status", ["status"]),

  studentProfileChangeRequests: defineTable({
    studentId: v.id("students"),
    requestedByAccountId: v.id("portalAccounts"),
    fieldKey: v.string(),
    oldValue: v.string(),
    requestedValue: v.string(),
    reason: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    reviewedByAccountId: v.optional(v.id("portalAccounts")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  classSessions: defineTable({
    sessionKey: v.string(),
    batchId: v.id("batches"),
    teacherId: v.id("teachers"),
    subjectId: v.optional(v.id("subjects")),
    scheduleId: v.optional(v.id("batchSchedules")),
    sessionDate: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    // Deprecated during the room-removal widen/migrate/narrow rollout.
    roomBn: v.optional(v.string()),
    roomEn: v.optional(v.string()),
    topicBn: v.optional(v.string()),
    topicEn: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("open"),
      v.literal("submitted"),
      v.literal("cancelled"),
    ),
    submittedAt: v.optional(v.number()),
    submittedByAccountId: v.optional(v.id("portalAccounts")),
    rosterCount: v.number(),
    presentCount: v.optional(v.number()),
    lateCount: v.optional(v.number()),
    absentCount: v.optional(v.number()),
    // Set by the Schedule page when one generated occurrence is moved independently.
    isOneOffOverride: v.optional(v.boolean()),
    occurrenceType: v.optional(
      v.union(v.literal("generated"), v.literal("extra")),
    ),
    originalSessionDate: v.optional(v.string()),
    originalStartsAt: v.optional(v.number()),
    originalEndsAt: v.optional(v.number()),
    changeReason: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancelledByAccountId: v.optional(v.id("portalAccounts")),
    cancellationType: v.optional(
      v.union(v.literal("manual"), v.literal("routine")),
    ),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_sessionDate", ["sessionDate"])
    .index("by_batchId_and_sessionDate", ["batchId", "sessionDate"])
    .index("by_teacherId_and_sessionDate", ["teacherId", "sessionDate"])
    .index("by_status_and_sessionDate", ["status", "sessionDate"])
    .index("by_scheduleId_and_sessionDate", ["scheduleId", "sessionDate"])
    .index("by_sessionKey", ["sessionKey"]),

  attendanceRecords: defineTable({
    sessionId: v.id("classSessions"),
    batchId: v.id("batches"),
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    status: attendanceStatusValidator,
    submittedAt: v.number(),
    submittedByAccountId: v.id("portalAccounts"),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_studentId", ["sessionId", "studentId"])
    .index("by_studentId_and_submittedAt", ["studentId", "submittedAt"])
    .index("by_batchId_and_submittedAt", ["batchId", "submittedAt"])
    .index("by_studentId_and_status", ["studentId", "status"]),

  monthlyFeeRecords: defineTable({
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    courseId: v.id("courses"),
    batchId: v.id("batches"),
    periodKey: v.string(),
    dueDate: v.string(),
    amountMinor: v.number(),
    status: v.union(v.literal("unpaid"), v.literal("paid")),
    collectionId: v.optional(v.id("feeCollections")),
    createdAt: v.number(),
    paidAt: v.optional(v.number()),
  })
    .index("by_enrolmentId_and_periodKey", ["enrolmentId", "periodKey"])
    .index("by_studentId_and_dueDate", ["studentId", "dueDate"])
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_status_and_dueDate", ["status", "dueDate"])
    .index("by_courseId_and_status_and_dueDate", [
      "courseId",
      "status",
      "dueDate",
    ])
    .index("by_batchId_and_status_and_dueDate", [
      "batchId",
      "status",
      "dueDate",
    ])
    .index("by_collectionId", ["collectionId"]),

  feeCollections: defineTable({
    receiptNumber: v.string(),
    studentId: v.id("students"),
    collectionType: v.union(
      v.literal("admission"),
      v.literal("monthly"),
      v.literal("other"),
    ),
    amountMinor: v.number(),
    collectedOn: v.string(),
    note: v.optional(v.string()),
    status: v.union(v.literal("posted"), v.literal("voided")),
    collectedByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    voidedAt: v.optional(v.number()),
    voidedByAccountId: v.optional(v.id("portalAccounts")),
    voidReason: v.optional(v.string()),
  })
    .index("by_studentId_and_collectedOn", ["studentId", "collectedOn"])
    .index("by_status_and_collectedOn", ["status", "collectedOn"])
    .index("by_collectionType_and_collectedOn", [
      "collectionType",
      "collectedOn",
    ])
    .index("by_receiptNumber", ["receiptNumber"])
    .index("by_collectedByAccountId_and_collectedOn", [
      "collectedByAccountId",
      "collectedOn",
    ]),

  feeCollectionItems: defineTable({
    collectionId: v.id("feeCollections"),
    studentId: v.id("students"),
    monthlyFeeRecordId: v.optional(v.id("monthlyFeeRecords")),
    itemType: v.union(
      v.literal("admission"),
      v.literal("monthly"),
      v.literal("other"),
    ),
    descriptionSnapshot: v.string(),
    periodKey: v.optional(v.string()),
    amountMinor: v.number(),
    studentNameSnapshot: v.string(),
    studentNumberSnapshot: v.string(),
    courseNameSnapshot: v.string(),
    batchNameSnapshot: v.string(),
    createdAt: v.number(),
    reversedAt: v.optional(v.number()),
  })
    .index("by_collectionId", ["collectionId"])
    .index("by_monthlyFeeRecordId", ["monthlyFeeRecordId"])
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"]),

  feePlans: defineTable({
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    nameBn: v.string(),
    nameEn: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    defaultDueDay: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_status", ["status"]),

  feePlanItems: defineTable({
    feePlanId: v.id("feePlans"),
    chargeType: chargeTypeValidator,
    labelBn: v.string(),
    labelEn: v.string(),
    amountMinor: v.number(),
    recurrence: v.union(v.literal("once"), v.literal("monthly")),
    dueDay: v.optional(v.number()),
    sortOrder: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_feePlanId_and_status", ["feePlanId", "status"])
    .index("by_feePlanId_and_sortOrder", ["feePlanId", "sortOrder"]),

  discountPolicies: defineTable({
    studentId: v.optional(v.id("students")),
    enrolmentId: v.optional(v.id("enrolments")),
    feePlanItemId: v.optional(v.id("feePlanItems")),
    kind: v.union(v.literal("fixed"), v.literal("percentage")),
    valueMinor: v.optional(v.number()),
    percentageBasisPoints: v.optional(v.number()),
    reason: v.string(),
    startsOn: v.string(),
    endsOn: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("ended")),
    approvedByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
  })
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_enrolmentId_and_status", ["enrolmentId", "status"])
    .index("by_feePlanItemId_and_status", ["feePlanItemId", "status"]),

  studentCharges: defineTable({
    chargeNumber: v.string(),
    studentId: v.id("students"),
    enrolmentId: v.optional(v.id("enrolments")),
    feePlanItemId: v.optional(v.id("feePlanItems")),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    agreementId: v.optional(v.id("studentFeeAgreements")),
    sourceAdjustmentId: v.optional(v.id("financeAdjustments")),
    type: chargeTypeValidator,
    periodKey: v.optional(v.string()),
    descriptionBn: v.string(),
    descriptionEn: v.string(),
    originalAmountMinor: v.number(),
    discountAmountMinor: v.number(),
    netAmountMinor: v.number(),
    paidAmountMinor: v.number(),
    dueDate: v.string(),
    status: v.union(
      v.literal("upcoming"),
      v.literal("due"),
      v.literal("partially_paid"),
      v.literal("paid"),
      v.literal("waived"),
      v.literal("voided"),
    ),
    generationKey: v.string(),
    createdAt: v.number(),
    createdByAccountId: v.optional(v.id("portalAccounts")),
    voidedAt: v.optional(v.number()),
    voidedByAccountId: v.optional(v.id("portalAccounts")),
    voidReason: v.optional(v.string()),
    settledAt: v.optional(v.number()),
  })
    .index("by_studentId_and_dueDate", ["studentId", "dueDate"])
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_enrolmentId_and_periodKey", ["enrolmentId", "periodKey"])
    .index("by_status_and_dueDate", ["status", "dueDate"])
    .index("by_courseId_and_dueDate", ["courseId", "dueDate"])
    .index("by_batchId_and_dueDate", ["batchId", "dueDate"])
    .index("by_courseId_and_status_and_dueDate", [
      "courseId",
      "status",
      "dueDate",
    ])
    .index("by_batchId_and_status_and_dueDate", [
      "batchId",
      "status",
      "dueDate",
    ])
    .index("by_generationKey", ["generationKey"]),

  payments: defineTable({
    paymentNumber: v.string(),
    receiptNumber: v.string(),
    studentId: v.id("students"),
    amountMinor: v.number(),
    allocatedAmountMinor: v.number(),
    advanceAmountMinor: v.number(),
    method: paymentMethodValidator,
    externalReference: v.optional(v.string()),
    paidAt: v.number(),
    note: v.optional(v.string()),
    status: v.union(v.literal("posted"), v.literal("voided")),
    collectedByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    voidedAt: v.optional(v.number()),
    voidedByAccountId: v.optional(v.id("portalAccounts")),
    voidReason: v.optional(v.string()),
    reversalOfPaymentId: v.optional(v.id("payments")),
    cashDrawerSessionId: v.optional(v.id("cashDrawerSessions")),
    importRowId: v.optional(v.id("paymentImportRows")),
    refundedAmountMinor: v.optional(v.number()),
    reconciliationStatus: v.optional(
      v.union(
        v.literal("unreviewed"),
        v.literal("matched"),
        v.literal("exception"),
      ),
    ),
  })
    .index("by_studentId_and_paidAt", ["studentId", "paidAt"])
    .index("by_status_and_paidAt", ["status", "paidAt"])
    .index("by_receiptNumber", ["receiptNumber"])
    .index("by_paymentNumber", ["paymentNumber"])
    .index("by_method_and_paidAt", ["method", "paidAt"])
    .index("by_cashDrawerSessionId_and_paidAt", [
      "cashDrawerSessionId",
      "paidAt",
    ])
    .index("by_importRowId", ["importRowId"])
    .index("by_collectedByAccountId_and_paidAt", [
      "collectedByAccountId",
      "paidAt",
    ])
    .index("by_reversalOfPaymentId", ["reversalOfPaymentId"]),

  paymentAllocations: defineTable({
    paymentId: v.id("payments"),
    chargeId: v.id("studentCharges"),
    studentId: v.id("students"),
    amountMinor: v.number(),
    chargeDescriptionBnSnapshot: v.string(),
    chargeDescriptionEnSnapshot: v.string(),
    createdAt: v.number(),
    reversedAt: v.optional(v.number()),
    refundAdjustmentId: v.optional(v.id("financeAdjustments")),
  })
    .index("by_paymentId", ["paymentId"])
    .index("by_chargeId", ["chargeId"])
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"])
    .index("by_paymentId_and_chargeId", ["paymentId", "chargeId"])
    .index("by_refundAdjustmentId", ["refundAdjustmentId"]),

  studentFinancialSummaries: defineTable({
    studentId: v.id("students"),
    totalChargedMinor: v.number(),
    totalDiscountMinor: v.number(),
    totalPaidMinor: v.number(),
    totalVoidedMinor: v.number(),
    outstandingMinor: v.number(),
    advanceCreditMinor: v.number(),
    overdueMinor: v.number(),
    currentMinor: v.optional(v.number()),
    overdue1To15Minor: v.optional(v.number()),
    overdue16To30Minor: v.optional(v.number()),
    overdue31To60Minor: v.optional(v.number()),
    overdue61To90Minor: v.optional(v.number()),
    overdueOver90Minor: v.optional(v.number()),
    oldestUnpaidDueDate: v.optional(v.string()),
    lastReminderAt: v.optional(v.number()),
    nextPromiseDate: v.optional(v.string()),
    summaryVersion: v.optional(v.number()),
    lastPaymentAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_studentId", ["studentId"])
    .index("by_outstandingMinor", ["outstandingMinor"])
    .index("by_overdueMinor", ["overdueMinor"]),

  receivableScopeSummaries: defineTable({
    studentId: v.id("students"),
    enrolmentId: v.optional(v.id("enrolments")),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    outstandingMinor: v.number(),
    overdueMinor: v.number(),
    currentMinor: v.number(),
    overdue1To15Minor: v.number(),
    overdue16To30Minor: v.number(),
    overdue31To60Minor: v.number(),
    overdue61To90Minor: v.number(),
    overdueOver90Minor: v.number(),
    oldestUnpaidDueDate: v.optional(v.string()),
    lastPaymentAt: v.optional(v.number()),
    lastReminderAt: v.optional(v.number()),
    updatedAt: v.number(),
    summaryVersion: v.number(),
  })
    .index("by_studentId_and_enrolmentId", ["studentId", "enrolmentId"])
    .index("by_courseId_and_overdueMinor", ["courseId", "overdueMinor"])
    .index("by_batchId_and_overdueMinor", ["batchId", "overdueMinor"])
    .index("by_courseId_and_oldestUnpaidDueDate", [
      "courseId",
      "oldestUnpaidDueDate",
    ])
    .index("by_batchId_and_oldestUnpaidDueDate", [
      "batchId",
      "oldestUnpaidDueDate",
    ]),

  financeDailySnapshots: defineTable({
    date: v.string(),
    collectedMinor: v.number(),
    paymentCount: v.number(),
    refundedMinor: v.number(),
    outstandingMinor: v.number(),
    overdueMinor: v.number(),
    overdueStudentsCount: v.number(),
    adjustmentMinor: v.number(),
    cashVarianceMinor: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_date", ["date"]),

  financeOperationalState: defineTable({
    key: v.literal("finance"),
    lastReceivableRefreshAt: v.optional(v.number()),
    lastReceivableRefreshDate: v.optional(v.string()),
    summaryDriftCount: v.number(),
    summaryDriftMinor: v.number(),
    lastSnapshotAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  dueReminderCampaigns: defineTable({
    campaignNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("previewed"),
      v.literal("queueing"),
      v.literal("queued"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    scopeType: v.union(
      v.literal("all"),
      v.literal("course"),
      v.literal("batch"),
      v.literal("custom"),
    ),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    ageingBuckets: v.array(
      v.union(
        v.literal("1_15"),
        v.literal("16_30"),
        v.literal("31_60"),
        v.literal("61_90"),
        v.literal("over_90"),
      ),
    ),
    minimumOverdueMinor: v.optional(v.number()),
    maximumOverdueMinor: v.optional(v.number()),
    suppressIfRemindedSince: v.optional(v.number()),
    localeMode: v.union(
      v.literal("student_preference"),
      v.literal("bn"),
      v.literal("en"),
    ),
    templateBnSnapshot: v.string(),
    templateEnSnapshot: v.string(),
    resolvedStudentCount: v.number(),
    eligibleRecipientCount: v.number(),
    suppressedRecipientCount: v.number(),
    queuedMessageCount: v.number(),
    deliveredMessageCount: v.number(),
    failedMessageCount: v.number(),
    estimatedSegments: v.number(),
    estimatedCostMinor: v.optional(v.number()),
    createdByAccountId: v.id("portalAccounts"),
    approvedByAccountId: v.optional(v.id("portalAccounts")),
    createdAt: v.number(),
    previewedAt: v.optional(v.number()),
    queuedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
  })
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_courseId_and_createdAt", ["courseId", "createdAt"])
    .index("by_batchId_and_createdAt", ["batchId", "createdAt"])
    .index("by_createdByAccountId_and_createdAt", [
      "createdByAccountId",
      "createdAt",
    ])
    .index("by_campaignNumber", ["campaignNumber"]),

  dueReminderCampaignRecipients: defineTable({
    campaignId: v.id("dueReminderCampaigns"),
    studentId: v.id("students"),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    overdueMinorSnapshot: v.number(),
    currentMinor: v.number(),
    overdue1To15Minor: v.number(),
    overdue16To30Minor: v.number(),
    overdue31To60Minor: v.number(),
    overdue61To90Minor: v.number(),
    overdueOver90Minor: v.number(),
    guardianPhoneSnapshot: v.string(),
    locale: localeValidator,
    messageBodySnapshot: v.string(),
    segmentCount: v.number(),
    estimatedCostMinor: v.optional(v.number()),
    status: v.union(
      v.literal("eligible"),
      v.literal("suppressed"),
      v.literal("queued"),
      v.literal("accepted"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    suppressionReason: v.optional(v.string()),
    smsMessageId: v.optional(v.id("smsMessages")),
    lastAttemptAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_campaignId_and_status", ["campaignId", "status"])
    .index("by_campaignId_and_studentId", ["campaignId", "studentId"])
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"])
    .index("by_smsMessageId", ["smsMessageId"]),

  paymentPromises: defineTable({
    studentId: v.id("students"),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    promisedAmountMinor: v.optional(v.number()),
    promisedOn: v.string(),
    note: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("kept"),
      v.literal("missed"),
      v.literal("cancelled"),
    ),
    createdByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_status_and_promisedOn", ["status", "promisedOn"])
    .index("by_batchId_and_status", ["batchId", "status"]),

  studentFeeAgreements: defineTable({
    agreementNumber: v.string(),
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    feePlanId: v.id("feePlans"),
    effectiveFrom: v.string(),
    effectiveTo: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("superseded"),
      v.literal("ended"),
    ),
    agreedMonthlyAmountMinor: v.optional(v.number()),
    agreedCourseAmountMinor: v.optional(v.number()),
    installmentRule: v.optional(v.string()),
    reason: v.string(),
    approvedByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    supersedesAgreementId: v.optional(v.id("studentFeeAgreements")),
  })
    .index("by_enrolmentId_and_status", ["enrolmentId", "status"])
    .index("by_studentId_and_effectiveFrom", ["studentId", "effectiveFrom"])
    .index("by_feePlanId_and_status", ["feePlanId", "status"])
    .index("by_agreementNumber", ["agreementNumber"]),

  financeAdjustments: defineTable({
    adjustmentNumber: v.string(),
    studentId: v.id("students"),
    chargeId: v.optional(v.id("studentCharges")),
    paymentId: v.optional(v.id("payments")),
    refundAdvanceAmountMinor: v.optional(v.number()),
    type: v.union(
      v.literal("waiver"),
      v.literal("credit_note"),
      v.literal("refund"),
      v.literal("write_off"),
    ),
    amountMinor: v.number(),
    method: v.optional(paymentMethodValidator),
    externalReference: v.optional(v.string()),
    reason: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("posted"),
      v.literal("voided"),
    ),
    postedAt: v.optional(v.number()),
    postedByAccountId: v.optional(v.id("portalAccounts")),
    voidedAt: v.optional(v.number()),
    voidedByAccountId: v.optional(v.id("portalAccounts")),
    voidReason: v.optional(v.string()),
    createdAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
  })
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"])
    .index("by_chargeId", ["chargeId"])
    .index("by_paymentId", ["paymentId"])
    .index("by_type_and_postedAt", ["type", "postedAt"])
    .index("by_status_and_postedAt", ["status", "postedAt"])
    .index("by_adjustmentNumber", ["adjustmentNumber"]),

  studentCredits: defineTable({
    studentId: v.id("students"),
    sourceAdjustmentId: v.id("financeAdjustments"),
    originalAmountMinor: v.number(),
    remainingAmountMinor: v.number(),
    status: v.union(
      v.literal("available"),
      v.literal("applied"),
      v.literal("voided"),
    ),
    createdAt: v.number(),
    voidedAt: v.optional(v.number()),
  })
    .index("by_studentId_and_status", ["studentId", "status"])
    .index("by_sourceAdjustmentId", ["sourceAdjustmentId"]),

  financeCreditAllocations: defineTable({
    creditId: v.id("studentCredits"),
    adjustmentId: v.id("financeAdjustments"),
    studentId: v.id("students"),
    chargeId: v.id("studentCharges"),
    amountMinor: v.number(),
    createdAt: v.number(),
    reversedAt: v.optional(v.number()),
  })
    .index("by_creditId", ["creditId"])
    .index("by_adjustmentId", ["adjustmentId"])
    .index("by_chargeId", ["chargeId"]),

  cashDrawerSessions: defineTable({
    drawerId: v.id("cashDrawers"),
    businessDate: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("closed"),
      v.literal("reopened"),
    ),
    openingFloatMinor: v.number(),
    expectedCashMinor: v.number(),
    countedCashMinor: v.optional(v.number()),
    varianceMinor: v.optional(v.number()),
    openedByAccountId: v.id("portalAccounts"),
    openedAt: v.number(),
    closedByAccountId: v.optional(v.id("portalAccounts")),
    closedAt: v.optional(v.number()),
    closeNote: v.optional(v.string()),
    reopenedByAccountId: v.optional(v.id("portalAccounts")),
    reopenedAt: v.optional(v.number()),
    reopenReason: v.optional(v.string()),
  })
    .index("by_drawerId_and_businessDate", ["drawerId", "businessDate"])
    .index("by_status_and_businessDate", ["status", "businessDate"])
    .index("by_businessDate", ["businessDate"]),
  cashDrawers: defineTable({
    code: v.string(),
    nameBn: v.string(),
    nameEn: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"]),
  paymentImportBatches: defineTable({
    fileName: v.string(),
    fileHash: v.string(),
    mappingVersion: v.number(),
    status: v.union(
      v.literal("staging"),
      v.literal("previewed"),
      v.literal("committing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    totalRows: v.number(),
    validRows: v.number(),
    invalidRows: v.number(),
    committedRows: v.number(),
    totalAmountMinor: v.number(),
    sendSms: v.boolean(),
    createdByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_and_createdAt", ["status", "createdAt"])
    .index("by_fileHash", ["fileHash"]),
  paymentImportRows: defineTable({
    batchId: v.id("paymentImportBatches"),
    rowNumber: v.number(),
    idempotencyKey: v.string(),
    studentNumber: v.string(),
    amountMinor: v.number(),
    method: paymentMethodValidator,
    paidAt: v.number(),
    validationErrors: v.array(v.string()),
    matchedStudentId: v.optional(v.id("students")),
    matchedChargeId: v.optional(v.id("studentCharges")),
    externalReference: v.optional(v.string()),
    note: v.optional(v.string()),
    paymentId: v.optional(v.id("payments")),
    status: v.union(
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("skipped"),
      v.literal("committed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batchId_and_rowNumber", ["batchId", "rowNumber"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  exams: defineTable({
    examNumber: v.string(),
    courseId: v.id("courses"),
    // Optional during the compatibility window for existing multi-batch exams.
    batchId: v.optional(v.id("batches")),
    nameBn: v.string(),
    nameEn: v.string(),
    examDate: v.string(),
    mode: examModeValidator,
    mcqFullMarksScaled: v.optional(v.number()),
    writtenFullMarksScaled: v.optional(v.number()),
    totalFullMarksScaled: v.number(),
    passMarksScaled: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("marks_initializing"),
      v.literal("marks_entry"),
      v.literal("ready_for_review"),
      v.literal("publication_processing"),
      v.literal("published"),
      v.literal("reopened"),
      v.literal("archived"),
    ),
    publicationVersion: v.number(),
    publishedAt: v.optional(v.number()),
    publishedByAccountId: v.optional(v.id("portalAccounts")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdByAccountId: v.id("portalAccounts"),
    modelVersion: v.optional(v.number()),
    legacyCompatibility: v.optional(v.literal("combined")),
    examType: v.optional(
      v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("model_test"),
        v.literal("term"),
        v.literal("final"),
        v.literal("other"),
      ),
    ),
    startsAtMinutes: v.optional(v.number()),
    endsAtMinutes: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    venue: v.optional(v.string()),
    audienceMode: v.optional(
      v.union(
        v.literal("single_batch"),
        v.literal("selected_batches"),
        v.literal("all_course_batches"),
      ),
    ),
    rosterStatus: v.optional(
      v.union(v.literal("preview"), v.literal("frozen")),
    ),
    rosterFrozenAt: v.optional(v.number()),
    candidateCount: v.optional(v.number()),
    meritMode: v.optional(
      v.union(
        v.literal("official_only"),
        v.literal("official_and_batch"),
        v.literal("none"),
      ),
    ),
    officialMeritScope: v.optional(
      v.union(
        v.literal("batch"),
        v.literal("selected_batches"),
        v.literal("course"),
        v.literal("none"),
      ),
    ),
    rankFailedStudents: v.optional(v.boolean()),
    markingRulesVersion: v.optional(v.number()),
    setupDraftJson: v.optional(v.string()),
    subjectCount: v.optional(v.number()),
    expectedResultCount: v.optional(v.number()),
    completedResultCount: v.optional(v.number()),
  })
    .index("by_courseId_and_examDate", ["courseId", "examDate"])
    .index("by_batchId_and_examDate", ["batchId", "examDate"])
    .index("by_status_and_examDate", ["status", "examDate"])
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_examNumber", ["examNumber"]),

  examSubjects: defineTable({
    examId: v.id("exams"),
    subjectId: v.id("subjects"),
    sortOrder: v.number(),
    mode: v.optional(examModeValidator),
    mcqFullMarksScaled: v.optional(v.number()),
    writtenFullMarksScaled: v.optional(v.number()),
    totalFullMarksScaled: v.optional(v.number()),
    passMarksScaled: v.optional(v.number()),
    mcqPassMarksScaled: v.optional(v.number()),
    writtenPassMarksScaled: v.optional(v.number()),
    isRequired: v.optional(v.boolean()),
  })
    .index("by_examId_and_sortOrder", ["examId", "sortOrder"])
    .index("by_examId_and_subjectId", ["examId", "subjectId"]),
  examBatches: defineTable({ examId: v.id("exams"), batchId: v.id("batches") })
    .index("by_examId", ["examId"])
    .index("by_batchId", ["batchId"])
    .index("by_examId_and_batchId", ["examId", "batchId"]),
  examTeacherAssignments: defineTable({
    examId: v.id("exams"),
    teacherId: v.id("teachers"),
    examSubjectId: v.optional(v.id("examSubjects")),
    batchId: v.optional(v.id("batches")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("submitted"),
        v.literal("returned"),
      ),
    ),
    submittedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    returnReason: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_examId", ["examId"])
    .index("by_teacherId", ["teacherId"])
    .index("by_examId_and_teacherId", ["examId", "teacherId"])
    .index("by_teacherId_and_status", ["teacherId", "status"])
    .index("by_examId_and_examSubjectId", ["examId", "examSubjectId"])
    .index("by_examId_and_examSubjectId_and_batchId", [
      "examId",
      "examSubjectId",
      "batchId",
    ]),

  examCandidates: defineTable({
    examId: v.id("exams"),
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    batchId: v.id("batches"),
    courseId: v.id("courses"),
    includedAt: v.number(),
    source: v.union(
      v.literal("single_batch"),
      v.literal("selected_batches"),
      v.literal("all_course_batches"),
    ),
    excludedAt: v.optional(v.number()),
    exclusionReason: v.optional(v.string()),
    status: v.union(v.literal("included"), v.literal("excluded")),
  })
    .index("by_examId_and_studentId", ["examId", "studentId"])
    .index("by_examId_and_batchId", ["examId", "batchId"])
    .index("by_studentId_and_examId", ["studentId", "examId"])
    .index("by_examId_and_status", ["examId", "status"]),

  examSubjectResults: defineTable({
    examId: v.id("exams"),
    examSubjectId: v.id("examSubjects"),
    candidateId: v.id("examCandidates"),
    studentId: v.id("students"),
    batchId: v.id("batches"),
    participation: v.union(v.literal("present"), v.literal("absent")),
    mcqScoreScaled: v.optional(v.number()),
    writtenScoreScaled: v.optional(v.number()),
    totalScoreScaled: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    entryStatus: v.union(
      v.literal("missing"),
      v.literal("draft"),
      v.literal("submitted"),
    ),
    teacherCommentBn: v.optional(v.string()),
    teacherCommentEn: v.optional(v.string()),
    enteredByAccountId: v.optional(v.id("portalAccounts")),
    enteredAt: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_examId_and_studentId", ["examId", "studentId"])
    .index("by_examSubjectId_and_batchId", ["examSubjectId", "batchId"])
    .index("by_examSubjectId_and_entryStatus", ["examSubjectId", "entryStatus"])
    .index("by_candidateId", ["candidateId"])
    .index("by_candidateId_and_examSubjectId", [
      "candidateId",
      "examSubjectId",
    ]),

  examPublications: defineTable({
    examId: v.id("exams"),
    version: v.number(),
    status: v.union(
      v.literal("processing"),
      v.literal("published"),
      v.literal("superseded"),
    ),
    candidateCount: v.number(),
    passCount: v.number(),
    failCount: v.number(),
    absentCount: v.number(),
    recipientCount: v.optional(v.number()),
    officialMeritScope: v.union(
      v.literal("batch"),
      v.literal("selected_batches"),
      v.literal("course"),
      v.literal("none"),
    ),
    meritMode: v.union(
      v.literal("official_only"),
      v.literal("official_and_batch"),
      v.literal("none"),
    ),
    officialPopulation: v.number(),
    rankFailedStudents: v.boolean(),
    publishedAt: v.number(),
    publishedByAccountId: v.id("portalAccounts"),
    reopenReason: v.optional(v.string()),
  })
    .index("by_examId_and_version", ["examId", "version"])
    .index("by_examId_and_status", ["examId", "status"]),

  examPublishedResults: defineTable({
    publicationId: v.id("examPublications"),
    examId: v.id("exams"),
    version: v.number(),
    candidateId: v.id("examCandidates"),
    studentId: v.id("students"),
    batchId: v.id("batches"),
    grandTotalScaled: v.number(),
    grandFullMarksScaled: v.number(),
    writtenTotalScaled: v.number(),
    mcqTotalScaled: v.number(),
    passed: v.boolean(),
    absent: v.boolean(),
    officialMeritPosition: v.optional(v.number()),
    officialMeritPopulation: v.optional(v.number()),
    batchMeritPosition: v.optional(v.number()),
    batchMeritPopulation: v.optional(v.number()),
    publishedAt: v.number(),
  })
    .index("by_publicationId_and_studentId", ["publicationId", "studentId"])
    .index("by_examId_and_version", ["examId", "version"])
    .index("by_studentId_and_publishedAt", ["studentId", "publishedAt"])
    .index("by_examId_and_version_and_officialMeritPosition", [
      "examId",
      "version",
      "officialMeritPosition",
    ]),

  examPublishedSubjectResults: defineTable({
    publicationId: v.id("examPublications"),
    publishedResultId: v.id("examPublishedResults"),
    examId: v.id("exams"),
    version: v.number(),
    studentId: v.id("students"),
    subjectId: v.id("subjects"),
    subjectNameBn: v.string(),
    subjectNameEn: v.string(),
    sortOrder: v.number(),
    mode: examModeValidator,
    participation: v.union(v.literal("present"), v.literal("absent")),
    mcqScoreScaled: v.optional(v.number()),
    writtenScoreScaled: v.optional(v.number()),
    totalScoreScaled: v.number(),
    totalFullMarksScaled: v.number(),
    passed: v.boolean(),
    teacherCommentBn: v.optional(v.string()),
    teacherCommentEn: v.optional(v.string()),
  })
    .index("by_publishedResultId_and_sortOrder", [
      "publishedResultId",
      "sortOrder",
    ])
    .index("by_examId_and_version_and_studentId", [
      "examId",
      "version",
      "studentId",
    ]),

  examAuditEvents: defineTable({
    examId: v.id("exams"),
    eventType: v.string(),
    publicationVersion: v.optional(v.number()),
    reason: v.optional(v.string()),
    actorAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    metadata: v.optional(v.string()),
  })
    .index("by_examId_and_createdAt", ["examId", "createdAt"])
    .index("by_examId_and_eventType", ["examId", "eventType"]),

  examResults: defineTable({
    examId: v.id("exams"),
    courseId: v.id("courses"),
    studentId: v.id("students"),
    enrolmentId: v.id("enrolments"),
    participation: v.union(v.literal("present"), v.literal("absent")),
    mcqScoreScaled: v.optional(v.number()),
    writtenScoreScaled: v.optional(v.number()),
    totalScoreScaled: v.optional(v.number()),
    passed: v.optional(v.boolean()),
    meritPosition: v.optional(v.number()),
    teacherCommentBn: v.optional(v.string()),
    teacherCommentEn: v.optional(v.string()),
    entryStatus: v.union(
      v.literal("missing"),
      v.literal("draft"),
      v.literal("ready"),
      v.literal("published"),
    ),
    enteredByAccountId: v.optional(v.id("portalAccounts")),
    enteredAt: v.optional(v.number()),
    publicationVersion: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
    publishedParticipation: v.optional(
      v.union(v.literal("present"), v.literal("absent")),
    ),
    publishedMcqScoreScaled: v.optional(v.number()),
    publishedWrittenScoreScaled: v.optional(v.number()),
    publishedTotalScoreScaled: v.optional(v.number()),
    publishedPassed: v.optional(v.boolean()),
    publishedMeritPosition: v.optional(v.number()),
    publishedTeacherCommentBn: v.optional(v.string()),
    publishedTeacherCommentEn: v.optional(v.string()),
  })
    .index("by_examId_and_studentId", ["examId", "studentId"])
    .index("by_examId_and_entryStatus", ["examId", "entryStatus"])
    .index("by_courseId_and_studentId", ["courseId", "studentId"])
    .index("by_studentId_and_publishedAt", ["studentId", "publishedAt"])
    .index("by_examId_and_totalScoreScaled", ["examId", "totalScoreScaled"])
    .index("by_examId_and_entryStatus_and_totalScoreScaled", [
      "examId",
      "entryStatus",
      "totalScoreScaled",
    ]),

  notices: defineTable({
    titleBn: v.string(),
    titleEn: v.string(),
    bodyBn: v.string(),
    bodyEn: v.string(),
    audienceType: v.union(
      v.literal("public"),
      v.literal("all_students"),
      v.literal("course"),
      v.literal("batch"),
      v.literal("individual_students"),
    ),
    courseId: v.optional(v.id("courses")),
    batchId: v.optional(v.id("batches")),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    sendSms: v.boolean(),
    publishedAt: v.optional(v.number()),
    createdByAccountId: v.id("portalAccounts"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_audienceType_and_status", ["audienceType", "status"])
    .index("by_courseId_and_status", ["courseId", "status"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_status_and_publishedAt", ["status", "publishedAt"])
    .index("by_createdByAccountId_and_status", [
      "createdByAccountId",
      "status",
    ]),

  noticeRecipients: defineTable({
    noticeId: v.id("notices"),
    studentId: v.id("students"),
    readAt: v.optional(v.number()),
  })
    .index("by_noticeId", ["noticeId"])
    .index("by_studentId_and_readAt", ["studentId", "readAt"])
    .index("by_noticeId_and_studentId", ["noticeId", "studentId"]),

  smsMessages: defineTable({
    idempotencyKey: v.string(),
    eventType: smsEventTypeValidator,
    relatedEntityType: v.string(),
    relatedEntityId: v.string(),
    studentId: v.optional(v.id("students")),
    guardianPhone: v.string(),
    normalizedRecipient: v.string(),
    locale: localeValidator,
    body: v.string(),
    segmentEstimate: v.number(),
    status: smsStatusValidator,
    provider: v.union(v.literal("sms_bd"), v.literal("bulksmsbd")),
    providerRequestId: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerChargeMinor: v.optional(v.number()),
    attemptCount: v.number(),
    nextAttemptAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    lastErrorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_relatedEntityType_and_relatedEntityId", [
      "relatedEntityType",
      "relatedEntityId",
    ])
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_studentId_and_createdAt", ["studentId", "createdAt"])
    .index("by_providerRequestId", ["providerRequestId"])
    .index("by_eventType_and_createdAt", ["eventType", "createdAt"]),

  smsTemplates: defineTable({
    key: v.string(),
    name: v.string(),
    bodyBn: v.string(),
    bodyEn: v.string(),
    enabled: v.boolean(),
    variables: v.array(v.string()),
    updatedAt: v.number(),
    updatedByAccountId: v.id("portalAccounts"),
  })
    .index("by_key", ["key"])
    .index("by_enabled", ["enabled"]),
  smsProviderSnapshots: defineTable({
    checkedAt: v.number(),
    balanceMinor: v.optional(v.number()),
    providerStatus: v.string(),
    error: v.optional(v.string()),
  }).index("by_checkedAt", ["checkedAt"]),

  siteContentBlocks: defineTable({
    key: v.union(
      v.literal("hero"),
      v.literal("about_summary"),
      v.literal("contact"),
      v.literal("achievement_intro"),
      v.literal("admission_intro"),
      v.literal("footer"),
    ),
    titleBn: v.string(),
    titleEn: v.string(),
    bodyBn: v.string(),
    bodyEn: v.string(),
    primaryCtaLabelBn: v.optional(v.string()),
    primaryCtaLabelEn: v.optional(v.string()),
    primaryCtaHref: v.optional(v.string()),
    mediaStorageId: v.optional(v.id("_storage")),
    draftRevision: v.number(),
    publishedRevision: v.number(),
    status: v.union(v.literal("draft"), v.literal("published")),
    updatedAt: v.number(),
    updatedByAccountId: v.id("portalAccounts"),
  })
    .index("by_key", ["key"])
    .index("by_status", ["status"]),
  siteContentRevisions: defineTable({
    contentBlockId: v.id("siteContentBlocks"),
    revision: v.number(),
    titleBn: v.string(),
    titleEn: v.string(),
    bodyBn: v.string(),
    bodyEn: v.string(),
    primaryCtaLabelBn: v.optional(v.string()),
    primaryCtaLabelEn: v.optional(v.string()),
    primaryCtaHref: v.optional(v.string()),
    mediaStorageId: v.optional(v.id("_storage")),
    publishedAt: v.number(),
    publishedByAccountId: v.id("portalAccounts"),
  }).index("by_contentBlockId_and_revision", ["contentBlockId", "revision"]),
  galleryItems: defineTable({
    titleBn: v.string(),
    titleEn: v.string(),
    imageStorageId: v.id("_storage"),
    altBn: v.string(),
    altEn: v.string(),
    sortOrder: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status_and_sortOrder", ["status", "sortOrder"]),

  auditLogs: defineTable({
    actorAccountId: v.optional(v.id("portalAccounts")),
    actorRole: v.optional(
      v.union(v.literal("owner"), v.literal("teacher"), v.literal("student")),
    ),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    summary: v.string(),
    metadata: v.optional(auditMetadataValidator),
    occurredAt: v.number(),
  })
    .index("by_entityType_and_entityId", ["entityType", "entityId"])
    .index("by_actorAccountId_and_occurredAt", ["actorAccountId", "occurredAt"])
    .index("by_action_and_occurredAt", ["action", "occurredAt"])
    .index("by_occurredAt", ["occurredAt"]),

  dailyOperationalSummaries: defineTable({
    date: v.string(),
    activeStudentCount: v.number(),
    activeBatchCount: v.number(),
    scheduledSessionCount: v.number(),
    submittedSessionCount: v.number(),
    presentCount: v.number(),
    lateCount: v.number(),
    absentCount: v.number(),
    paymentsCount: v.number(),
    collectedMinor: v.number(),
    overdueStudentsCount: v.number(),
    overdueMinor: v.number(),
    activeOutstandingMinor: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_date", ["date"]),
});
