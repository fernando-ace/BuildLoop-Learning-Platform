import { expect, test } from "@playwright/test";

test("account creation explains verification when signup returns no session token", async ({ page }) => {
  await page.route("**/api/auth/sign-up/email", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: null }) });
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Name").fill("Local signup tester");
  await page.getByLabel("Email").fill(`preview-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("Synthetic-preview-password-94!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("Check your email for a verification link before signing in.");
  await expect(page.getByLabel("Password")).toHaveValue("Synthetic-preview-password-94!");
});
