import { expect, test } from "@playwright/test";

test.describe("DialogModal Accessibility & E2E Behaviors", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      console.log(`BROWSER LOG [${msg.type()}]: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`BROWSER ERROR: ${err.message}`);
    });

    // Navigate to the unauthenticated test modal playground page
    await page.goto("/en/test-modal", { waitUntil: "load", timeout: 60000 });
  });

  test("verifies basic modal flow, focus trapping, escape, scroll locking, and backdrop clicks", async ({ page }) => {
    const openBtn = page.locator("#open-modal-btn");
    const dialog = page.locator("dialog.accessible-dialog");
    const firstInput = page.locator("#modal-first-input");
    const actionBtn = page.locator("#modal-action-btn");
    const closeBtn = page.locator("button[aria-label='Close dialog']");
    const body = page.locator("body");

    // 1. Initial State: dialog closed, no scroll lock
    await expect(dialog).not.toBeVisible();
    await expect(body).not.toHaveClass(/modal-open/);

    // 2. Open Modal with auto-retry click to handle hydration delays
    await expect(async () => {
      await openBtn.click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ intervals: [1000], timeout: 20000 });

    // Verify scroll lock class is applied
    await expect(body).toHaveClass(/modal-open/);

    // Focus should be inside the dialog (by default, browser auto-focuses close button or first focusable element)
    await expect(closeBtn).toBeFocused();

    // 3. Focus Trapping: Tabbing should cycle focus inside modal
    await page.keyboard.press("Tab");
    await expect(firstInput).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(actionBtn).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(closeBtn).toBeFocused();

    // 4. Clicking inside dialog does not close it
    await firstInput.click();
    await expect(dialog).toBeVisible();

    // 5. Clicking backdrop (outside dialog boundaries) closes the modal
    // We target a click outside the dialog bounding box. Let's click at coordinates (10, 10)
    await page.mouse.click(10, 10);
    await expect(dialog).not.toBeVisible();
    await expect(body).not.toHaveClass(/modal-open/);

    // Focus must return to the trigger element (open-modal-btn)
    await expect(openBtn).toBeFocused();

    // 6. Open again and verify Escape key closure via cancel event
    await expect(async () => {
      await openBtn.click();
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ intervals: [1000], timeout: 10000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(openBtn).toBeFocused();
    await expect(body).not.toHaveClass(/modal-open/);
  });
});
