import { expect, test, type Page } from "@playwright/test";

async function startProject(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Explore Studio" }).click();
  await page.getByRole("button", { name: "Start a project" }).click();
  await page.getByLabel("Project name").fill("Topic Tracker");
  await page.getByLabel("Who is this for?").fill("Students who study after school");
  await page.getByLabel("What are they trying to do, and what gets in the way?").fill("They lose track of which topics need more practice before a test");
  await page.getByLabel("Why does solving this matter?").fill("They want to use their study time well");
  await page.getByRole("button", { name: "Create project" }).click();
}

test("Studio supports build, try, feedback, iteration, retest, summary, and refresh", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startProject(page);
  await expect(page.getByRole("heading", { name: "Start with one person and one problem." })).toBeVisible();
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Show topics due for review");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByLabel("Feature idea").fill("Add a social study feed");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Move to Later Ideas" }).nth(1).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("What should the person be able to do?").fill("Students can see topics due today and mark a topic practiced");
  await page.getByLabel("What should the Builder keep in mind?").fill("Keep the layout readable on a phone");
  await page.getByLabel("Your Builder instruction").fill("Build a topic review list for students who study after school. They lose track of which topics need more practice. Students can see topics due today and mark a topic practiced. Show topics due for review. Keep the layout readable on a phone.");
  await expect(page.locator(".studio-checks .is-ready")).toHaveCount(5);
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await expect(page.getByText("LOCAL DEMO BUILDER")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Try what was built before asking for changes." })).toBeVisible();
  await page.getByLabel("What did you do?").fill("Opened the topic list and looked for today's topic");
  await page.getByLabel("What did you expect?").fill("See topics due today");
  await page.getByLabel("What happened instead?").fill("The list did not show when the topics were due");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await page.getByLabel("Who shared feedback?").fill("Sam, a student");
  await page.getByLabel("What did they notice or say?").fill("I wanted to see the due date next to each topic");
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await page.getByLabel("What should change next?").fill("Students can see the due date next to every topic");
  await page.getByRole("button", { name: "Build Version 2" }).click();
  await expect(page.getByText("VERSION 2 · WHAT CHANGED")).toBeVisible();
  await page.getByLabel("Repeat: what did you do?").fill("Opened the topic list and checked a due date");
  await page.getByLabel("What did you expect this time?").fill("See each topic's due date");
  await page.getByLabel("What happened?").fill("The due date was visible");
  await page.getByLabel("Check one nearby behavior").fill("Marked a topic practiced; other topics remained in the list");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await expect(page.getByRole("heading", { name: "Look how far your idea came." })).toBeVisible();
  await expect(page.getByText("Sam, a student: I wanted to see the due date next to each topic")).toBeVisible();
  await expect(page.getByText("1 update · 3 observations · 2 versions tested")).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(size[0], `summary horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.getByRole("button", { name: "All Studio projects" }).click();
  await expect(page.getByRole("heading", { name: "Topic Tracker" })).toBeVisible();
  const widths = [390, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(size[0], `horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  expect(errors).toEqual([]);
});

test("Studio gently coaches vague ideas and implementation-first goals", async ({ page }) => {
  await startProject(page);
  await page.getByLabel("What are they trying to do, and what gets in the way?").fill("Build a thing");
  await expect(page.getByRole("status")).toContainText("feature");
  await page.getByLabel("What are they trying to do, and what gets in the way?").fill("They cannot find the right study topic before a test");
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("List study topics");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Make a list of study topics for students.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await page.getByLabel("What did you do?").fill("Opened the list");
  await page.getByLabel("What did you expect?").fill("Find topics due soon");
  await page.getByLabel("What happened instead?").fill("There was no due date");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await page.getByLabel("What should change next?").fill("Add a JavaScript array to store topics");
  await expect(page.getByRole("status")).toContainText("describing the behavior");
  await expect(page.getByRole("button", { name: "Build Version 2" })).toBeEnabled();
});

test("Studio keeps multiple projects and confirms project deletion", async ({ page }) => {
  await startProject(page);
  await page.getByRole("button", { name: "All projects" }).click();
  await page.getByRole("button", { name: "Start a project" }).click();
  await page.getByLabel("Project name").fill("Reading log");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("button", { name: "All projects" }).click();
  await expect(page.getByRole("heading", { name: "Topic Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reading log" })).toBeVisible();
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Topic Tracker" }) }).getByRole("button", { name: "Resume project" }).click();
  await expect(page.getByRole("heading", { name: "Start with one person and one problem." })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByRole("heading", { name: "Reading log" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Topic Tracker" })).toHaveCount(0);
});
