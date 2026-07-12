// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PortalShell } from "./PortalShell";

const push = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/teacher",
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { firstName: "Test", fullName: "Test User", primaryEmailAddress: { emailAddress: "test@example.com" } } }),
  useClerk: () => ({ signOut }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

describe("PortalShell role navigation", () => {
  beforeEach(() => { push.mockClear(); signOut.mockClear(); });

  it("never exposes finance navigation to a teacher", () => {
    render(<PortalShell role="teacher" locale="en"><p>Teacher content</p></PortalShell>);
    expect(screen.getByText("Teacher content")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Finance/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /My batches/i }).length).toBeGreaterThan(0);
  });

  it("shows the student fee and result destinations", () => {
    render(<PortalShell role="student" locale="en"><p>Student content</p></PortalShell>);
    expect(screen.getAllByRole("link", { name: /Fees\/receipts/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Results/i }).length).toBeGreaterThan(0);
  });

  it("shows owner operations without dead hrefs", () => {
    render(<PortalShell role="owner" locale="en"><p>Owner content</p></PortalShell>);
    const academics = screen.getAllByRole("link", { name: /Academics/i })[0];
    expect(academics).toHaveAttribute("href", "/en/owner/courses");
    expect(screen.getAllByRole("link", { name: /Settings/i }).length).toBeGreaterThan(0);
  });

  it("persists dashboard dark mode without changing the public document theme", async () => {
    const user = userEvent.setup();
    render(<PortalShell role="teacher" locale="en"><p>Teacher content</p></PortalShell>);
    const toggle = screen.getAllByRole("button", { name: "Use dark mode" })[0];
    await user.click(toggle);
    expect(toggle.closest("[data-theme]")).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("dhrubok-portal-theme")).toBe("dark");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});
