import { expect, test, type Page } from "@playwright/test";

async function seedMission5Complete(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    const progress = { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] };
    localStorage.setItem("buildloop-learner-v2", JSON.stringify({
      state: { stage: 0, equipment: [] }, progress: { completed: true, attempts: 1, currentAttempt: 1, latestSkillResults: [], bestSkillResults: [] },
      mission2State: { stage: 0 }, mission2Progress: progress, mission2AttemptCount: 1,
      mission3State: { stage: 0 }, mission3Progress: progress,
      mission4State: { stage: 0 }, mission4Progress: progress,
      mission5State: { stage: 0 }, mission5Progress: progress, activeMission: 0,
    }));
  });
  await page.reload();
}

async function startMission6(page: Page) {
  await page.getByRole("article", { name: "Mission 6" }).getByRole("button", { name: "Start Mission" }).click();
  await expect(page.getByRole("heading", { name: "A campus fair is coming up." })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}").activeMission)).toBe(6);
}

async function chooseVersionOne(page: Page, brief: string) {
  await page.getByRole("button", { name: "Who needs to use the signup sheet?" }).click();
  await page.getByRole("button", { name: "How do people sign up today?" }).click();
  await page.getByRole("button", { name: "What goes wrong most often?" }).click();
  await page.getByRole("button", { name: "What does a volunteer need to do?" }).click();
  await page.getByRole("button", { name: "What should happen when a shift is full?" }).click();
  await page.getByRole("button", { name: "Choose a first version" }).click();
  for (const feature of ["Show jobs, times, and open spaces", "Let a volunteer sign up", "Show a clear signup confirmation", "Stop signups when a job is full", "Help organizers spot jobs with no volunteers"]) {
    await page.getByRole("button", { name: new RegExp(feature) }).click();
  }
  await page.getByRole("button", { name: "Brief the Builder" }).click();
  await page.getByRole("button", { name: brief }).click();
  await page.getByRole("button", { name: "Build version 1" }).click();
}

async function testVersionOne(page: Page) {
  await page.getByRole("button", { name: "Sign up Jordan" }).click();
  await page.getByRole("button", { name: "Try this overlapping shift" }).click();
  await page.getByRole("button", { name: "Read what people said" }).click();
}

async function retestOverlap(page: Page) {
  await page.getByRole("button", { name: "Sign up Jordan" }).click();
  await page.getByRole("button", { name: "Try this overlapping shift" }).click();
}

async function noHorizontalOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth, wide: [...document.querySelectorAll<HTMLElement>("body *")].map((element) => ({ tag: element.tagName, className: element.className, text: element.innerText?.slice(0, 50), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) })).filter((item) => item.right > innerWidth + 1).slice(0, 12) }));
  expect(size.scroll, JSON.stringify(size.wide)).toBeLessThanOrEqual(size.client);
}

test("Mission 6 stays locked before Mission 5 and unlocks with its completion", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("article", { name: "Mission 6 locked" })).toContainText("Complete Mission 5");
  await expect(page.locator(".mission-number").allTextContents()).resolves.toContain("MISSION 6 · FINAL PROJECT");
  await seedMission5Complete(page);
  await expect(page.getByRole("article", { name: "Mission 6" })).toContainText("Build It for Real");
  await expect(page.getByRole("article", { name: "Mission 6" }).getByRole("button", { name: "Start Mission" })).toBeVisible();
});

test("strong full project completes, persists, replays, and shows course completion", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission5Complete(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await startMission6(page);
  await chooseVersionOne(page, "Give a clear outcome");
  await testVersionOne(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Two people tried the app." })).toBeVisible();
  await page.getByRole("button", { name: /Jordan · Volunteer/ }).filter({ hasText: "I could sign up for the welcome table" }).click();
  await page.getByRole("button", { name: /Lee · Organizer/ }).filter({ hasText: "I still need to count spaces" }).click();
  await page.getByRole("button", { name: "Set the next goal" }).click();
  await page.getByRole("button", { name: /Fix the shift conflict/ }).click();
  await page.getByRole("button", { name: "Build version 2" }).click();
  await page.getByRole("button", { name: "Try version 2" }).click();
  await retestOverlap(page);
  await page.getByRole("button", { name: "Check one more thing" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Does a full shift stay full?" })).toBeVisible();
  await page.getByRole("button", { name: "Sign up Jordan" }).click();
  await page.getByRole("button", { name: "Try one more signup" }).click();
  await page.getByRole("button", { name: "Decide what ships" }).click();
  await page.getByRole("button", { name: "Share it" }).click();
  await expect(page.getByRole("heading", { name: "You checked it before sharing." })).toBeVisible();
  await expect(page.getByText("ALL SIX MISSIONS COMPLETE")).toBeVisible();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission6Progress.attempts).toHaveLength(1);
  expect(saved.mission6Progress.latestSkillResults).toHaveLength(9);
  expect(saved.mission6Progress.bestSkillResults.find((skill: { name: string }) => skill.name === "Testing")?.score).toBe(100);
  await noHorizontalOverflow(page, 390);
  await noHorizontalOverflow(page, 1440);
  await page.getByRole("button", { name: "Return to Missions" }).click();
  await expect(page.getByText("All six missions complete")).toBeVisible();
  await expect(page.getByText("COURSE COMPLETE")).toBeVisible();
  await page.getByRole("article", { name: "Mission 6" }).getByRole("button", { name: "Replay Mission" }).click();
  await expect(page.getByRole("heading", { name: "The event" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A campus fair is coming up." })).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission6Progress.attempts).toHaveLength(1);
  expect(saved.mission6State).toMatchObject({ stage: 1, questionsAsked: [] });
  expect(errors).toEqual([]);
});

test("vague plan needs an evidence follow-up before the original task passes", async ({ page }) => {
  await seedMission5Complete(page);
  await startMission6(page);
  await chooseVersionOne(page, "Keep it very short");
  await testVersionOne(page);
  await page.getByRole("button", { name: /Could I add a profile photo/ }).click();
  await page.getByRole("button", { name: "Set the next goal" }).click();
  await page.getByRole("button", { name: /Make signup better/ }).click();
  await page.getByRole("button", { name: "Build version 2" }).click();
  await page.getByRole("button", { name: "Try version 2" }).click();
  await retestOverlap(page);
  await page.getByRole("button", { name: "Describe the result" }).click();
  await page.getByRole("button", { name: "Send follow-up and rebuild" }).click();
  await retestOverlap(page);
  await page.getByRole("button", { name: "Check one more thing" }).click();
  await page.getByRole("button", { name: "Sign up Jordan" }).click();
  await page.getByRole("button", { name: "Try one more signup" }).click();
  await expect(page.locator(".m6-product .m5-result").last()).toContainText("stopped");
  await page.getByRole("button", { name: "Decide what ships" }).click();
  await page.getByRole("button", { name: "Make one more focused change" }).click();
  await expect(page.getByText("You held the version for another focused improvement.")).toBeVisible();
});

test("implementation guess repairs the overlap but a nearby check finds the full-shift regression", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission5Complete(page);
  await startMission6(page);
  await chooseVersionOne(page, "Keep it very short");
  await testVersionOne(page);
  await page.getByRole("button", { name: /I could sign up for the welcome table/ }).click();
  await page.getByRole("button", { name: "Set the next goal" }).click();
  await page.getByRole("button", { name: /Hide times that overlap/ }).click();
  await page.getByRole("button", { name: "Build version 2" }).click();
  await page.getByRole("button", { name: "Try version 2" }).click();
  await retestOverlap(page);
  await page.getByRole("button", { name: "Check one more thing" }).click();
  await page.getByRole("button", { name: "Sign up Jordan" }).click();
  await page.getByRole("button", { name: "Try one more signup" }).click();
  await expect(page.locator(".m6-product .m5-result").last()).toContainText("third person was added");
  await page.getByRole("button", { name: "Decide what ships" }).click();
  await page.getByRole("button", { name: "Share it" }).click();
  await expect(page.getByText("You shared even though a check still showed a problem.")).toBeVisible();
  expect(errors).toEqual([]);
});
