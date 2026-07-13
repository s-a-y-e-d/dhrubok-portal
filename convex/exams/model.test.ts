import { describe, expect, it } from "vitest";
import {
  aggregateExamResult,
  calculateSubjectResult,
  competitionMeritRanks,
  validateSubjectRule,
} from "./model";

describe("exam subject rules", () => {
  it("enforces overall and component pass marks", () => {
    const rule = {
      mode: "both" as const,
      mcqFullMarksScaled: 4000,
      writtenFullMarksScaled: 6000,
      totalFullMarksScaled: 10000,
      passMarksScaled: 5000,
      mcqPassMarksScaled: 1600,
      writtenPassMarksScaled: 2400,
      isRequired: true,
    };
    expect(
      calculateSubjectResult({
        ...rule,
        participation: "present",
        mcqScoreScaled: 1500,
        writtenScoreScaled: 4000,
      }),
    ).toMatchObject({ totalScoreScaled: 5500, passed: false });
    expect(
      calculateSubjectResult({
        ...rule,
        participation: "present",
        mcqScoreScaled: 2000,
        writtenScoreScaled: 3000,
      }),
    ).toMatchObject({ totalScoreScaled: 5000, passed: true });
    expect(() =>
      calculateSubjectResult({
        ...rule,
        participation: "absent",
        mcqScoreScaled: 0,
      }),
    ).toThrow("Absent students cannot have component scores");
  });

  it("rejects impossible component pass rules", () => {
    expect(() =>
      validateSubjectRule({
        mode: "written",
        writtenFullMarksScaled: 5000,
        totalFullMarksScaled: 5000,
        passMarksScaled: 2000,
        writtenPassMarksScaled: 5001,
        isRequired: true,
      }),
    ).toThrow("cannot exceed");
  });
});

describe("exam aggregation and ranking", () => {
  it("fails an exam when a required subject fails", () => {
    expect(
      aggregateExamResult([
        {
          isRequired: true,
          participation: "present",
          totalScoreScaled: 7000,
          totalFullMarksScaled: 10000,
          writtenScoreScaled: 5000,
          mcqScoreScaled: 2000,
          passed: true,
        },
        {
          isRequired: true,
          participation: "present",
          totalScoreScaled: 3000,
          totalFullMarksScaled: 10000,
          writtenScoreScaled: 2000,
          mcqScoreScaled: 1000,
          passed: false,
        },
      ]),
    ).toMatchObject({
      grandTotalScaled: 10000,
      grandFullMarksScaled: 20000,
      passed: false,
    });
  });

  it("uses written then MCQ tie-breakers and competition ranks", () => {
    const ranks = competitionMeritRanks([
      {
        key: "a",
        totalScoreScaled: 9000,
        writtenTotalScaled: 5000,
        mcqTotalScaled: 4000,
      },
      {
        key: "b",
        totalScoreScaled: 8000,
        writtenTotalScaled: 5000,
        mcqTotalScaled: 3000,
      },
      {
        key: "c",
        totalScoreScaled: 8000,
        writtenTotalScaled: 5000,
        mcqTotalScaled: 3000,
      },
      {
        key: "d",
        totalScoreScaled: 8000,
        writtenTotalScaled: 4000,
        mcqTotalScaled: 4000,
      },
    ]);
    expect([
      ranks.get("a"),
      ranks.get("b"),
      ranks.get("c"),
      ranks.get("d"),
    ]).toEqual([1, 2, 2, 4]);
  });
});
