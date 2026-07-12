export const SCORE_SCALE = 100;

export type ExamMode = "mcq" | "written" | "both";

export function assertScaledMark(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative scaled integer`);
  }
}

export function validateExamMarks(input: {
  mode: ExamMode;
  mcqFullMarksScaled?: number;
  writtenFullMarksScaled?: number;
  totalFullMarksScaled: number;
  passMarksScaled: number;
}) {
  const { mode, mcqFullMarksScaled, writtenFullMarksScaled } = input;
  assertScaledMark(input.totalFullMarksScaled, "Total full marks");
  assertScaledMark(input.passMarksScaled, "Pass marks");
  if (input.totalFullMarksScaled <= 0) throw new Error("Total full marks must be positive");
  if (input.passMarksScaled > input.totalFullMarksScaled) throw new Error("Pass marks cannot exceed total full marks");

  if (mode === "mcq") {
    if (mcqFullMarksScaled === undefined || writtenFullMarksScaled !== undefined) throw new Error("MCQ exams require only MCQ full marks");
    assertScaledMark(mcqFullMarksScaled, "MCQ full marks");
    if (mcqFullMarksScaled !== input.totalFullMarksScaled) throw new Error("Component full marks must equal total full marks");
  } else if (mode === "written") {
    if (writtenFullMarksScaled === undefined || mcqFullMarksScaled !== undefined) throw new Error("Written exams require only written full marks");
    assertScaledMark(writtenFullMarksScaled, "Written full marks");
    if (writtenFullMarksScaled !== input.totalFullMarksScaled) throw new Error("Component full marks must equal total full marks");
  } else {
    if (mcqFullMarksScaled === undefined || writtenFullMarksScaled === undefined) throw new Error("Combined exams require both component full marks");
    assertScaledMark(mcqFullMarksScaled, "MCQ full marks");
    assertScaledMark(writtenFullMarksScaled, "Written full marks");
    if (mcqFullMarksScaled + writtenFullMarksScaled !== input.totalFullMarksScaled) throw new Error("Component full marks must equal total full marks");
  }
}

export function calculateResult(input: {
  mode: ExamMode;
  participation: "present" | "absent";
  mcqScoreScaled?: number;
  writtenScoreScaled?: number;
  mcqFullMarksScaled?: number;
  writtenFullMarksScaled?: number;
  passMarksScaled: number;
}) {
  if (input.participation === "absent") {
    if (input.mcqScoreScaled !== undefined || input.writtenScoreScaled !== undefined) throw new Error("Absent students cannot have component scores");
    return { totalScoreScaled: 0, passed: false };
  }

  const needsMcq = input.mode === "mcq" || input.mode === "both";
  const needsWritten = input.mode === "written" || input.mode === "both";
  if (needsMcq !== (input.mcqScoreScaled !== undefined)) throw new Error(needsMcq ? "MCQ score is required" : "MCQ score is not allowed");
  if (needsWritten !== (input.writtenScoreScaled !== undefined)) throw new Error(needsWritten ? "Written score is required" : "Written score is not allowed");
  if (input.mcqScoreScaled !== undefined) {
    assertScaledMark(input.mcqScoreScaled, "MCQ score");
    if (input.mcqFullMarksScaled === undefined || input.mcqScoreScaled > input.mcqFullMarksScaled) throw new Error("MCQ score cannot exceed full marks");
  }
  if (input.writtenScoreScaled !== undefined) {
    assertScaledMark(input.writtenScoreScaled, "Written score");
    if (input.writtenFullMarksScaled === undefined || input.writtenScoreScaled > input.writtenFullMarksScaled) throw new Error("Written score cannot exceed full marks");
  }
  const totalScoreScaled = (input.mcqScoreScaled ?? 0) + (input.writtenScoreScaled ?? 0);
  return { totalScoreScaled, passed: totalScoreScaled >= input.passMarksScaled };
}

export function competitionRanks(rows: Array<{ key: string; totalScoreScaled: number }>) {
  const sorted = [...rows].sort((a, b) => b.totalScoreScaled - a.totalScoreScaled || a.key.localeCompare(b.key));
  const ranks = new Map<string, number>();
  let previousScore: number | undefined;
  let previousRank = 0;
  sorted.forEach((row, index) => {
    if (row.totalScoreScaled !== previousScore) previousRank = index + 1;
    ranks.set(row.key, previousRank);
    previousScore = row.totalScoreScaled;
  });
  return ranks;
}

export function formatScaledMark(value: number) {
  const exact = value / SCORE_SCALE;
  return Number.isInteger(exact) ? String(exact) : exact.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function resultSmsBody(input: {
  locale: "bn" | "en";
  isCorrection: boolean;
  examNameBn: string;
  examNameEn: string;
  totalScoreScaled: number;
  totalFullMarksScaled: number;
  passed: boolean;
  meritPosition?: number;
}) {
  const score = formatScaledMark(input.totalScoreScaled);
  const fullMarks = formatScaledMark(input.totalFullMarksScaled);
  if (input.locale === "bn") {
    const heading = input.isCorrection ? "সংশোধিত ফলাফল" : "ফলাফল";
    const outcome = input.passed ? "উত্তীর্ণ" : "অনুত্তীর্ণ";
    const merit = input.meritPosition ? ` মেধাস্থান: ${input.meritPosition}।` : "";
    return `${heading}: ${input.examNameBn}। নম্বর ${score}/${fullMarks}। ${outcome}।${merit}`;
  }
  const heading = input.isCorrection ? "Corrected result" : "Result";
  const outcome = input.passed ? "Passed" : "Failed";
  const merit = input.meritPosition ? ` Merit position: ${input.meritPosition}.` : "";
  return `${heading}: ${input.examNameEn}. Score ${score} of ${fullMarks}. ${outcome}.${merit}`;
}
