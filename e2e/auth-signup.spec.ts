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

test("password-reset requests give the same private recovery message", async ({ page }) => {
  const email = "reset-ui@example.test";
  await page.route("**/api/auth/request-password-reset", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ email, redirectTo: "http://127.0.0.1:3107/reset-password" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
  });
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.locator(".auth-error")).toContainText("If that address has a BuildLoop account, a password reset link will be sent.");
});

test("an invalid or expired reset token gives an actionable recovery message", async ({ page }) => {
  await page.route("**/api/auth/reset-password", async (route) => {
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "INVALID_TOKEN" }) });
  });
  await page.goto("/reset-password?token=expired-synthetic-token");
  await page.getByRole("textbox", { name: "New password" }).fill("Replacement-password-394!");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.locator(".auth-error")).toContainText("This reset link is invalid or expired. Request another link and try again.");
});
