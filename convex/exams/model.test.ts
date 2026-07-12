import { describe, expect, it } from "vitest";
import { calculateResult, competitionRanks, resultSmsBody, validateExamMarks } from "./model";

describe("exam result calculations", () => {
  it("validates component totals and computes combined results at the pass boundary", () => {
    expect(() => validateExamMarks({ mode: "both", mcqFullMarksScaled: 4000, writtenFullMarksScaled: 6000, totalFullMarksScaled: 10000, passMarksScaled: 5000 })).not.toThrow();
    expect(calculateResult({ mode: "both", participation: "present", mcqScoreScaled: 2000, writtenScoreScaled: 3000, mcqFullMarksScaled: 4000, writtenFullMarksScaled: 6000, passMarksScaled: 5000 })).toEqual({ totalScoreScaled: 5000, passed: true });
    expect(() => calculateResult({ mode: "both", participation: "present", mcqScoreScaled: 4001, writtenScoreScaled: 3000, mcqFullMarksScaled: 4000, writtenFullMarksScaled: 6000, passMarksScaled: 5000 })).toThrow("MCQ score cannot exceed full marks");
  });

  it("uses competition ranking for ties", () => {
    const ranks = competitionRanks([{ key: "a", totalScoreScaled: 9000 }, { key: "b", totalScoreScaled: 8000 }, { key: "c", totalScoreScaled: 8000 }, { key: "d", totalScoreScaled: 7000 }]);
    expect([ranks.get("a"), ranks.get("b"), ranks.get("c"), ranks.get("d")]).toEqual([1, 2, 2, 4]);
  });

  it("renders localized publication and correction messages", () => {
    expect(resultSmsBody({ locale: "bn", isCorrection: false, examNameBn: "চূড়ান্ত পরীক্ষা", examNameEn: "Final", totalScoreScaled: 8000, totalFullMarksScaled: 10000, passed: true, meritPosition: 2 })).toContain("মেধাস্থান: 2");
    expect(resultSmsBody({ locale: "en", isCorrection: true, examNameBn: "চূড়ান্ত পরীক্ষা", examNameEn: "Final", totalScoreScaled: 4500, totalFullMarksScaled: 10000, passed: false })).toContain("Corrected result");
  });
});
