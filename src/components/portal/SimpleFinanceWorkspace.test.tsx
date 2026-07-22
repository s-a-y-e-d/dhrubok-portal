// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prepare = vi.fn().mockResolvedValue({});
let worklist: Record<string, unknown> | undefined;

vi.mock("convex/react", () => ({
  useMutation: () => prepare,
  useQuery: (_reference: unknown, args: Record<string, unknown> | "skip") =>
    args === "skip"
      ? undefined
      : "limit" in args
        ? worklist
        : {
            courses: [],
            batches: [],
          },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { SimpleFinanceWorkspace } from "./SimpleFinanceWorkspace";

describe("SimpleFinanceWorkspace", () => {
  beforeEach(() => {
    prepare.mockClear();
    worklist = {
      collectedTodayMinor: 0,
      totalDueMinor: 0,
      studentsWithDue: 0,
      futurePaidMonths: 0,
      students: [],
    };
  });

  it("keeps the current worklist mounted while changed filters refetch", () => {
    render(<SimpleFinanceWorkspace locale="en" />);

    expect(screen.getByText("Monthly fee collection")).toBeInTheDocument();

    worklist = undefined;
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Rahim" },
    });
    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "Rahima" },
    });

    expect(screen.getByLabelText("Search")).toHaveValue("Rahima");
    expect(screen.getByText("Monthly fee collection")).toBeInTheDocument();
    expect(screen.getByText("No students found")).toBeInTheDocument();
  });
});
