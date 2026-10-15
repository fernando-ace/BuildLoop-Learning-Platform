import { expect, test, type Page } from "@playwright/test";

async function startProject(page: Page, checkEntryResponsive = false) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Explore Studio" }).click();
  if (checkEntryResponsive) await checkStudioWidths(page, "project list");
  await page.getByRole("button", { name: "Start a project" }).click();
  if (checkEntryResponsive) await checkStudioWidths(page, "new project");
  await page.getByLabel("Project name").fill("Topic Tracker");
  await page.getByLabel("Who is this for?").fill("Students who study after school");
  await page.getByLabel("What are they trying to do, and what gets in the way?").fill("They lose track of which topics need more practice before a test");
  await page.getByLabel("Why does solving this matter?").fill("They want to use their study time well");
  await page.getByRole("button", { name: "Create project" }).click();
}

async function checkStudioWidths(page: Page, phase: string, widths = [390, 430, 1365, 1440]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(size[0], `${phase} horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.setViewportSize({ width: 1440, height: 950 });
}

test("Studio supports build, try, feedback, iteration, retest, summary, and refresh", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startProject(page, true);
  await checkStudioWidths(page, "project setup");
  await expect(page.getByRole("heading", { name: "Start with one person and one problem." })).toBeVisible();
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Show topics due for review");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByLabel("Feature idea").fill("Add a social study feed");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Move to Later Ideas" }).nth(1).click();
  await checkStudioWidths(page, "Version 1 scope");
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("What should the person be able to do?").fill("Students can see topics due today and mark a topic practiced");
  await page.getByLabel("What should the Builder keep in mind?").fill("Keep the layout readable on a phone");
  await page.getByLabel("Your Builder instruction").fill("Build a topic review list for students who study after school. They lose track of which topics need more practice. Students can see topics due today and mark a topic practiced. Show topics due for review. Keep the layout readable on a phone.");
  await expect(page.locator(".studio-checks .is-ready")).toHaveCount(5);
  await checkStudioWidths(page, "Builder Brief");
  await page.reload();
  await expect(page.getByLabel("Your Builder instruction")).toHaveValue("Build a topic review list for students who study after school. They lose track of which topics need more practice. Students can see topics due today and mark a topic practiced. Show topics due for review. Keep the layout readable on a phone.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await expect(page.getByText("DETERMINISTIC TEST BUILDER")).toBeVisible();
  await checkStudioWidths(page, "Version 1 preview");
  expect(await page.locator('iframe[title="Topic Tracker interactive preview"]').getAttribute("sandbox")).toBe("allow-scripts");
  const csp = await page.frameLocator('iframe[title="Topic Tracker interactive preview"]').locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("connect-src 'none'");
  const preview = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await preview.getByRole("button", { name: "Add item" }).click();
  await expect(preview.getByRole("status")).toContainText("Enter a value to add it");
  await preview.getByRole("textbox", { name: "New item" }).fill("Biology review");
  await preview.getByRole("button", { name: "Add item" }).click();
  await expect(preview.getByRole("status")).toContainText("Added successfully");
  await preview.getByRole("button", { name: "Edit" }).click();
  await preview.getByRole("textbox", { name: "Edit item" }).fill("Biology exam");
  await preview.getByRole("button", { name: "Save changes" }).click();
  await expect(preview.getByText("Biology exam")).toBeVisible();
  await preview.getByRole("button", { name: "Remove" }).click();
  await expect(preview.getByText("Biology exam")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  const appSize = await preview.locator("body").evaluate((body) => [body.scrollWidth, body.clientWidth]);
  expect(appSize[0], "generated app horizontal overflow at 390px").toBeLessThanOrEqual(appSize[1]);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Try the app before asking for changes." })).toBeVisible();
  await page.getByLabel("What did you do?").fill("Opened the topic list and looked for today's topic");
  await page.getByLabel("What did you expect?").fill("See topics due today");
  await page.getByLabel("What happened instead?").fill("The list did not show when the topics were due");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await checkStudioWidths(page, "feedback");
  await page.getByLabel("Who shared feedback?").fill("Sam, a student");
  await page.getByLabel("What did they notice or say?").fill("I wanted to see the due date next to each topic");
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await checkStudioWidths(page, "next goal");
  await page.getByLabel("What should change next?").fill("Students can see the due date next to every topic");
  await page.getByRole("button", { name: "Build Version 2" }).click();
  await expect(page.getByText("VERSION 2 · BUILDER CHANGE SUMMARY")).toBeVisible();
  await checkStudioWidths(page, "Version 2 retest");
  await page.reload();
  await expect(page.getByText("VERSION 2 · BUILDER CHANGE SUMMARY")).toBeVisible();
  await page.getByLabel("Repeat: what did you do?").fill("Opened the topic list and checked a due date");
  await page.getByLabel("What did you expect this time?").fill("See each topic's due date");
  await page.getByLabel("What happened?").fill("The due date was visible");
  await page.getByLabel("Check one nearby behavior").fill("Marked a topic practiced; other topics remained in the list");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await expect(page.getByRole("heading", { name: "Look how far your idea came." })).toBeVisible();
  await expect(page.getByText("Sam, a student: I wanted to see the due date next to each topic")).toBeVisible();
  await expect(page.getByText("1 update · 3 observations · 2 versions tested")).toBeVisible();
  for (const width of [390, 430, 1365, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(size[0], `summary horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.getByRole("button", { name: "All Studio projects" }).click();
  await expect(page.getByRole("heading", { name: "Topic Tracker" })).toBeVisible();
  const widths = [390, 430, 1365, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 950 });
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(size[0], `horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  expect(errors).toEqual([]);
});

test("Studio can create three immutable versions and reopen an older preview", async ({ page }) => {
  await startProject(page);
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Track study topics");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build a small topic tracker for students.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await page.getByLabel("What did you do?").fill("Added a topic");
  await page.getByLabel("What did you expect?").fill("See the topic in the list");
  await page.getByLabel("What happened instead?").fill("The topic appeared");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await page.getByLabel("What should change next?").fill("Add a completion counter");
  await page.getByRole("button", { name: "Build Version 2" }).click();
  await page.getByLabel("Repeat: what did you do?").fill("Add a topic again");
  await page.getByLabel("What did you expect this time?").fill("See it appear");
  await page.getByLabel("What happened?").fill("It appeared");
  await page.getByLabel("Check one nearby behavior").fill("Removed a topic; remaining topics stayed visible");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await page.getByRole("button", { name: "Build another version" }).click();
  await page.getByLabel("What should change next?").fill("Add a completion counter");
  await page.getByRole("button", { name: "Build Version 3" }).click();
  await expect(page.getByText("VERSION 3 · BUILDER CHANGE SUMMARY")).toBeVisible();
  await page.getByLabel("Repeat: what did you do?").fill("Mark one study session complete");
  await page.getByLabel("What did you expect this time?").fill("See the completed count increase");
  await page.getByLabel("What happened?").fill("The completed count increased");
  await page.getByLabel("Check one nearby behavior").fill("The topic list remained available");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await expect(page.getByText("2 updates · 5 observations · 3 versions tested")).toBeVisible();
  await page.getByRole("button", { name: "Preview Version 1" }).click();
  await expect(page.getByRole("heading", { name: "Version 1 preview" })).toBeVisible();
  await expect(page.getByTitle("Topic Tracker interactive preview")).toBeVisible();
  await page.getByRole("button", { name: "Close older preview" }).click();
  await expect(page.getByRole("heading", { name: "Version 1 preview" })).toHaveCount(0);
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

test("Studio keeps the Builder Brief after a connection failure and retries", async ({ page }) => {
  await startProject(page);
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Keep track of study topics");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  const instruction = "Build a simple list so students can keep track of study topics.";
  await page.getByLabel("Your Builder instruction").fill(instruction);
  let calls = 0;
  await page.route("**/api/studio/build", async (route) => {
    calls += 1;
    if (calls === 1) { await new Promise((resolve) => setTimeout(resolve, 900)); await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "The Builder couldn't connect right now. Your project is safe. Try the build again." }) }); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await expect(page.getByRole("status")).toContainText("making your version");
  await checkStudioWidths(page, "build status", [390, 430]);
  await expect(page.locator(".studio-build-error[role=alert]")).toContainText("couldn't connect");
  await page.reload();
  await expect(page.getByLabel("Your Builder instruction")).toHaveValue(instruction);
  await page.getByRole("button", { name: "Retry build" }).click();
  await expect(page.getByTitle("Topic Tracker interactive preview")).toBeVisible();
});

test("Studio never previews an unsafe generated artifact", async ({ page }) => {
  await startProject(page);
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Show a task list");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build a safe task list.");
  await page.route("**/api/studio/build", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ provider: "deterministic", attempts: 1, artifact: { format: "buildloop-app-v1", title: "Unsafe", summary: "Bad output", blocks: [{ type: "text", text: "<script>parent.document.body.innerHTML='bad'</script>" }, { type: "collection", title: "Tasks", inputLabel: "Task", addLabel: "Add", emptyText: "Empty", allowRemove: true, filterable: false }], changeSummary: [], testTasks: ["Add a task"] } }) }));
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await expect(page.locator(".studio-build-error[role=alert]")).toContainText("could not safely run");
  await expect(page.locator("iframe")).toHaveCount(0);
});
