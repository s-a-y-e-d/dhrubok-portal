import { describe, expect, it } from "vitest";
import { estimateSmsSegments, renderSmsTemplate } from "./templates";

describe("SMS templates", () => {
  it("renders variables and reports missing values", () => {
    expect(renderSmsTemplate("Dhrubok: {student} paid {amount}", { student: "Rahim", amount: 1500 })).toEqual({ body: "Dhrubok: Rahim paid 1500", missingVariables: [] });
    expect(renderSmsTemplate("Dhrubok: {student}", {})).toEqual({ body: "Dhrubok: {student}", missingVariables: ["student"] });
  });

  it("estimates Latin and Bangla segment boundaries", () => {
    expect(estimateSmsSegments("a".repeat(160))).toMatchObject({ encoding: "gsm", segmentCount: 1 });
    expect(estimateSmsSegments("a".repeat(161))).toMatchObject({ encoding: "gsm", segmentCount: 2 });
    expect(estimateSmsSegments("ক".repeat(70))).toMatchObject({ encoding: "ucs2", segmentCount: 1 });
    expect(estimateSmsSegments("ক".repeat(71))).toMatchObject({ encoding: "ucs2", segmentCount: 2 });
  });
});
