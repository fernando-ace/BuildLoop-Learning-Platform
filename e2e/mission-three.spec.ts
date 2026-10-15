import { expect, test } from "@playwright/test";

async function seedMission2Complete(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("buildloop-learner-v2", JSON.stringify({
      state: { stage: 0, questionsAsked: [], problemChoice: "", selectedFeatures: [], brief: "", promptQuality: { context: 0, behavior: 0, boundaries: 0, verification: 0, total: 0 }, buildIssues: [], testsRun: [], testResults: {}, equipment: [], borrowerInput: "", feedbackChoices: [], iterationChoice: "", iterationTested: false, shipped: false },
      progress: { completed: true, attempts: 1, currentAttempt: 1, latestSkillResults: [], bestSkillResults: [] },
      mission2State: { stage: 10, questionsAsked: [], briefChoices: {}, brief: "", v1Issues: [], selectedEvent: "", joined: true, observedProblem: "confirmation", feedback: "confirmation", v2Changes: ["confirmation"], retestTried: true, retestJoined: true, retested: true, retestPassed: true, shipChoice: "ship" },
      mission2Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      activeMission: 1,
    }));
  });
  await page.reload();
}

async function startMission3(page: import("@playwright/test").Page) {
  await page.getByRole("article", { name: "Mission 3" }).getByRole("button", { name: /Start Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Build, try, improve." })).toBeVisible();
  await page.getByRole("button", { name: "Choose your first instruction" }).click();
}

async function reachVersion1(page: import("@playwright/test").Page, prompt: RegExp) {
  await page.getByRole("button", { name: prompt }).click();
  await page.getByRole("button", { name: "Build version 1" }).click();
  await expect(page.getByRole("heading", { name: "Your AI developer built version 1." })).toBeVisible();
}

test("Mission 3 unlocks after Mission 2, resumes, reviews, retests, and replays a strong path", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("article", { name: /Mission 3 locked/ })).toContainText("Complete Mission 2 to continue");
  await expect(page.locator(".mission-number").allTextContents()).resolves.toEqual(["MISSION 1", "MISSION 2", "MISSION 3", "MISSION 4", "MISSION 5", "MISSION 6 · FINAL PROJECT"]);
  let hubWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(hubWidth.scroll).toBeLessThanOrEqual(hubWidth.client);

  await seedMission2Complete(page);
  const card = page.getByRole("article", { name: "Mission 3" });
  await expect(card).toContainText("Build, Try, Improve");
  await expect(card.getByRole("button", { name: /Start Mission/ })).toBeVisible();
  hubWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(hubWidth.scroll).toBeLessThanOrEqual(hubWidth.client);
  await startMission3(page);
  await reachVersion1(page, /Sam runs a school club/);
  const missionWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(missionWidth.scroll).toBeLessThanOrEqual(missionWidth.client);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission3State.stage).toBe(3);
  await page.getByRole("button", { name: "Mission Hub" }).click();
  await page.getByRole("article", { name: "Mission 3" }).getByRole("button", { name: /Continue Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Your AI developer built version 1." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your AI developer built version 1." })).toBeVisible();
  await page.getByRole("button", { name: "Join Club" }).click();
  await expect(page.getByText(/could not tell if it worked/)).toBeVisible();
  await page.getByRole("button", { name: "Tell the AI what you noticed" }).click();
  await page.getByRole("button", { name: /When I click Join Club/ }).click();
  await page.getByRole("button", { name: "Ask the AI to update it" }).click();
  await expect(page.getByText("Join Club now shows a success message.")).toBeVisible();
  await expect(page.getByText("Meeting date and time", { exact: true })).toBeVisible();
  await expect(page.getByText("Page layout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yes, the change matches" }).click();
  await expect(page.getByRole("button", { name: "Check the retest result" })).toBeDisabled();
  await page.getByRole("button", { name: "Join Club" }).click();
  await expect(page.getByText("You joined the club!")).toBeVisible();
  await page.getByRole("button", { name: "Check the retest result" }).click();
  await expect(page.getByText("RETEST PASSED")).toBeVisible();
  await page.getByRole("button", { name: /Save the photo gallery idea for later/ }).click();
  await expect(page.getByRole("heading", { name: "Your build loop is complete." })).toBeVisible();
  await expect(page.getByText(/You clicked Join Club again and saw a success message/)).toBeVisible();
  await expect(page.getByText(/You recorded the gallery as a future idea/).first()).toBeVisible();
  let after = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(after.mission3Progress.attempts).toHaveLength(1);
  expect(after.progress.attempts).toBe(1);
  expect(after.mission2Progress.attempts).toHaveLength(1);
  await page.getByRole("button", { name: "Return to Missions" }).click();
  await page.getByRole("article", { name: "Mission 3" }).getByRole("button", { name: /Replay Mission/ }).click();
  await expect(page.getByRole("heading", { name: "Build, try, improve." })).toBeVisible();
  after = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(after.mission3State.stage).toBe(1);
  expect(after.mission3Progress.attempts).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test("vague prompts and broad follow-ups create visible gaps and unrelated changes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMission2Complete(page);
  await expect(page.getByRole("article", { name: "Mission 3" })).toBeVisible();
  const hubWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(hubWidth.scroll).toBeLessThanOrEqual(hubWidth.client);
  await startMission3(page);
  await reachVersion1(page, /^Make me a cool website/);
  const missionWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(missionWidth.scroll).toBeLessThanOrEqual(missionWidth.client);
  await expect(page.getByText(/Build note: The club description was missing\./)).toBeVisible();
  await expect(page.getByText(/Build note: The next meeting time was missing\./)).toBeVisible();
  await page.getByRole("button", { name: "Join Club" }).click();
  await page.getByRole("button", { name: "Tell the AI what you noticed" }).click();
  await page.getByRole("button", { name: /Redo the whole website/ }).click();
  await page.getByRole("button", { name: "Ask the AI to update it" }).click();
  await expect(page.getByText(/Page layout changed too/)).toBeVisible();
  await page.getByRole("button", { name: "Not quite" }).click();
  await expect(page.getByRole("button", { name: "Check the retest result" })).toBeDisabled();
  await page.getByRole("button", { name: "Join Club" }).click();
  await page.getByRole("button", { name: "Check the retest result" }).click();
  await expect(page.getByText("RETEST NEEDS WORK")).toBeVisible();
  const retestWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(retestWidth.scroll).toBeLessThanOrEqual(retestWidth.client);
  await expect(pageErrors).toEqual([]);
});
