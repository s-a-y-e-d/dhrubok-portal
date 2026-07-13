// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamCreateWizard } from "./ExamCreateWizard";

const createDraft = vi.fn(async () => "exam-1");
const updateDraft = vi.fn(async () => null);
const mutate = vi.fn(async () => null);

vi.mock("@convex/_generated/api", () => ({
  api: {
    academics: {
      sessions: { list: "sessions" },
      courses: { list: "courses" },
      batches: { list: "batches" },
      subjects: { list: "subjects" },
      teachers: { list: "teachers" },
    },
    exams: {
      exams: {
        createDraft: "createDraft",
        updateDraft: "updateDraft",
        detail: "detail",
      },
      audience: { freezeRoster: "freezeRoster", preview: "preview" },
      subjects: { configure: "configureSubjects" },
      assignments: {
        configure: "configureAssignments",
        openMarksEntry: "openMarksEntry",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string) => {
    if (reference === "sessions")
      return { page: [{ _id: "session-1", nameBn: "২০২৬", nameEn: "2026" }] };
    if (reference === "courses")
      return { page: [{ _id: "course-1", nameBn: "কোর্স", nameEn: "Course" }] };
    if (reference === "batches")
      return { page: [{ _id: "batch-1", nameBn: "ব্যাচ", nameEn: "Batch" }] };
    if (reference === "subjects")
      return { page: [{ _id: "subject-1", nameBn: "গণিত", nameEn: "Math" }] };
    if (reference === "teachers")
      return { page: [{ _id: "teacher-1", displayName: "Teacher" }] };
    if (reference === "detail")
      return {
        exam: { _id: "exam-1", rosterStatus: "preview" },
        subjects: [],
        batches: [],
      };
    if (reference === "preview")
      return { candidateCount: 1, duplicateStudents: [], page: [] };
    return undefined;
  },
  useMutation: (reference: string) => {
    if (reference === "createDraft") return createDraft;
    if (reference === "updateDraft") return updateDraft;
    return mutate;
  },
}));

describe("ExamCreateWizard", () => {
  beforeEach(() => {
    createDraft.mockClear();
    updateDraft.mockClear();
    mutate.mockClear();
  });

  it("preserves basic values when moving forward and back", async () => {
    render(<ExamCreateWizard locale="en" />);
    fireEvent.change(screen.getByLabelText("বাংলা"), {
      target: { value: "মাসিক পরীক্ষা" },
    });
    fireEvent.change(screen.getByLabelText("English"), {
      target: { value: "Monthly exam" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-13" },
    });
    fireEvent.change(screen.getByLabelText("Start time (optional)"), {
      target: { value: "10:00" },
    });
    fireEvent.change(screen.getByLabelText("End time (optional)"), {
      target: { value: "11:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to audience" }),
    );
    await waitFor(() =>
      expect(screen.getByText("2. Audience")).toBeInTheDocument(),
    );
    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ startsAtMinutes: 600, endsAtMinutes: 690 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("বাংলা")).toHaveValue("মাসিক পরীক্ষা");
    expect(screen.getByLabelText("English")).toHaveValue("Monthly exam");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-07-13");
  });
});
