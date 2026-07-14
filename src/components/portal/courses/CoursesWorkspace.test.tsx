// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoursesWorkspace } from "./CoursesWorkspace";
import { useQuery, usePaginatedQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/owner/courses",
  useRouter: () => ({
    push: (url: string) => pushMock(url),
    replace: (url: string) => replaceMock(url),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  usePaginatedQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue({ activated: true, issues: [] })),
}));

describe("CoursesWorkspace UI Component Tests", () => {
  const mockSessions = {
    page: [
      { _id: "sess-1", nameBn: "সেশন ১", nameEn: "Session 1", startDate: "2026-01-01", endDate: "2026-12-31" },
    ],
  };

  const mockCourses = {
    results: [
      {
        courseId: "course-1" as Id<"courses">,
        code: "C01",
        nameBn: "কোর্স ১",
        nameEn: "Course 1",
        status: "active" as const,
        snapshot: { activeEnrolmentCount: 15, academicReady: true },
      },
    ],
    status: "Exhausted" as const,
    loadMore: vi.fn(),
    isLoading: false as const,
  };

  const mockOverview = {
    session: { nameBn: "সেশন ১", nameEn: "Session 1" },
    course: {
      _id: "course-1" as Id<"courses">,
      academicSessionId: "sess-1" as Id<"academicSessions">,
      code: "C01",
      nameBn: "কোর্স ১",
      nameEn: "Course 1",
      status: "active" as const,
      isPublic: true,
    },
    readiness: {
      ready: true,
      feesConfigured: true,
      issues: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("sessionId=sess-1&courseId=course-1&view=overview&status=active");

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
      if (endpointName.includes("sessions")) return mockSessions;
      if (endpointName.includes("getCourseOverview")) return mockOverview;
      if (endpointName.includes("getCourseBatches")) return [];
      if (endpointName.includes("getCoverageMatrix")) return { subjects: [], batches: [], assignments: [] };
      if (endpointName.includes("getScheduleAgenda")) return [];
      if (endpointName.includes("getArchiveBlockers")) return [];
      return null;
    });

    vi.mocked(usePaginatedQuery).mockReturnValue(mockCourses);
  });

  it("renders active course with localized status in the list card", () => {
    render(<CoursesWorkspace locale="bn" />);

    // Status pill text active should be localized to "সক্রিয়" in Bangla
    const statusPills = screen.getAllByText("সক্রিয়");
    expect(statusPills.length).toBeGreaterThan(0);
  });

  it("applies aria-current='true' on the selected course card", () => {
    render(<CoursesWorkspace locale="en" />);

    const courseCardBtn = screen.getByRole("button", { name: /Course 1, C01/i });
    expect(courseCardBtn).toHaveAttribute("aria-current", "true");
  });

  it("renders tabs with correct IDs and aria-controls linking to panels", () => {
    render(<CoursesWorkspace locale="en" />);

    const overviewTab = screen.getByRole("tab", { name: /Overview/i });
    expect(overviewTab).toHaveAttribute("id", "tab-overview");
    expect(overviewTab).toHaveAttribute("aria-controls", "panel-overview");

    const tabpanel = screen.getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("id", "panel-overview");
    expect(tabpanel).toHaveAttribute("aria-labelledby", "tab-overview");
  });

  it("triggers custom ConfirmModal on course complete/archive lifecycle actions", async () => {
    render(<CoursesWorkspace locale="en" />);

    const completeBtn = screen.getByRole("button", { name: /^Complete$/ });
    fireEvent.click(completeBtn);

    // ConfirmModal title should appear
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Complete course?")).toBeInTheDocument();

    // Confirming triggers complete mutation and closes modal
    const confirmBtn = screen.getByRole("button", { name: "Complete course" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("warns about dirty draft status when trying to close course drawer via Cancel button", () => {
    // Render draft view
    mockSearchParams = new URLSearchParams("sessionId=sess-1&status=draft");

    render(<CoursesWorkspace locale="en" />);

    // Open create course drawer
    const newCourseBtn = screen.getByRole("button", { name: /New course/i });
    fireEvent.click(newCourseBtn);

    // Make the form dirty
    const input = screen.getByLabelText(/Bangla name/i);
    fireEvent.change(input, { target: { value: "নতুন কোর্স নাম" } });

    // Click cancel button in drawer
    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // ConfirmModal should show up for dirty form exit
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Discard changes?")).toBeInTheDocument();
  });
});
