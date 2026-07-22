export const SMS_TEMPLATE_DEFAULTS = {
  admission_received: {
    name: "Admission received",
    bodyBn: "{brand}: {studentName}-এর ভর্তি আবেদন গ্রহণ করা হয়েছে। রেফারেন্স: {applicationNumber}",
    bodyEn: "{brand}: Admission application received for {studentName}. Reference: {applicationNumber}",
    allowedVariables: ["brand", "studentName", "applicationNumber"],
  },
  admission_accepted: {
    name: "Admission accepted",
    bodyBn: "{brand}: {studentName}-এর ভর্তি নিশ্চিত হয়েছে। শিক্ষার্থী আইডি: {studentNumber}",
    bodyEn: "{brand}: Admission confirmed for {studentName}. Student ID: {studentNumber}",
    allowedVariables: ["brand", "studentName", "studentNumber"],
  },
  payment_posted: {
    name: "Payment received",
    bodyBn: "{brand}: {studentName}-এর ৳ {amount} পেমেন্ট গ্রহণ করা হয়েছে। রশিদ: {receiptNumber}",
    bodyEn: "{brand}: Payment of BDT {amount} received for {studentName}. Receipt: {receiptNumber}",
    allowedVariables: ["brand", "studentName", "amount", "receiptNumber", "collectionDate"],
  },
  attendance_late: {
    name: "Attendance late",
    bodyBn: "{brand}: {studentName} {classDate} তারিখের {batchName} ক্লাসে বিলম্বে উপস্থিত ছিল।",
    bodyEn: "{brand}: {studentName} was late for {batchName} class on {classDate}.",
    allowedVariables: ["brand", "studentName", "classDate", "attendanceStatus", "batchName"],
  },
  attendance_absent: {
    name: "Attendance absent",
    bodyBn: "{brand}: {studentName} {classDate} তারিখের {batchName} ক্লাসে অনুপস্থিত ছিল।",
    bodyEn: "{brand}: {studentName} was absent from {batchName} class on {classDate}.",
    allowedVariables: ["brand", "studentName", "classDate", "attendanceStatus", "batchName"],
  },
  result_published: { name: "Result published", bodyBn: "{brand}: পরীক্ষার ফল প্রকাশিত হয়েছে।", bodyEn: "{brand}: Exam result published.", allowedVariables: ["brand"] },
  result_corrected: { name: "Result corrected", bodyBn: "{brand}: সংশোধিত পরীক্ষার ফল প্রকাশিত হয়েছে।", bodyEn: "{brand}: Corrected exam result published.", allowedVariables: ["brand"] },
  due_reminder: { name: "Due reminder", bodyBn: "{brand}: {studentName}-এর বকেয়া ৳ {amount}। অনুগ্রহ করে অফিসে যোগাযোগ করুন।", bodyEn: "{brand}: {studentName} has overdue fees of BDT {amount}. Please contact the office.", allowedVariables: ["brand", "studentName", "amount"] },
  custom_notice: { name: "Custom notice", bodyBn: "{brand}: {notice}", bodyEn: "{brand}: {notice}", allowedVariables: ["brand", "notice"] },
} as const;

export type SmsTemplateKey = keyof typeof SMS_TEMPLATE_DEFAULTS;

export const ENABLED_SMS_EVENT_TYPES = new Set<SmsTemplateKey>([
  "admission_received", "admission_accepted", "attendance_late",
  "attendance_absent", "payment_posted", "due_reminder",
]);
