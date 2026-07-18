// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OwnerSettingsEditor } from "./OwnerWorkspaces";
import { OwnerSettingsEditor as SettingsEditor } from "./OwnerEditors";

const pushStateMock = vi.fn();
const replaceStateMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/owner/settings",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue({})),
}));

import { useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";

describe("Owner Settings Workspace & Access Controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "history", {
      value: {
        pushState: pushStateMock,
        replaceState: replaceStateMock,
      },
      writable: true,
    });
    // mock standard URL search params
    Object.defineProperty(window, "location", {
      value: new URL("http://localhost/en/owner/settings"),
      writable: true,
    });
  });

  it("falls back to operations tab on invalid or empty query param", () => {
    vi.mocked(useQuery).mockReturnValue({
      settingsId: "123" as Id<"coachingSettings">,
      nameBn: "ধ্রুবক",
      nameEn: "Dhrubok",
      shortNameBn: "ধ্রুবক",
      shortNameEn: "Dhrubok",
      monthlyDueDay: 15,
      defaultLocale: "bn",
      defaultGuardianSmsLocale: "bn",
      publicAdmissionsOpen: false,
      smsEnabled: false,
      receiptFooterBn: "ধন্যবাদ",
      receiptFooterEn: "Thanks",
      updatedAt: 1000,
      smsConfigured: true,
      smsSenderIdConfigured: true,
    });

    render(<OwnerSettingsEditor locale="en" />);

    // Tab "Operations Settings" should be selected
    const tab1 = screen.getByRole("tab", { name: "Operations Settings" });
    expect(tab1).toHaveAttribute("aria-selected", "true");
  });

  it("allows access control to render and be visible even when settings are null", () => {
    vi.mocked(useQuery).mockReturnValue(null); // Settings uninitialized

    render(<OwnerSettingsEditor locale="en" />);

    const tabAccess = screen.getByRole("tab", { name: "Access Control" });
    expect(tabAccess).toBeInTheDocument();

    // Switch to access control tab
    fireEvent.click(tabAccess);
    expect(tabAccess).toHaveAttribute("aria-selected", "true");
  });

  it("manages form concurrency warning: clean form updates reactively, dirty form triggers warning banner", () => {
    const settings = {
      settingsId: "123" as Id<"coachingSettings">,
      nameBn: "ধ্রুবক",
      nameEn: "Dhrubok",
      shortNameBn: "ধ্রুবক",
      shortNameEn: "Dhrubok",
      monthlyDueDay: 15,
      defaultLocale: "bn" as const,
      defaultGuardianSmsLocale: "bn" as const,
      publicAdmissionsOpen: false,
      smsEnabled: false,
      receiptFooterBn: "ধন্যবাদ",
      receiptFooterEn: "Thanks",
      updatedAt: 1000,
      smsConfigured: true,
      smsSenderIdConfigured: true,
    };

    const { rerender } = render(
      <SettingsEditor locale="en" settings={settings} />,
    );

    // Modify input (make form dirty)
    const localeInput = screen.getByLabelText(/Interface locale/i);
    fireEvent.change(localeInput, { target: { value: "bn" } });

    // Rerender with a newer updatedAt from query
    const updatedSettings = {
      ...settings,
      monthlyDueDay: 18,
      updatedAt: 2000,
    };

    rerender(<SettingsEditor locale="en" settings={updatedSettings} />);

    // Concurrency warning alert should be rendered
    expect(
      screen.getByText(/Settings were updated by another owner!/i),
    ).toBeInTheDocument();

    // Discard and Reload should restore the server state and clear the warning.
    const reloadBtn = screen.getByRole("button", {
      name: "Reload latest settings",
    });
    fireEvent.click(reloadBtn);
    expect(localeInput).toHaveValue(updatedSettings.defaultLocale);
    expect(
      screen.queryByText(/Settings were updated by another owner!/i),
    ).not.toBeInTheDocument();
  });
});
