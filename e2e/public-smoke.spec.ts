import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("redirects the root to Bangla and renders the public homepage", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/bn$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("পরিকল্পিত শেখা");
  await expect(page.getByRole("link", { name: "ভর্তির আবেদন" }).first()).toBeVisible();
});

test("renders the English locale without serious accessibility violations", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Structured learning");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
});

test("health endpoint is public", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("protected portal routes require Clerk authentication", async ({ page }) => {
  await page.goto("/en/owner");
  await expect(page).toHaveURL(/\/en\/sign-in/);
});

test("public bilingual navigation and admission form remain usable", async ({ page }) => {
  for (const locale of ["bn", "en"] as const) {
    for (const route of ["courses", "teachers", "notices", "about", "contact", "admission"]) {
      await page.goto(`/${locale}/${route}`);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
    }
  }
  await page.goto("/en/admission");
  await expect(page.getByLabel(/Google email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /submit|apply/i })).toBeVisible();
});

test("SEO discovery endpoints are public", async ({ request }) => {
  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain("http");
  }
});
