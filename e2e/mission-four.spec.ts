import { createHash } from "node:crypto";
import { expect, test, type TestInfo } from "@playwright/test";
import { initialLearnerProgress } from "../src/lib/learner";
import { initialState } from "../src/lib/missions/the-missing-cameras";
import { initialMission2Progress, initialMission2State } from "../src/lib/missions/the-vague-request";
import { initialMission3Progress, initialMission3State } from "../src/lib/missions/one-prompt-wont-do-it";
import { initialMission4Progress, initialMission4State } from "../src/lib/missions/what-next";
import { initialMission5Progress, initialMission5State } from "../src/lib/missions/something-broken";
import { initialMission6Progress, initialMission6State } from "../src/lib/missions/build-it-for-real";

function authenticatedTestUserId(testInfo: TestInfo) {
  return `e2e-owner-${createHash("sha256").update(testInfo.testId).digest("hex").slice(0, 16)}`;
}

test.describe("authenticated Mission progress sync", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const origin = "http://127.0.0.1:3107";
    const userId = authenticatedTestUserId(testInfo);
    const cleanup = await page.request.delete("/api/test-auth/session", { headers: { origin }, data: { cleanupUserIds: [userId] } });
    expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
    const session = await page.request.post("/api/test-auth/session", { headers: { origin }, data: { userId } });
    expect(session.ok(), await session.text()).toBeTruthy();
  });

  test.afterEach(async ({ page }, testInfo) => {
    const cleanup = await page.request.delete("/api/test-auth/session", {
      headers: { origin: "http://127.0.0.1:3107" },
      data: { cleanupUserIds: [authenticatedTestUserId(testInfo)] },
    });
    expect(cleanup.ok(), await cleanup.text()).toBeTruthy();
  });

  test("cloud-synced Mission 3 completion unlocks and starts Mission 4", async ({ page }) => {
    const origin = "http://127.0.0.1:3107";
    const snapshot = {
      activeMission: 0,
      mission1State: { ...initialState, stage: 9, shipped: true },
      mission1Progress: { ...initialLearnerProgress, completed: true, attempts: 1, currentAttempt: 1 },
      mission2State: { ...initialMission2State, stage: 10 },
      mission2Progress: { ...initialMission2Progress, completed: true },
      mission2AttemptCount: 1,
      mission3State: { ...initialMission3State, stage: 8 },
      mission3Progress: { ...initialMission3Progress, completed: true },
      mission4State: initialMission4State,
      mission4Progress: initialMission4Progress,
      mission5State: initialMission5State,
      mission5Progress: initialMission5Progress,
      mission6State: initialMission6State,
      mission6Progress: initialMission6Progress,
    };
    const seeded = await page.request.put("/api/learner/progress", {
      headers: { origin },
      data: { expectedRevision: null, progress: snapshot },
    });
    expect(seeded.ok(), await seeded.text()).toBeTruthy();

    await page.goto("/");
    const mission4 = page.getByRole("article", { name: "Mission 4" });
    const start = mission4.getByRole("button", { name: "Start Mission" });
    await expect(start).toBeVisible({ timeout: 15_000 });
    await start.click();
    await expect(page.getByRole("heading", { name: "What should we build next?" })).toBeVisible();

    const local = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") ?? "null"));
    expect(local).toMatchObject({ activeMission: 4, mission4State: { stage: 1 } });
    await expect.poll(async () => {
      const response = await page.request.get("/api/learner/progress", { headers: { origin } });
      if (!response.ok()) return null;
      const body = await response.json();
      return body.progress;
    }, { timeout: 5000 }).toMatchObject({ activeMission: 4, mission4State: expect.objectContaining({ stage: 1 }) });
  });
});

async function seedMission3Complete(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("buildloop-learner-v2", JSON.stringify({
      state: { stage: 9, questionsAsked: [], problemChoice: "", selectedFeatures: [], brief: "", promptQuality: { context: 0, behavior: 0, boundaries: 0, verification: 0, total: 0 }, buildIssues: [], testsRun: [], testResults: {}, equipment: [], borrowerInput: "", feedbackChoices: [], iterationChoice: "", iterationTested: false, shipped: true },
      progress: { completed: true, attempts: 1, currentAttempt: 1, latestSkillResults: [], bestSkillResults: [] },
      mission2State: { stage: 10 },
      mission2Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      mission3State: { stage: 8 },
      mission3Progress: { completed: true, attempts: [{ number: 1, skills: [], summary: {} }], latestSkillResults: [], bestSkillResults: [] },
      activeMission: 0,
    }));
  });
  await page.reload();
}

async function startMission4(page: import("@playwright/test").Page) {
  await page.getByRole("article", { name: "Mission 4" }).getByRole("button", { name: /Start Mission/ }).click();
  await expect(page.getByRole("heading", { name: "What should we build next?" })).toBeVisible();
}

async function choosePlanAndGoal(page: import("@playwright/test").Page, planning: RegExp, goal: RegExp) {
  await page.getByRole("button", { name: "Think about what matters" }).click();
  await page.getByRole("button", { name: planning }).click();
  await expect(page.getByText("Thinking assistant")).toBeVisible();
  await page.getByRole("button", { name: "Choose the Builder’s goal" }).click();
  await page.getByRole("button", { name: goal }).click();
  await page.getByRole("button", { name: "Build version 2" }).click();
}

async function dimensions(page: import("@playwright/test").Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
}

test("Mission 4 locks until Mission 3 is done, then saves, resumes, completes, and replays the strong path", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole("article", { name: "Mission 4 locked" })).toContainText("Complete Mission 3 to continue");
  await seedMission3Complete(page);
  await expect.poll(() => page.locator(".mission-number").allTextContents()).toEqual(["MISSION 1", "MISSION 2", "MISSION 3", "MISSION 4", "MISSION 5", "MISSION 6 · FINAL PROJECT"]);
  await dimensions(page, 1440);
  await startMission4(page);
  await choosePlanAndGoal(page, /Which problem matters most/, /Let students leave a session/);
  await expect(page.getByText(/The Builder says it’s ready/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "The Builder says it’s ready." })).toBeVisible();
  await dimensions(page, 1440);
  await page.getByRole("button", { name: "Join session" }).first().click();
  await page.getByRole("button", { name: "Leave Algebra together" }).click();
  await expect(page.getByText(/open-seat count is back to 4/)).toBeVisible();
  await page.getByRole("button", { name: "Tell the Builder what you noticed" }).click();
  await page.getByRole("button", { name: /I joined Algebra, then left/ }).click();
  await page.getByRole("button", { name: "Send one follow-up" }).click();
  await expect(page.getByRole("button", { name: "Decide what to do next" })).toBeDisabled();
  await page.getByRole("button", { name: "Join session" }).first().click();
  await expect(page.getByRole("button", { name: "Decide what to do next" })).toBeDisabled();
  await page.getByRole("button", { name: "Leave Algebra together" }).click();
  await dimensions(page, 390);
  await page.getByRole("button", { name: "Decide what to do next" }).click();
  await page.getByRole("button", { name: "Share it" }).click();
  await expect(page.getByRole("heading", { name: "You checked a version that works." })).toBeVisible();
  await expect(page.getByText("You used what a student said to choose the next useful change.")).toBeVisible();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission4Progress.attempts).toHaveLength(1);
  expect(saved.mission4Progress.latestSkillResults).toHaveLength(9);
  await page.getByRole("button", { name: "Return to Missions" }).click();
  await expect(page.getByText("4 of 6 missions complete")).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.state.stage).toBe(9);
  await page.reload();
  await expect(page.getByRole("article", { name: "Mission 4" })).toContainText("Completed");
  await page.getByRole("article", { name: "Mission 4" }).getByRole("button", { name: /Replay Mission/ }).click();
  await expect(page.getByRole("heading", { name: "What should we build next?" })).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-learner-v2") || "{}"));
  expect(saved.mission4State).toMatchObject({ stage: 1, planning: "", goal: "" });
  expect(saved.mission4Progress.attempts).toHaveLength(1);
  await expect(page.getByRole("article", { name: "Mission 4 locked" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a vague goal cannot pass by reading the report; the learner must repeat the action", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission3Complete(page);
  await dimensions(page, 390);
  await startMission4(page);
  await choosePlanAndGoal(page, /ten fun features/, /^Make StudySpot better/);
  await expect(page.getByText(/tidied signup labels/)).toBeVisible();
  await page.getByRole("button", { name: "Join session" }).first().click();
  await expect(page.getByRole("button", { name: "I can’t find a way to leave" })).toBeVisible();
  await page.getByRole("button", { name: "I can’t find a way to leave" }).click();
  await page.getByRole("button", { name: "Tell the Builder what you noticed" }).click();
  await page.getByRole("button", { name: /It still feels broken/ }).click();
  await page.getByRole("button", { name: "Send one follow-up" }).click();
  await expect(page.getByRole("button", { name: "Decide what to do next" })).toBeDisabled();
  await page.getByRole("button", { name: "Join session" }).first().click();
  await expect(page.getByRole("button", { name: "I can’t find a way to leave" })).toBeVisible();
  await page.getByRole("button", { name: "I can’t find a way to leave" }).click();
  await page.getByRole("button", { name: "Decide what to do next" }).click();
  await page.getByRole("button", { name: "Keep improving" }).click();
  await expect(page.getByRole("heading", { name: "You found what still needs work." })).toBeVisible();
  await expect(page.getByText(/You repeated the task, but the seat count was still wrong/)).toBeVisible();
  await dimensions(page, 1440);
  expect(errors).toEqual([]);
});

test("a broad build misses the seat count, and focused feedback fixes it without removing added features", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedMission3Complete(page);
  await startMission4(page);
  await choosePlanAndGoal(page, /redesign the whole app/, /Add chat, profiles/);
  await page.getByRole("button", { name: "Join session" }).first().click();
  await page.getByRole("button", { name: "Leave Algebra together" }).click();
  await expect(page.getByText(/open-seat count is still 3/)).toBeVisible();
  await expect(page.getByText("Student chat")).toBeVisible();
  await page.getByRole("button", { name: "Tell the Builder what you noticed" }).click();
  await page.getByRole("button", { name: /I joined Algebra, then left/ }).click();
  await page.getByRole("button", { name: "Send one follow-up" }).click();
  await expect(page.getByRole("heading", { name: "The Builder made an update." })).toBeVisible();
  await expect(page.getByText("Student chat")).toBeVisible();
  await page.getByRole("button", { name: "Join session" }).first().click();
  await page.getByRole("button", { name: "Leave Algebra together" }).click();
  await expect(page.getByText(/open-seat count is back to 4/)).toBeVisible();
  await page.getByRole("button", { name: "Decide what to do next" }).click();
  await page.getByRole("button", { name: "Share it" }).click();
  await expect(page.getByRole("heading", { name: "You checked a version that works." })).toBeVisible();
  await expect(page.getByText(/Extra features made the update wider/)).toBeVisible();
  expect(errors).toEqual([]);
});
