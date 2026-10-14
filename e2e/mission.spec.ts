import { expect, test } from "@playwright/test";

test("plays the full first mission, finds a defect, fixes it, and ships", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  await page.getByRole("button", { name: "Start the mission" }).click();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();

  await page.getByRole("button", { name: /What goes wrong most often/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await expect(page.getByText(/spend half a meeting/)).toBeVisible();
  await page.getByRole("button", { name: /Who needs to use this/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /I have enough to continue/ }).click();

  await page.getByRole("button", { name: /Ari cannot quickly tell/ }).click();
  await page.getByRole("button", { name: /Choose an MVP/ }).click();
  for (const feature of ["View equipment list", "Check out an item", "Enter borrower name", "Return an item", "Save after refresh"]) {
    await page.getByRole("button", { name: new RegExp(feature) }).click();
  }
  await expect(page.getByText("2 of 7 points left")).toBeVisible();
  const accounts = page.getByRole("button", { name: /Member accounts/ });
  await accounts.click();
  await expect(page.getByRole("button", { name: /Over budget/ })).toBeDisabled();
  await accounts.click();
  await page.getByRole("button", { name: /Write a build brief/ }).click();

  await page.getByLabel("YOUR BUILD BRIEF").fill("Build an equipment tracker for Ari's photography club. Members can check out an item with a borrower name and return it. Keep it simple; do not add reservations. Test checkout and return, and done when state stays after refresh.");
  await expect(page.getByText("Covered").first()).toBeVisible();
  await page.getByRole("button", { name: /Send to the AI/ }).click();
  await expect(page.getByText("Blank borrower names are accepted")).toBeVisible();
  await page.getByRole("button", { name: /Open the product/ }).click();

  await page.getByLabel("Borrower name").fill("Ari");
  await page.getByRole("button", { name: "Check out" }).click();
  await expect(page.getByText("With Ari")).toBeVisible();
  await page.getByRole("button", { name: "Return" }).first().click();
  await expect(page.getByText("Ready to borrow").first()).toBeVisible();
  await page.getByRole("button", { name: "Run test", exact: true }).nth(2).click();
  await expect(page.getByText("The build accepted an empty borrower name.")).toBeVisible();
  await page.getByRole("button", { name: /See what Ari thinks/ }).click();
  await page.getByRole("button", { name: /Ari pauses before returning/ }).click();
  await page.getByRole("button", { name: /Choose an iteration/ }).click();
  await page.getByRole("button", { name: /Make Return easier to find/ }).click();
  await page.getByRole("button", { name: /Retest the change/ }).click();
  await expect(page.getByText("Ari can spot Return without searching.")).toBeVisible();
  await page.getByRole("button", { name: /Ship the product/ }).click();
  await expect(page.getByRole("heading", { name: "You shipped something useful." })).toBeVisible();
  await expect(page.getByText("Builder summary")).toBeVisible();
  await expect(page.getByText(/Observed Ari pause while returning gear/).last()).toBeVisible();
});

test("full mission flow has no horizontal overflow at a narrow mobile width", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  const expectNoOverflow = async () => {
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    const activeStage = await page.evaluate(() => document.querySelector(".progress-step.is-active .progress-label")?.textContent || "complete");
    expect(dimensions.scrollWidth, `horizontal overflow at stage ${activeStage}`).toBeLessThanOrEqual(dimensions.clientWidth);
  };
  await page.getByRole("button", { name: "Start the mission" }).click();
  await expectNoOverflow();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();
  await page.getByRole("button", { name: /What goes wrong most often/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /Who needs to use this/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /I have enough to continue/ }).click();
  await expectNoOverflow();
  await page.getByRole("button", { name: /Ari cannot quickly tell/ }).click();
  await page.getByRole("button", { name: /Choose an MVP/ }).click();
  for (const feature of ["View equipment list", "Check out an item", "Enter borrower name", "Return an item", "Save after refresh"]) {
    await page.getByRole("button", { name: new RegExp(feature) }).click();
  }
  await page.getByRole("button", { name: /Write a build brief/ }).click();
  await expectNoOverflow();
  await page.getByLabel("YOUR BUILD BRIEF").fill("Build for Ari's photography club. Show equipment and checkout with a borrower name or return it with an easy to find button. Keep it small; do not add accounts. Test checkout and return.");
  await page.getByRole("button", { name: /Send to the AI/ }).click();
  await page.getByRole("button", { name: /Open the product/ }).click();
  await expectNoOverflow();
  await page.getByRole("button", { name: /See what Ari thinks/ }).click();
  await page.getByRole("button", { name: /Ari pauses before returning/ }).click();
  await page.getByRole("button", { name: /Choose an iteration/ }).click();
  await page.getByRole("button", { name: /Make Return easier to find/ }).click();
  await page.getByRole("button", { name: /Retest the change/ }).click();
  await expectNoOverflow();
  await page.getByRole("button", { name: /Ship the product/ }).click();
  await expectNoOverflow();
  await expect(page.getByRole("heading", { name: "You shipped something useful." })).toBeVisible();
});
