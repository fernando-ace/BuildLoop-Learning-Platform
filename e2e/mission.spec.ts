import { expect, test } from "@playwright/test";

test("plays the full first mission, finds a defect, fixes it, and ships", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  const desktopWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(desktopWidth.scroll).toBeLessThanOrEqual(desktopWidth.client);
  await page.getByRole("button", { name: /Start Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();

  await page.getByRole("button", { name: /What goes wrong most often/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await expect(page.getByText(/spend half a meeting/)).toBeVisible();
  await page.getByRole("button", { name: /Who needs to use this/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /I have enough to continue/ }).click();

  await page.getByRole("button", { name: /Ari cannot quickly tell/ }).click();
  await page.getByRole("button", { name: /Choose what to build first/ }).click();
  for (const feature of ["View equipment list", "Check out an item", "Enter borrower name", "Return an item", "Save after refresh"]) {
    await page.getByRole("button", { name: new RegExp(feature) }).click();
  }
  await expect(page.getByText("2 choices left")).toBeVisible();
  const accounts = page.getByRole("button", { name: /Member accounts/ });
  await accounts.click();
  await expect(page.getByRole("button", { name: /Too many choices/ })).toBeDisabled();
  await accounts.click();
  await page.getByRole("button", { name: /Give the AI a goal/ }).click();

  await page.getByLabel("YOUR REQUEST TO THE AI").fill("Build an equipment tracker for Ari's photography club. Members can check out an item with a borrower name and return it. Keep it simple; do not add reservations. Test checkout and return, and done when state stays after refresh.");
  await expect(page.getByText("Included").first()).toBeVisible();
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
  await expect(page.getByText("WHAT YOU TOLD THE AI")).toBeVisible();
  await expect(page.getByText("WHAT YOUR CHOICES TAUGHT YOU")).toBeVisible();
  await expect(page.getByText(/Observed Ari pause while returning gear/).last()).toBeVisible();
  await page.getByRole("button", { name: /Return to Missions/ }).click();
  await expect(page.getByRole("heading", { name: "Learn to build real things with AI." })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Mission 2" })).toContainText("The Vague Request");
  await expect(page.getByText("Strong").first()).toBeVisible();
  const progressAfterCompletion = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}").progress);
  expect(progressAfterCompletion.completed).toBe(true);
  expect(progressAfterCompletion.attempts).toBe(1);
  await page.getByRole("button", { name: /Replay Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();
  await expect(page.getByText("What do you want to ask?")).toBeVisible();
  const progressAfterReplay = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}").progress);
  expect(progressAfterReplay.completed).toBe(true);
  expect(progressAfterReplay.attempts).toBe(2);
  expect(progressAfterReplay.latestSkillResults).toHaveLength(8);
  expect(pageErrors).toEqual([]);
});

async function unlockMission2(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("buildloop-learner-v2", JSON.stringify({
      state: { stage: 0, questionsAsked: [], problemChoice: "", selectedFeatures: [], brief: "", promptQuality: { context: 0, behavior: 0, boundaries: 0, verification: 0, total: 0 }, buildIssues: [], testsRun: [], testResults: {}, equipment: [], borrowerInput: "", feedbackChoices: [], iterationChoice: "", iterationTested: false, shipped: false },
      progress: { completed: true, attempts: 1, currentAttempt: 1, latestSkillResults: [], bestSkillResults: [] },
    }));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: /Start Mission/ })).toBeVisible();
  await page.getByRole("article", { name: "Mission 2" }).getByRole("button", { name: /Start Mission/ }).click();
}

test("Mission 2 happy path builds, tests, iterates, retests, and persists the summary on mobile", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockMission2(page);
  const noOverflow = async () => {
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
  };
  await noOverflow();
  for (const question of ["What do students need to see?", "What should students be able to do?", "Do students need accounts?"]) {
    await page.getByRole("button", { name: new RegExp(question) }).click();
  }
  await noOverflow();
  await expect(page.getByText(/Not for the first version/)).toBeVisible();
  await page.getByRole("button", { name: /Build the first brief/ }).click();
  await noOverflow();
  for (const choice of ["Students in Maya's volunteer club", "Event details and signups get lost across messages", "A simple mobile-friendly web app", "Show event date, time, place, and description", "Let a student join an event with their name", "Let organizers see the signup list", "Keep this first version simple", "A student can find an event, sign up, and see confirmation"]) {
    await page.getByRole("button", { name: new RegExp(choice) }).click();
  }
  await page.getByRole("button", { name: /Review my brief/ }).click();
  await expect(page.getByText(/Students join an event/)).toBeVisible();
  await page.getByRole("button", { name: /Build version 1/ }).click();
  await noOverflow();
  await page.getByRole("button", { name: /View event|Details/ }).first().click();
  await page.getByLabel("Your name").fill("Jordan");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page.getByText(/did not confirm the event/)).toBeVisible();
  await noOverflow();
  await page.getByRole("button", { name: /What went wrong/ }).click();
  await page.getByRole("button", { name: /Jordan clicked Sign Up but got no confirmation/ }).click();
  await noOverflow();
  await page.getByRole("button", { name: /After Sign Up, show the event name/ }).click();
  await page.getByRole("button", { name: /Ask the AI to update it/ }).click();
  await expect(page.getByText(/Jordan sees: You’re signed up/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "The AI made a focused change." })).toBeVisible();
  await noOverflow();
  await page.getByRole("button", { name: /Retest Jordan.s task/ }).click();
  await page.getByRole("button", { name: "Sign Jordan up" }).click();
  await page.getByRole("button", { name: "Check the result" }).click();
  await expect(page.getByRole("heading", { name: "Jordan’s task works now." })).toBeVisible();
  await page.getByRole("button", { name: /Ship the focused first version/ }).click();
  await expect(page.getByRole("heading", { name: "You shipped a better brief." })).toBeVisible();
  await expect(page.getByText(/What version 1 got wrong/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission2Progress.completed).toBe(true);
  expect(saved.mission2Progress.attempts).toHaveLength(1);
  expect(saved.mission2Progress.latestSkillResults).toHaveLength(8);
  await page.getByRole("button", { name: "Return to Missions" }).click();
  await expect(page.getByRole("article", { name: "Mission 3" })).toContainText("Build, Try, Improve");
  await expect(page.getByRole("article", { name: "Mission 3" }).getByRole("button", { name: /Start Mission/ })).toBeVisible();
  await page.getByRole("article", { name: "Mission 2" }).getByRole("button", { name: /Replay Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Start with Maya’s request." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Start with Maya’s request." })).toBeVisible();
  const afterReplay = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(afterReplay.mission2Progress.attempts).toHaveLength(1);
  expect(afterReplay.mission2Progress.attempts[0].number).toBe(1);
  expect(afterReplay.mission2AttemptCount).toBe(2);
  expect(pageErrors).toEqual([]);
});

test("Mission 2 weak choices lead to missing behavior and vague feedback does not fix it", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await unlockMission2(page);
  await page.getByRole("button", { name: /Do students need accounts/ }).click();
  await page.getByRole("button", { name: /What can wait until later/ }).click();
  await page.getByRole("button", { name: /Build the first brief/ }).click();
  await page.getByRole("button", { name: /Anyone on campus/ }).click();
  await page.getByRole("button", { name: /The club needs more events/ }).click();
  await page.getByRole("button", { name: /A full native app/ }).click();
  await page.getByRole("button", { name: /Add a social feed/ }).click();
  await page.getByRole("button", { name: /Build every feature now/ }).click();
  await page.getByRole("button", { name: /The app looks polished/ }).click();
  await page.getByRole("button", { name: /Review my brief/ }).click();
  await page.getByRole("button", { name: /Build version 1/ }).click();
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
  await page.getByRole("button", { name: /View event|Details/ }).first().click();
  await page.getByRole("button", { name: /What went wrong/ }).click();
  await page.getByRole("button", { name: /event card is missing details/i }).click();
  await page.getByRole("button", { name: /Make it better/ }).click();
  await page.getByRole("button", { name: /Ask the AI to update it/ }).click();
  await expect(page.getByText(/No visible change/)).toBeVisible();
  await page.getByRole("button", { name: /Retest Jordan.s task/ }).click();
  await page.getByRole("button", { name: "Sign Jordan up" }).click();
  await page.getByRole("button", { name: "Check the result" }).click();
  await expect(page.getByRole("heading", { name: "The retest still found a gap." })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Mission 2 remains locked before Mission 1 completion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("article", { name: "Mission 2 locked" })).toContainText("Complete Mission 1");
  await expect(page.getByRole("article", { name: "Mission 2 locked" }).getByRole("button")).toHaveCount(0);
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
});

test("fresh hub is responsive and saved discovery choices resume after reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("[data-hydrated='true']")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Learn to build real things with AI." })).toBeVisible();
  await expect(page.getByRole("article", { name: /Mission 2 locked/ })).toBeVisible();
  const hubWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(hubWidth.scroll).toBeLessThanOrEqual(hubWidth.client);
  await page.getByRole("button", { name: /Start Mission/ }).click();
  await page.getByRole("button", { name: /What goes wrong most often/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();
  await expect(page.getByText(/spend half a meeting/)).toBeVisible();
  await expect(page.getByRole("button", { name: /What goes wrong most often/ })).toBeDisabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.state.questionsAsked).toEqual(["breaks"]);
  expect(saved.progress.attempts).toBe(1);
});

test("starting over asks for confirmation and creates a fresh attempt", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: /Start Mission/ }).click();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("dialog", { name: "Start fresh?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("dialog", { name: "Start fresh?" }).getByRole("button", { name: "Start over" }).click();
  await expect(page.getByRole("heading", { name: "Learn to build real things with AI." })).toBeVisible();
  await page.getByRole("button", { name: /Start Mission/ }).click();
  await expect(page.getByText("What do you want to ask?")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.state.questionsAsked).toEqual([]);
  expect(saved.progress.attempts).toBe(2);
  expect(saved.progress.completed).toBe(false);
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
  await expectNoOverflow();
  await page.getByRole("button", { name: /Start Mission/ }).click();
  await expectNoOverflow();
  await expect(page.getByRole("heading", { name: "Meet Ari." })).toBeVisible();
  await page.getByRole("button", { name: /What goes wrong most often/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /Who needs to use this/ }).click();
  await page.getByRole("button", { name: /Ask Ari/ }).click();
  await page.getByRole("button", { name: /I have enough to continue/ }).click();
  await expectNoOverflow();
  await page.getByRole("button", { name: /Ari cannot quickly tell/ }).click();
  await page.getByRole("button", { name: /Choose what to build first/ }).click();
  for (const feature of ["View equipment list", "Check out an item", "Enter borrower name", "Return an item", "Save after refresh"]) {
    await page.getByRole("button", { name: new RegExp(feature) }).click();
  }
  await page.getByRole("button", { name: /Give the AI a goal/ }).click();
  await expectNoOverflow();
  await page.getByLabel("YOUR REQUEST TO THE AI").fill("Build for Ari's photography club. Show equipment and checkout with a borrower name or return it with an easy to find button. Keep it small; do not add accounts. Test checkout and return.");
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
