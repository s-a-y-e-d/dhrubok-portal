import { describe, expect, it } from "vitest";
import { resolveSession, slugFrom, validStatus, validView } from "./courseWorkspaceState";

describe("course workspace URL state", () => {
  const sessions = [{ _id: "current", startDate: "2026-01-01", endDate: "2026-12-31" }, { _id: "next", startDate: "2027-01-01", endDate: "2027-12-31" }];
  it("prefers a valid URL session and safely falls back invalid state", () => { expect(resolveSession(sessions, "next", "current", "2026-07-13")._id).toBe("next"); expect(validView("unknown")).toBe("overview"); expect(validStatus("unknown")).toBe("active"); });
  it("resolves the current session and normalizes suggested slugs", () => { expect(resolveSession(sessions, null, null, "2026-07-13")._id).toBe("current"); expect(slugFrom(" SSC 2027 -- Science ")).toBe("ssc-2027-science"); });
});
