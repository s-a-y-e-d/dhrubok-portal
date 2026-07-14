// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExamCreateWizard } from "./ExamCreateWizard";

const createDraft = vi.fn(async () => "exam-1");
const updateDraft = vi.fn(async () => null);
const mutate = vi.fn(async () => null);
const previewArgs: unknown[] = [];

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
  useQuery: (reference: string, args: unknown) => {
    if (reference === "sessions")
      return { page: [{ _id: "session-1", nameBn: "২০২৬", nameEn: "2026" }] };
    if (reference === "courses")
      return { page: [{ _id: "course-1", nameBn: "কোর্স", nameEn: "Course" }] };
    if (reference === "batches")
      return {
        page: [
          { _id: "batch-1", nameBn: "ব্যাচ ১", nameEn: "Batch 1" },
          { _id: "batch-2", nameBn: "ব্যাচ ২", nameEn: "Batch 2" },
        ],
      };
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
    if (reference === "preview") {
      previewArgs.push(args);
      if (args === "skip") return undefined;
      return {
        candidateCount: 1,
        duplicateStudents: [],
        page: [
          {
            student: {
              _id: "student-1",
              studentNumber: "DHR-0001",
              displayName: "Ayan Rahman",
            },
          },
        ],
      };
    }
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
    previewArgs.length = 0;
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

  it("does not preview a single-batch audience until one batch is selected", async () => {
    render(<ExamCreateWizard locale="en" />);
    fireEvent.change(screen.getByLabelText("বাংলা"), {
      target: { value: "পরীক্ষা" },
    });
    fireEvent.change(screen.getByLabelText("English"), {
      target: { value: "Exam" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to audience" }));

    await screen.findByText("2. Audience");
    expect(previewArgs.at(-1)).toBe("skip");

    fireEvent.click(screen.getByRole("radio", { name: "Batch 1" }));
    await waitFor(() =>
      expect(previewArgs.at(-1)).toEqual(
        expect.objectContaining({ batchIds: ["batch-1"] }),
      ),
    );
    expect(screen.queryByLabelText("Search candidates")).not.toBeInTheDocument();
    expect(previewArgs.at(-1)).toEqual(
      expect.objectContaining({
        paginationOpts: { numItems: 500, cursor: null },
      }),
    );
    const disclosure = screen
      .getByText("Exclude students (optional)")
      .closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText("Exclude students (optional)"));
    expect(disclosure).toHaveAttribute("open");
    expect(
      screen.getByRole("checkbox", {
        name: "Exclude: DHR-0001 · Ayan Rahman",
      }),
    ).not.toBeChecked();
  });

  it("does not preview selected batches until at least two are selected", async () => {
    render(<ExamCreateWizard locale="en" />);
    fireEvent.change(screen.getByLabelText("বাংলা"), {
      target: { value: "পরীক্ষা" },
    });
    fireEvent.change(screen.getByLabelText("English"), {
      target: { value: "Exam" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-13" },
    });
    fireEvent.change(screen.getByLabelText("Audience"), {
      target: { value: "selected_batches" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to audience" }));

    await screen.findByText("2. Audience");
    fireEvent.click(screen.getByRole("checkbox", { name: "Batch 1" }));
    expect(previewArgs.at(-1)).toBe("skip");
    fireEvent.click(screen.getByRole("checkbox", { name: "Batch 2" }));
    await waitFor(() =>
      expect(previewArgs.at(-1)).toEqual(
        expect.objectContaining({ batchIds: ["batch-1", "batch-2"] }),
      ),
    );
  });

  it("previews all active course batches without a manual selection", async () => {
    render(<ExamCreateWizard locale="en" />);
    fireEvent.change(screen.getByLabelText("বাংলা"), {
      target: { value: "পরীক্ষা" },
    });
    fireEvent.change(screen.getByLabelText("English"), {
      target: { value: "Exam" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-07-13" },
    });
    fireEvent.change(screen.getByLabelText("Audience"), {
      target: { value: "all_course_batches" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue to audience" }));

    await waitFor(() =>
      expect(previewArgs.at(-1)).toEqual(
        expect.objectContaining({ batchIds: [] }),
      ),
    );
  });
});
