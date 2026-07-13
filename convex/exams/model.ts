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
  if (input.totalFullMarksScaled <= 0)
    throw new Error("Total full marks must be positive");
  if (input.passMarksScaled > input.totalFullMarksScaled)
    throw new Error("Pass marks cannot exceed total full marks");

  if (mode === "mcq") {
    if (
      mcqFullMarksScaled === undefined ||
      writtenFullMarksScaled !== undefined
    )
      throw new Error("MCQ exams require only MCQ full marks");
    assertScaledMark(mcqFullMarksScaled, "MCQ full marks");
    if (mcqFullMarksScaled !== input.totalFullMarksScaled)
      throw new Error("Component full marks must equal total full marks");
  } else if (mode === "written") {
    if (
      writtenFullMarksScaled === undefined ||
      mcqFullMarksScaled !== undefined
    )
      throw new Error("Written exams require only written full marks");
    assertScaledMark(writtenFullMarksScaled, "Written full marks");
    if (writtenFullMarksScaled !== input.totalFullMarksScaled)
      throw new Error("Component full marks must equal total full marks");
  } else {
    if (
      mcqFullMarksScaled === undefined ||
      writtenFullMarksScaled === undefined
    )
      throw new Error("Combined exams require both component full marks");
    assertScaledMark(mcqFullMarksScaled, "MCQ full marks");
    assertScaledMark(writtenFullMarksScaled, "Written full marks");
    if (
      mcqFullMarksScaled + writtenFullMarksScaled !==
      input.totalFullMarksScaled
    )
      throw new Error("Component full marks must equal total full marks");
  }
}

export type SubjectRule = Parameters<typeof validateExamMarks>[0] & {
  mcqPassMarksScaled?: number;
  writtenPassMarksScaled?: number;
  isRequired: boolean;
};

export function validateSubjectRule(rule: SubjectRule) {
  validateExamMarks(rule);
  for (const [label, pass, full] of [
    ["MCQ pass marks", rule.mcqPassMarksScaled, rule.mcqFullMarksScaled],
    [
      "Written pass marks",
      rule.writtenPassMarksScaled,
      rule.writtenFullMarksScaled,
    ],
  ] as const) {
    if (pass === undefined) continue;
    assertScaledMark(pass, label);
    if (full === undefined) throw new Error(`${label} require that component`);
    if (pass > full)
      throw new Error(`${label} cannot exceed component full marks`);
  }
}

export function calculateSubjectResult(
  input: SubjectRule & {
    participation: "present" | "absent";
    mcqScoreScaled?: number;
    writtenScoreScaled?: number;
  },
) {
  validateSubjectRule(input);
  const base = calculateResult(input);
  const componentPassed =
    (input.mcqPassMarksScaled === undefined ||
      (input.mcqScoreScaled ?? 0) >= input.mcqPassMarksScaled) &&
    (input.writtenPassMarksScaled === undefined ||
      (input.writtenScoreScaled ?? 0) >= input.writtenPassMarksScaled);
  return {
    ...base,
    passed: input.participation === "present" && base.passed && componentPassed,
  };
}

export type AggregateSubjectResult = {
  isRequired: boolean;
  participation: "present" | "absent";
  totalScoreScaled: number;
  totalFullMarksScaled: number;
  writtenScoreScaled?: number;
  mcqScoreScaled?: number;
  passed: boolean;
};

export function aggregateExamResult(rows: AggregateSubjectResult[]) {
  if (rows.length === 0)
    throw new Error("At least one subject result is required");
  return {
    grandTotalScaled: rows.reduce((sum, row) => sum + row.totalScoreScaled, 0),
    grandFullMarksScaled: rows.reduce(
      (sum, row) => sum + row.totalFullMarksScaled,
      0,
    ),
    writtenTotalScaled: rows.reduce(
      (sum, row) => sum + (row.writtenScoreScaled ?? 0),
      0,
    ),
    mcqTotalScaled: rows.reduce(
      (sum, row) => sum + (row.mcqScoreScaled ?? 0),
      0,
    ),
    absent: rows.some((row) => row.participation === "absent"),
    passed: rows.filter((row) => row.isRequired).every((row) => row.passed),
  };
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
    if (
      input.mcqScoreScaled !== undefined ||
      input.writtenScoreScaled !== undefined
    )
      throw new Error("Absent students cannot have component scores");
    return { totalScoreScaled: 0, passed: false };
  }

  const needsMcq = input.mode === "mcq" || input.mode === "both";
  const needsWritten = input.mode === "written" || input.mode === "both";
  if (needsMcq !== (input.mcqScoreScaled !== undefined))
    throw new Error(
      needsMcq ? "MCQ score is required" : "MCQ score is not allowed",
    );
  if (needsWritten !== (input.writtenScoreScaled !== undefined))
    throw new Error(
      needsWritten
        ? "Written score is required"
        : "Written score is not allowed",
    );
  if (input.mcqScoreScaled !== undefined) {
    assertScaledMark(input.mcqScoreScaled, "MCQ score");
    if (
      input.mcqFullMarksScaled === undefined ||
      input.mcqScoreScaled > input.mcqFullMarksScaled
    )
      throw new Error("MCQ score cannot exceed full marks");
  }
  if (input.writtenScoreScaled !== undefined) {
    assertScaledMark(input.writtenScoreScaled, "Written score");
    if (
      input.writtenFullMarksScaled === undefined ||
      input.writtenScoreScaled > input.writtenFullMarksScaled
    )
      throw new Error("Written score cannot exceed full marks");
  }
  const totalScoreScaled =
    (input.mcqScoreScaled ?? 0) + (input.writtenScoreScaled ?? 0);
  return {
    totalScoreScaled,
    passed: totalScoreScaled >= input.passMarksScaled,
  };
}

export function competitionRanks(
  rows: Array<{ key: string; totalScoreScaled: number }>,
) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.totalScoreScaled - a.totalScoreScaled || a.key.localeCompare(b.key),
  );
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

export function competitionMeritRanks(
  rows: Array<{
    key: string;
    totalScoreScaled: number;
    writtenTotalScaled: number;
    mcqTotalScaled: number;
  }>,
) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.totalScoreScaled - a.totalScoreScaled ||
      b.writtenTotalScaled - a.writtenTotalScaled ||
      b.mcqTotalScaled - a.mcqTotalScaled ||
      a.key.localeCompare(b.key),
  );
  const ranks = new Map<string, number>();
  let previousTuple = "";
  let rank = 0;
  sorted.forEach((row, index) => {
    const tuple = `${row.totalScoreScaled}:${row.writtenTotalScaled}:${row.mcqTotalScaled}`;
    if (tuple !== previousTuple) rank = index + 1;
    ranks.set(row.key, rank);
    previousTuple = tuple;
  });
  return ranks;
}

export function formatScaledMark(value: number) {
  const exact = value / SCORE_SCALE;
  return Number.isInteger(exact)
    ? String(exact)
    : exact.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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
    const merit = input.meritPosition
      ? ` মেধাস্থান: ${input.meritPosition}।`
      : "";
    return `${heading}: ${input.examNameBn}। নম্বর ${score}/${fullMarks}। ${outcome}।${merit}`;
  }
  const heading = input.isCorrection ? "Corrected result" : "Result";
  const outcome = input.passed ? "Passed" : "Failed";
  const merit = input.meritPosition
    ? ` Merit position: ${input.meritPosition}.`
    : "";
  return `${heading}: ${input.examNameEn}. Score ${score} of ${fullMarks}. ${outcome}.${merit}`;
}
