import { expect, test, type Page } from "@playwright/test";

async function startProject(page: Page, checkEntryResponsive = false, details = { name: "Topic Tracker", user: "Students who study after school", problem: "They lose track of which topics need more practice before a test", why: "They want to use their study time well" }) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Explore Studio" }).click();
  if (checkEntryResponsive) await checkStudioWidths(page, "project list");
  await page.getByRole("button", { name: "Start a project" }).click();
  if (checkEntryResponsive) await checkStudioWidths(page, "new project");
  await page.getByLabel("Project name").fill(details.name);
  await page.getByLabel("Who is this for?").fill(details.user);
  await page.getByLabel("What are they trying to do, and what gets in the way?").fill(details.problem);
  await page.getByLabel("Why does solving this matter?").fill(details.why);
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

async function buildNextFromTry(page: Page, version: number, goal: string) {
  await page.getByLabel("What did you do?").fill("Opened the topic list");
  await page.getByLabel("What did you expect?").fill("See the saved topics");
  await page.getByLabel("What happened instead?").fill("The topics appeared");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await page.getByLabel("Who shared feedback?").fill("Me");
  await page.getByLabel("What did they notice or say?").fill("I need one more detail for this task");
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await page.getByLabel("What should change next?").fill(goal);
  await page.getByRole("button", { name: `Build Version ${version}` }).click();
  await expect(page.getByRole("heading", { name: "Try it again, then check nearby behavior." })).toBeVisible();
}

async function buildNextFromRetest(page: Page, version: number, goal: string) {
  await page.getByLabel("Repeat: what did you do?").fill("Opened the topic list");
  await page.getByLabel("What did you expect this time?").fill("See the saved topics and new detail");
  await page.getByLabel("What happened?").fill("The saved topics and new detail appeared");
  await page.getByLabel("Check one nearby behavior").fill("The existing list remained usable");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await page.getByRole("button", { name: "Build another version" }).click();
  await page.getByLabel("What should change next?").fill(goal);
  await page.getByRole("button", { name: `Build Version ${version}` }).click();
  await expect(page.getByRole("heading", { name: "Try it again, then check nearby behavior." })).toBeVisible();
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
  await expect(preview.getByRole("heading", { name: "Team tasks" })).toBeVisible();
  await preview.getByRole("button", { name: "Add record" }).click();
  await preview.getByLabel("Task").fill("Biology review");
  await preview.getByRole("button", { name: "Create record" }).click();
  await expect(preview.getByText("Biology review")).toBeVisible();
  const biology = preview.locator(".record").filter({ hasText: "Biology review" });
  await biology.getByRole("button", { name: "Edit" }).click();
  await preview.getByLabel("Task").fill("Biology exam");
  await preview.getByRole("button", { name: "Save changes" }).click();
  await expect(preview.getByText("Biology exam")).toBeVisible();
  await preview.getByRole("searchbox", { name: "Search Tasks" }).fill("Biology");
  await expect(preview.getByText("Plan kickoff")).toHaveCount(0);
  await expect(preview.getByText("Biology exam")).toBeVisible();
  await preview.getByRole("searchbox", { name: "Search Tasks" }).fill("");
  await preview.getByRole("button", { name: "To do" }).click();
  await expect(preview.getByText("Plan kickoff")).toBeVisible();
  await expect(preview.getByText("Biology exam")).toHaveCount(0);
  await preview.getByRole("button", { name: "To do" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const appSize = await preview.locator("body").evaluate((body) => [body.scrollWidth, body.clientWidth]);
  expect(appSize[0], "generated app horizontal overflow at 390px").toBeLessThanOrEqual(appSize[1]);
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Try the app before asking for changes." })).toBeVisible();
  await expect(page.frameLocator('iframe[title="Topic Tracker interactive preview"]').getByText("Biology exam")).toBeVisible();
  await page.getByLabel("What did you do?").fill("Opened the topic list and looked for today's topic");
  await page.getByLabel("What did you expect?").fill("See topics due today");
  await page.getByLabel("What happened instead?").fill("The list did not show when the topics were due");
  await page.getByRole("button", { name: "Record test and gather feedback" }).click();
  await checkStudioWidths(page, "feedback");
  await page.getByLabel("Who shared feedback?").fill("Sam, a student");
  await page.getByLabel("What did they notice or say?").fill("I wanted to see the due date next to each topic");
  await page.getByRole("button", { name: "Choose what to work on next" }).click();
  await checkStudioWidths(page, "next goal");
  await page.getByLabel("What should change next?").fill("Students can see a due date next to every task");
  await page.getByRole("button", { name: "Build Version 2" }).click();
  await expect(page.getByText("VERSION 2 · BUILDER CHANGE SUMMARY")).toBeVisible();
  const v2preview = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await expect(page.getByText("2 records carried forward")).toBeVisible();
  await v2preview.getByRole("button", { name: "Add record" }).click();
  await expect(v2preview.getByLabel("Due date")).toBeVisible();
  await v2preview.getByRole("button", { name: "Cancel" }).click();
  await expect(v2preview.getByText("Plan kickoff")).toBeVisible();
  await expect(v2preview.getByText("Biology exam")).toBeVisible();
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

test("V3 relational preview links records and runs a capacity-checked workflow", async ({ page }) => {
  test.setTimeout(90_000);
  await startProject(page, false, { name: "Volunteer Shift Planner", user: "Campus volunteers", problem: "Connect events, shifts, volunteers, and registrations", why: "Keep signups within shift capacity" });
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Connect volunteers to shifts with safe signups");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build a volunteer shift registration app with related events, shifts, volunteers, and signups. Enforce capacity and prevent duplicate registrations.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await expect(page.getByText("RELATIONAL APP PREVIEW · VERSION 1")).toBeVisible();
  const preview = page.locator(".v3-app");
  await expect(preview.getByRole("heading", { name: "Volunteer Shift Planner" })).toBeVisible();
  await preview.getByRole("button", { name: "Shifts" }).click();
  await expect(preview.getByText("Morning setup")).toBeVisible();
  const shift = preview.locator(".v3-table-wrap tbody tr").filter({ hasText: "Morning setup" });
  await expect(shift.getByRole("cell").nth(4)).toHaveText("1");
  await preview.getByRole("button", { name: "Register" }).click();
  await preview.getByLabel("Volunteer", { exact: true }).selectOption("vol_sam");
  await preview.getByRole("button", { name: "Run register volunteer" }).click();
  await expect(preview.getByRole("status")).toHaveText("Done.");
  await preview.getByRole("button", { name: "Registrations" }).click();
  await expect(preview.getByText("Sam Rivera")).toBeVisible();
  await expect(preview.getByText("Morning setup")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileSize = await preview.evaluate((element) => [element.scrollWidth, element.clientWidth]);
  expect(mobileSize[0], "V3 preview horizontal overflow at 390px").toBeLessThanOrEqual(mobileSize[1]);
  await page.setViewportSize({ width: 1440, height: 950 });
});

test("four Studio versions carry real data forward while preserving historical snapshots", async ({ page }) => {
  test.setTimeout(120_000);
  await startProject(page);
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Track study topics and upcoming reviews");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build a study topic tracker for students who need to organize review work.");
  await page.getByRole("button", { name: "Build Version 1" }).click();

  const v1 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  for (const title of ["Biology review", "History final"]) {
    await v1.getByRole("button", { name: "Add record" }).click();
    await v1.getByLabel("Task").fill(title);
    await v1.getByRole("button", { name: "Create record" }).click();
    await expect(v1.getByText(title)).toBeVisible();
  }

  await buildNextFromTry(page, 2, "Add a due date to every study topic");
  const v2 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await expect(page.getByText("3 records carried forward")).toBeVisible();
  await expect(v2.getByText("Biology review")).toBeVisible();
  await expect(v2.getByText("History final")).toBeVisible();

  await buildNextFromRetest(page, 3, "Add a required review checkbox with a safe default");
  const v3 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await v3.getByRole("button", { name: "Add record" }).click();
  await expect(v3.getByLabel("Reviewed")).toHaveValue("false");
  await v3.getByLabel("Task").fill("Geology review");
  await v3.getByRole("button", { name: "Create record" }).click();
  await expect(v3.getByText("Geology review")).toBeVisible();
  const versionThreeRows = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("buildloop-studio-v1") || "{}");
    const project = state.projects?.find((item: { id: string }) => item.id === state.activeId);
    const snapshot = JSON.parse(localStorage.getItem(`buildloop-runtime-v2:${encodeURIComponent(project.id)}:3`) || "null");
    return snapshot?.data?.tasks?.length;
  });
  expect(versionThreeRows).toBe(4);

  await buildNextFromRetest(page, 4, "Add an estimated minutes field with a sensible default");
  const v4 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await expect(page.getByText("4 records carried forward")).toBeVisible();
  await expect(v4.getByText("Biology review")).toBeVisible();
  await expect(v4.getByText("History final")).toBeVisible();
  await expect(v4.getByText("Geology review")).toBeVisible();
  await page.getByLabel("Repeat: what did you do?").fill("Opened the topic list");
  await page.getByLabel("What did you expect this time?").fill("See each topic with its review details");
  await page.getByLabel("What happened?").fill("The topic list showed the saved records");
  await page.getByLabel("Check one nearby behavior").fill("Search still finds saved topics");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await expect(page.getByText("Compare Version 3 with Version 4")).toBeVisible();
  await checkStudioWidths(page, "four-version history", [390, 1440]);

  await page.getByRole("button", { name: "Preview Version 1" }).click();
  const historicalV1 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]').last();
  await expect(historicalV1.getByText("Biology review")).toBeVisible();
  await expect(historicalV1.getByText("History final")).toBeVisible();
  await expect(historicalV1.getByText("Geology review")).toHaveCount(0);
  await page.getByRole("button", { name: "Close older preview" }).click();
  await page.getByRole("button", { name: "Preview Version 2" }).click();
  const historicalV2 = page.frameLocator('iframe[title="Topic Tracker interactive preview"]').last();
  await expect(historicalV2.getByText("Due date: —").first()).toBeVisible();
  await expect(historicalV2.getByText("Geology review")).toHaveCount(0);
});

test("Studio warns before incompatible populated fields are reset and keeps the old version intact", async ({ page }) => {
  await startProject(page);
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Track study tasks and their priority");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build a study topic tracker for students.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  await buildNextFromTry(page, 2, "Change priority from a choice to a free text field");
  await expect(page.getByText("Priority changed to an incompatible format")).toBeVisible();
  await expect(page.getByText(/old values remain in Version 1/)).toBeVisible();
  const current = page.frameLocator('iframe[title="Topic Tracker interactive preview"]');
  await expect(current.getByText("Plan kickoff")).toBeVisible();
  await page.getByLabel("Repeat: what did you do?").fill("Opened the tracker");
  await page.getByLabel("What did you expect this time?").fill("See the existing priority values");
  await page.getByLabel("What happened?").fill("The item stayed; its priority needs a new value");
  await page.getByLabel("Check one nearby behavior").fill("The existing task can still be edited");
  await page.getByRole("button", { name: "See your project summary" }).click();
  await page.getByRole("button", { name: "Preview Version 1" }).click();
  const historical = page.frameLocator('iframe[title="Topic Tracker interactive preview"]').last();
  await expect(historical.getByText("Priority: High")).toBeVisible();
});

test("V2 equipment table supports navigation, detail, forms, filtering, and reset at mobile widths", async ({ page }) => {
  await startProject(page, false, { name: "Equipment checkout", user: "Club members", problem: "They need to find and check out shared equipment", why: "The club needs to know what is available" });
  await page.getByRole("button", { name: "Choose a small first version" }).click();
  await page.getByLabel("Feature idea").fill("Track equipment and checkout state");
  await page.getByRole("button", { name: "Add idea" }).click();
  await page.getByRole("button", { name: "Write the Builder Brief" }).click();
  await page.getByLabel("Your Builder instruction").fill("Build an equipment inventory with categories, quantities, and availability.");
  await page.getByRole("button", { name: "Build Version 1" }).click();
  const app = page.frameLocator('iframe[title="Equipment checkout interactive preview"]');
  await expect(app.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(app.getByRole("cell", { name: "Projector" })).toBeVisible();
  await app.getByRole("button", { name: "Add record" }).click();
  await app.getByRole("button", { name: "Create record" }).click();
  await expect(app.getByRole("status")).toContainText("Item is required");
  await app.getByLabel("Item").fill("Tripod");
  await app.getByLabel("Category").selectOption("Sports");
  await app.getByLabel("Quantity").fill("3");
  for (const width of [390, 430, 1365, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await app.locator("body").evaluate((body) => [body.scrollWidth, body.clientWidth]);
    expect(size[0], `equipment form horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await app.getByRole("button", { name: "Create record" }).click();
  await expect(app.getByRole("cell", { name: "Tripod" })).toBeVisible();
  await expect(app.getByRole("row").nth(1)).toContainText("Projector");
  await expect(app.getByRole("row").nth(2)).toContainText("Tripod");
  await app.getByRole("button", { name: "View details" }).last().click();
  await expect(app.getByRole("heading", { name: "Equipment details" })).toBeVisible();
  await expect(app.getByText("Tripod")).toBeVisible();
  for (const width of [390, 430, 1365, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await app.locator("body").evaluate((body) => [body.scrollWidth, body.clientWidth]);
    expect(size[0], `equipment detail horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await app.getByRole("button", { name: "Inventory" }).click();
  await app.getByRole("searchbox", { name: "Equipment" }).fill("Tripod");
  await expect(app.getByRole("cell", { name: "Projector" })).toHaveCount(0);
  const tripod = app.getByRole("row").filter({ hasText: "Tripod" });
  await tripod.getByRole("button", { name: "Toggle Checked out" }).click();
  await expect(tripod).toContainText("Yes");
  await tripod.getByRole("button", { name: "Increase Quantity" }).click();
  await expect(tripod).toContainText("4");
  await tripod.getByRole("button", { name: "View details" }).click();
  await expect(app.getByRole("heading", { name: "Equipment details" })).toBeVisible();
  await expect(app.getByText("Checked out: Yes")).toBeVisible();
  await expect(app.getByText("Quantity: 4")).toBeVisible();
  await app.getByRole("button", { name: "Inventory" }).click();
  for (const width of [390, 430, 1365, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const size = await app.locator("body").evaluate((body) => [body.scrollWidth, body.clientWidth]);
    expect(size[0], `equipment preview horizontal overflow at ${width}px`).toBeLessThanOrEqual(size[1]);
  }
  await page.getByRole("button", { name: "Reset preview data" }).click();
  await app.getByRole("searchbox", { name: "Equipment" }).fill("");
  await expect(app.getByRole("cell", { name: "Projector" })).toBeVisible();
  await expect(app.getByRole("cell", { name: "Tripod" })).toHaveCount(0);
  await app.getByRole("row").filter({ hasText: "Projector" }).getByRole("button", { name: "Delete record" }).click();
  await expect(app.getByRole("cell", { name: "Projector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reset preview data" }).click();
  await expect(app.getByRole("cell", { name: "Projector" })).toBeVisible();
});

test("saved V1 artifacts still open in their original interactive preview", async ({ page }) => {
  await page.goto("/");
  const oldArtifact = {
    format: "buildloop-app-v1", title: "Legacy reading list", summary: "A list saved by an earlier Studio version.",
    blocks: [
      { type: "heading", text: "Reading" },
      { type: "collection", title: "Books", inputLabel: "Book title", addLabel: "Add book", emptyText: "No books yet", allowRemove: true, allowEdit: true, filterable: true },
    ],
    changeSummary: ["Added a list"], testTasks: ["Add a book"],
  };
  const oldProject = {
    id: "legacy-v1-project", name: "Legacy reading list", user: "Readers", problem: "Remember books", why: "Keep a list", stage: "try",
    features: [{ id: "list", text: "Track books", inV1: true }], behavior: "Readers can add books", constraints: "", instruction: "Keep a reading list",
    brief: null, versions: [{ number: 1, instruction: "Build a list", builtAt: "2026-10-15T00:00:00.000Z", status: "complete", notes: "", tested: false, result: { provider: "deterministic", title: oldArtifact.title, description: oldArtifact.summary, instruction: "Build a list", artifact: oldArtifact } }],
    observations: [], feedback: [], nextGoal: "", shareDecision: "", createdAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z",
  };
  await page.evaluate((project) => localStorage.setItem("buildloop-studio-v1", JSON.stringify({ projects: [project], activeId: project.id, screen: "project" })), oldProject);
  await page.reload();
  const preview = page.frameLocator('iframe[title="Legacy reading list interactive preview"]');
  await expect(preview.getByRole("heading", { name: "Legacy reading list" })).toBeVisible();
  await preview.getByRole("textbox", { name: "Book title" }).fill("The Left Hand of Darkness");
  await preview.getByRole("button", { name: "Add book" }).click();
  await expect(preview.getByText("The Left Hand of Darkness")).toBeVisible();
});

test("legacy V2 runtime maps reopen and upgrade to version snapshot envelopes", async ({ page }) => {
  await page.goto("/");
  const artifact = {
    format: "buildloop-app-v2", title: "Legacy task list", summary: "Saved by an earlier Studio version.", defaultScreen: "tasks",
    screens: [
      { id: "tasks", title: "Tasks", view: "list", collection: "tasks", primaryField: "title", fields: ["title"] },
      { id: "new_task", title: "New task", view: "form", collection: "tasks", formMode: "create", cancelScreen: "tasks" },
    ],
    navigation: [{ label: "Tasks", screen: "tasks" }],
    collections: [{ id: "tasks", label: "Tasks", fields: [{ id: "title", label: "Task", type: "text", required: true }], seed: [{ id: "task_seed", title: "Sample task" }] }],
    actions: [], metrics: [], changeSummary: [], testTasks: ["Add a task"],
  };
  const project = {
    id: "legacy-v2-project", name: "Legacy task list", user: "Students", problem: "Remember tasks", why: "Keep track", stage: "try",
    features: [{ id: "task-list", text: "Track tasks", inV1: true }], behavior: "Students can add tasks", constraints: "", instruction: "Keep a task list", brief: null,
    versions: [{ number: 1, instruction: "Build a task list", builtAt: "2026-10-15T00:00:00.000Z", status: "complete", notes: "", tested: false, result: { provider: "deterministic", title: artifact.title, description: artifact.summary, instruction: "Build a task list", artifact } }],
    observations: [], feedback: [], nextGoal: "", shareDecision: "", createdAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z",
  };
  await page.evaluate((savedProject) => {
    localStorage.setItem("buildloop-studio-v1", JSON.stringify({ projects: [savedProject], activeId: savedProject.id, screen: "project" }));
    localStorage.setItem("buildloop-runtime-v2:legacy-v2-project:1", JSON.stringify({ tasks: [{ id: "task_saved", title: "Saved from older V2" }] }));
  }, project);
  await page.reload();
  const preview = page.frameLocator('iframe[title="Legacy task list interactive preview"]');
  await expect(preview.getByText("Saved from older V2")).toBeVisible();
  await preview.getByRole("button", { name: "Add record" }).click();
  await preview.getByLabel("Task").fill("Newer task");
  await preview.getByRole("button", { name: "Create record" }).click();
  await expect(preview.getByText("Newer task")).toBeVisible();
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("buildloop-runtime-v2:legacy-v2-project:1") || "null"));
  expect(snapshot).toMatchObject({ format: "buildloop-runtime-snapshot-v1", projectId: "legacy-v2-project", version: 1, data: { tasks: [{ id: "task_saved", title: "Saved from older V2" }, { title: "Newer task" }] } });
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
  await expect(page.frameLocator('iframe[title="Topic Tracker interactive preview"]').getByText("Plan kickoff")).toBeVisible();
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
