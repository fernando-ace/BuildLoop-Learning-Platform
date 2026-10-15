import { expect, test, type Page } from "@playwright/test";

async function seedMission4Complete(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("buildloop-learner-v2", JSON.stringify({
      state: { stage: 0, questionsAsked: [], problemChoice: "", selectedFeatures: [], brief: "", promptQuality: { context: 0, behavior: 0, boundaries: 0, verification: 0, total: 0 }, buildIssues: [], testsRun: [], testResults: {}, equipment: [], borrowerInput: "", feedbackChoices: [], iterationChoice: "", iterationTested: false, shipped: false },
      progress: { completed: true, attempts: 1, currentAttempt: 1, latestSkillResults: [], bestSkillResults: [] },
      mission2State: { stage: 10 },
      mission2Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      mission3State: { stage: 8 },
      mission3Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      mission4State: { stage: 8 },
      mission4Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      activeMission: 0,
    }));
  });
  await page.reload();
}

async function startMission5(page: Page) {
  await page.getByRole("article", { name: "Mission 5" }).getByRole("button", { name: /Start Mission/ }).click();
  await expect(page.getByRole("heading", { name: "ClubBoard is ready for a closer look." })).toBeVisible();
}

async function reproduceProblem(page: Page) {
  await page.getByRole("button", { name: "Try ClubBoard" }).click();
  await page.getByRole("button", { name: "Join Art Club" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator(".m5-result")).toContainText("Art Club still appears in My Clubs");
  await expect(page.locator(".m5-seats").first()).toContainText("2");
  await page.getByRole("button", { name: "Tell the Builder what happened" }).click();
}

async function retestArtClub(page: Page, expected: "pass" | "fail") {
  await page.getByRole("button", { name: "Join Art Club" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator(".m5-result")).toContainText(expected === "pass" ? "no longer in My Clubs" : /still appears|seat count did not update/);
}

async function checkRobotics(page: Page, expected: "pass" | "fail") {
  await page.getByRole("button", { name: "Check another club" }).click();
  await page.getByRole("button", { name: "Join Robotics Club" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator(".m5-result")).toContainText(expected === "pass" ? "no longer in My Clubs" : "seat count did not update");
  await page.getByRole("button", { name: "Choose what to do" }).click();
}

async function noHorizontalOverflow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 920 });
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
}

test("Mission 5 is locked until Mission 4; strong repair resumes, completes, and replays without losing history", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("article", { name: "Mission 5 locked" })).toContainText("Complete Mission 4 to continue");
  await expect(page.locator(".mission-number").allTextContents()).resolves.toEqual(["MISSION 1", "MISSION 2", "MISSION 3", "MISSION 4", "MISSION 5"]);
  await noHorizontalOverflow(page, 1440);

  await seedMission4Complete(page);
  const card = page.getByRole("article", { name: "Mission 5" });
  await expect(card).toContainText("Something’s Broken");
  await startMission5(page);
  await page.getByRole("button", { name: "Try ClubBoard" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "See what happens when you leave." })).toBeVisible();
  await page.getByRole("button", { name: "Join Art Club" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.locator(".m5-result")).toContainText("Art Club still appears in My Clubs");
  await page.getByRole("button", { name: "Tell the Builder what happened" }).click();
  await page.getByRole("button", { name: /Describe what happened/ }).click();
  await page.getByRole("button", { name: "Build a repair" }).click();
  await expect(page.getByRole("heading", { name: "The Builder made a change." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "The Builder made a change." })).toBeVisible();
  await noHorizontalOverflow(page, 1440);
  await retestArtClub(page, "pass");
  await noHorizontalOverflow(page, 390);
  await checkRobotics(page, "pass");
  await page.getByRole("button", { name: "Share this version" }).click();
  await expect(page.getByRole("heading", { name: "You checked the repair before sharing." })).toBeVisible();
  await expect(page.getByText("You reproduced the problem before asking for a fix.")).toBeVisible();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission5Progress.attempts).toHaveLength(1);
  expect(saved.mission5Progress.latestSkillResults).toHaveLength(7);
  expect(saved.mission5Progress.bestSkillResults.find((skill: { name: string }) => skill.name === "Testing")?.score).toBe(100);
  await page.getByRole("button", { name: "Return to Missions" }).click();
  await expect(page.getByText("5 of 5 missions complete")).toBeVisible();
  await expect(page.getByRole("article", { name: "Mission 5" })).toContainText("Completed");
  await page.getByRole("article", { name: "Mission 5" }).getByRole("button", { name: /Replay Mission/ }).click();
  await expect(page.getByRole("heading", { name: "ClubBoard is ready for a closer look." })).toBeVisible();
  await page.getByRole("button", { name: "Try ClubBoard" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "See what happens when you leave." })).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission5State).toMatchObject({ stage: 2, firstJoined: false, firstLeft: false });
  expect(saved.mission5Progress.attempts).toHaveLength(1);
  await page.getByRole("button", { name: "Join Art Club" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await page.getByRole("button", { name: "Tell the Builder what happened" }).click();
  await page.getByRole("button", { name: /Describe what happened/ }).click();
  await page.getByRole("button", { name: "Build a repair" }).click();
  await retestArtClub(page, "pass");
  await checkRobotics(page, "pass");
  await page.getByRole("button", { name: "Share this version" }).click();
  await expect(page.getByText("Previous attempts (2)")).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission5Progress.attempts.map((item: { number: number }) => item.number)).toEqual([1, 2]);
  expect(errors).toEqual([]);
});

test("vague report leads to an incomplete repair, evidence follow-up, and a verified second build", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission4Complete(page);
  await noHorizontalOverflow(page, 390);
  await startMission5(page);
  await reproduceProblem(page);
  await page.getByRole("button", { name: /Ask for a fix/ }).click();
  await page.getByRole("button", { name: "Build a repair" }).click();
  await expect(page.getByRole("heading", { name: "The Builder made a change." })).toBeVisible();
  await retestArtClub(page, "fail");
  await page.getByRole("button", { name: /Describe the new result/ }).click();
  await expect(page.getByRole("heading", { name: "You showed the Builder what still happened." })).toBeVisible();
  await page.getByRole("button", { name: "Try the second update" }).click();
  await expect(page.getByRole("heading", { name: "Did the follow-up fix it?" })).toBeVisible();
  await retestArtClub(page, "pass");
  await checkRobotics(page, "pass");
  await page.getByRole("button", { name: "Share this version" }).click();
  await expect(page.getByText(/The Builder had less useful evidence/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("implementation guess fixes Art Club partly but breaks another club; learner keeps it in progress", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission4Complete(page);
  await startMission5(page);
  await reproduceProblem(page);
  await page.getByRole("button", { name: /Guess what caused it/ }).click();
  await page.getByRole("button", { name: "Build a repair" }).click();
  await retestArtClub(page, "fail");
  await expect(page.locator(".m5-result")).toContainText("seat count did not update");
  await page.getByRole("button", { name: /Describe the new result/ }).click();
  await page.getByRole("button", { name: "Try the second update" }).click();
  await retestArtClub(page, "pass");
  await checkRobotics(page, "fail");
  await expect(page.getByRole("heading", { name: "Is this version ready to share?" })).toBeVisible();
  await page.getByRole("button", { name: "Ask the Builder for another change" }).click();
  await expect(page.getByRole("heading", { name: "You found what still needs work." })).toBeVisible();
  await expect(page.getByText("You checked Robotics Club and found that its seat count did not update.", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission5Progress.attempts).toHaveLength(1);
  expect(saved.mission5Progress.attempts[0].summary.decision).toContain("Ask the Builder for another change");
  expect(errors).toEqual([]);
});

test("the original bug cannot move to the final decision until its exact steps are retested", async ({ page }) => {
  await seedMission4Complete(page);
  await startMission5(page);
  await reproduceProblem(page);
  await page.getByRole("button", { name: /Describe what happened/ }).click();
  await page.getByRole("button", { name: "Build a repair" }).click();
  await expect(page.getByRole("button", { name: "Check another club" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share this version" })).toHaveCount(0);
  await page.getByRole("button", { name: "Join Art Club" }).click();
  await expect(page.getByRole("button", { name: "Check another club" })).toHaveCount(0);
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check another club" })).toBeVisible();
});
