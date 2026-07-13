// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarksWorkspace } from "./MarksWorkspace";

const save = vi.fn(async () => ({ saved: 1, errors: [] }));
const submit = vi.fn(async () => ({ complete: 2, absent: 0 }));
const mutate = vi.fn((args: { rows?: unknown }) =>
  args.rows ? save() : submit(),
);

vi.mock("convex/react", () => ({
  useQuery: () => ({
    assignment: { _id: "assignment", status: "in_progress" },
    subject: {
      mode: "both",
      mcqFullMarksScaled: 4000,
      writtenFullMarksScaled: 6000,
      passMarksScaled: 4000,
    },
    counts: { complete: 1, missing: 1, absent: 0, invalid: 0 },
    batches: [],
    page: [
      {
        result: {
          _id: "result-1",
          participation: "present",
          entryStatus: "draft",
          mcqScoreScaled: 2000,
          writtenScoreScaled: 3000,
          totalScoreScaled: 5000,
        },
        student: { displayName: "Anik Hasan", studentNumber: "S-001" },
      },
      {
        result: {
          _id: "result-2",
          participation: "present",
          entryStatus: "missing",
        },
        student: { displayName: "Nadia Islam", studentNumber: "S-002" },
      },
    ],
    isDone: true,
    continueCursor: "2",
  }),
  useMutation: () => mutate,
}));

describe("MarksWorkspace", () => {
  beforeEach(() => {
    save.mockClear();
    submit.mockClear();
    mutate.mockClear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("provides a one-student mobile workflow with previous and next navigation", () => {
    render(<MarksWorkspace locale="en" assignmentId={"assignment" as never} />);
    const mobile = screen.getByRole("article");
    expect(mobile).toHaveTextContent("Anik Hasan");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(mobile).toHaveTextContent("Nadia Islam");
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("moves through desktop cells with arrow keys and Enter", () => {
    render(<MarksWorkspace locale="en" assignmentId={"assignment" as never} />);
    const participation = screen.getAllByLabelText(
      "Anik Hasan participation",
    )[0];
    const mcq = screen.getAllByLabelText("Anik Hasan MCQ / 40")[0];
    participation.focus();
    fireEvent.keyDown(participation, { key: "ArrowRight" });
    expect(mcq).toHaveFocus();
    fireEvent.keyDown(mcq, { key: "Enter" });
    expect(
      screen.getAllByLabelText("Anik Hasan written / 60")[0],
    ).toHaveFocus();
  });

  it("confirms before clearing existing marks for an absent student", () => {
    render(<MarksWorkspace locale="bn" assignmentId={"assignment" as never} />);
    fireEvent.change(screen.getAllByLabelText("Anik Hasan participation")[0], {
      target: { value: "absent" },
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getAllByLabelText("Anik Hasan MCQ / 40")[0]).toBeDisabled();
  });
});
