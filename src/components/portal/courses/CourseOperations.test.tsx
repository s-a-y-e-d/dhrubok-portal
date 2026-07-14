// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BatchActions, SubjectTeacherActions, ScheduleActions } from "./CourseOperations";
import { useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue({})),
}));

describe("CourseOperations Component Tests", () => {
  const mockBatches = [
    {
      batchId: "batch-1" as Id<"batches">,
      code: "B01",
      nameBn: "ব্যাচ ১",
      nameEn: "Batch 1",
      status: "completed" as const,
      admissionOpen: false,
    },
  ];

  const mockCoverage = {
    subjects: [
      { subjectId: "subj-1" as Id<"subjects">, nameBn: "গণিত", nameEn: "Math", sortOrder: 0 }
    ],
    batches: [
      { batchId: "batch-1" as Id<"batches">, nameBn: "ব্যাচ ১", nameEn: "Batch 1" }
    ],
    assignments: [
      { assignmentId: "assign-1" as Id<"teacherBatchAssignments">, batchId: "batch-1" as Id<"batches">, subjectId: "subj-1" as Id<"subjects">, teacherId: "teach-1" as Id<"teachers">, teacherName: "রহমান সাহেব" }
    ],
  };

  const mockSchedules = [
    {
      scheduleId: "sched-1" as Id<"batchSchedules">,
      batchId: "batch-1" as Id<"batches">,
      teacherId: "teach-1" as Id<"teachers">,
      subjectId: "subj-1" as Id<"subjects">,
      weekday: 0, // Sunday
      startMinutes: 600,
      endMinutes: 660,
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    };

    vi.mocked(useQuery).mockImplementation((...args: unknown[]) => {
      const apiEndpoint = args[0] as Record<symbol, string> | undefined;
      if (!apiEndpoint) return null;
      const fnSymbol = Symbol.for("functionName");
      const endpointName = apiEndpoint[fnSymbol] || "";
      if (endpointName.includes("subjects") && endpointName.includes("list")) return { page: [] };
      if (endpointName.includes("teachers") && endpointName.includes("list")) return { page: [] };
      if (endpointName.includes("listSubjects")) return [{ _id: "link-1", subjectId: "subj-1" }];
      if (endpointName.includes("previewConflicts")) return [];
      return null;
    });
  });

  it("renders BatchActions with localized status badge in batch list", () => {
    render(
      <BatchActions
        locale="bn"
        courseId={"course-1" as Id<"courses">}
        sessionId={"sess-1" as Id<"academicSessions">}
        readOnly={false}
        batches={mockBatches}
      />
    );

    // Status completed should be localized to "সম্পন্ন"
    const statusPill = screen.getByText("সম্পন্ন");
    expect(statusPill).toBeInTheDocument();
  });

  it("renders BatchActions and triggers ConfirmModal when clicking archive button", () => {
    render(
      <BatchActions
        locale="en"
        courseId={"course-1" as Id<"courses">}
        sessionId={"sess-1" as Id<"academicSessions">}
        readOnly={false}
        batches={mockBatches}
      />
    );

    // Open Batch lifecycle accordion
    const trigger = screen.getByText(/Batch lifecycle/i);
    fireEvent.click(trigger);

    const archiveBtn = screen.getByRole("button", { name: "Archive" });
    fireEvent.click(archiveBtn);

    // ConfirmModal should pop up
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Archive batch?")).toBeInTheDocument();
  });

  it("renders SubjectTeacherActions and triggers ConfirmModal when unlinking subject", () => {
    render(
      <SubjectTeacherActions
        locale="en"
        courseId={"course-1" as Id<"courses">}
        readOnly={false}
        coverage={mockCoverage}
      />
    );

    // Open Unlink subject accordion
    const trigger = screen.getByText(/Unlink subject/i);
    fireEvent.click(trigger);

    const unlinkBtn = screen.getByRole("button", { name: "Unlink" });
    fireEvent.click(unlinkBtn);

    // ConfirmModal should pop up
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Unlink subject?")).toBeInTheDocument();
  });

  it("renders ScheduleActions and displays localized weekday name", () => {
    render(
      <ScheduleActions
        locale="bn"
        readOnly={false}
        coverage={mockCoverage}
        schedules={mockSchedules}
      />
    );

    // Sunday (weekday=0) should be localized to "রবি" in dropdown options
    const weekdaySelect = screen.getByLabelText(/দিন/i);
    expect(weekdaySelect).toBeInTheDocument();

    const optionSun = screen.getByRole("option", { name: "রবি" });
    expect(optionSun).toBeInTheDocument();
  });
});
