import { expect, test } from "@playwright/test";

test("Preview account creation moves to password sign-in when email verification is disabled", async ({ page }) => {
  await page.route("**/api/auth/sign-up/email", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: null }) });
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Name").fill("Preview tester");
  await page.getByLabel("Email").fill(`preview-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("Synthetic-preview-password-94!");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator(".auth-error")).toContainText("Continue by signing in");
  await expect(page.getByLabel("Password")).toHaveValue("Synthetic-preview-password-94!");
});
