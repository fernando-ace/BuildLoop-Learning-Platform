import { describe, expect, it } from "vitest";
import { buildBrief, createProject, goalCoaching, inspectBrief, problemCoaching, recordBuild, recordFeedback, recordNextGoal, recordObservation, studioSummary, type BuilderResult } from "./studio";

const idea = () => createProject({ name: "Study buddy", user: "Students who study after school", problem: "They lose track of which topics need more practice", why: "They want to use their study time well" }, "project-1", "2026-10-14T12:00:00Z");
const built = (instruction: string, version = 1): BuilderResult => ({ provider: "demo", instruction, title: `Version ${version}`, description: `Local demo version ${version}` });

describe("BuildLoop Studio project workflow", () => {
  it("creates a revisable project with a stable history starting point", () => {
    expect(idea()).toMatchObject({ id: "project-1", stage: "idea", versions: [], observations: [], feedback: [], name: "Study buddy" });
  });
  it("coaches vague users, feature-first statements, and short problems without blocking", () => {
    expect(problemCoaching("", "everyone")).toContain("gets in this person’s way");
    expect(problemCoaching("Build a planner", "Students")).toContain("feature");
    expect(problemCoaching("They forget", "Students")).toContain("say what happens");
    expect(problemCoaching("They miss study sessions because reminders are scattered", "everyone")).toContain("one kind of person");
    expect(problemCoaching("They miss study sessions because reminders are scattered", "Students after school")).toBeNull();
  });
  it("keeps first-version scope separate from later ideas in the Builder Brief", () => {
    const project = { ...idea(), features: [{ id: "f1", text: "Show topics due for review", inV1: true }, { id: "f2", text: "Add a social feed", inV1: false }], behavior: "Students can mark a topic practiced", constraints: "Keep it readable on a phone" };
    const brief = buildBrief(project);
    expect(brief.scope).toEqual(["Show topics due for review"]);
    expect(inspectBrief(brief)).toEqual({ user: true, problem: true, behavior: true, constraints: true, scope: true });
  });
  it("tracks each build, test observation, feedback, and goal by version", () => {
    let project = recordBuild(idea(), built("Build a topic review list"), "2026-10-14T12:01:00Z");
    expect(project.versions[0]).toMatchObject({ number: 1, tested: false, status: "complete" });
    project = recordObservation(project, { action: "Open the topic list", expected: "See topics due today", happened: "The list is empty", kind: "core" });
    project = recordFeedback(project, { from: "Sam, a student", note: "I wanted to see the due date" });
    project = recordNextGoal(project, "Students can see when each topic is due");
    expect(project.versions[0].tested).toBe(true);
    expect(project.observations[0].version).toBe(1);
    expect(project.feedback[0].version).toBe(1);
    expect(project.stage).toBe("retest");
  });
  it("does not invent tests when no build exists and teaches observable goals", () => {
    const project = idea();
    expect(recordObservation(project, { action: "Try", expected: "works", happened: "no build", kind: "core" })).toEqual(project);
    expect(goalCoaching("Make it better")).toContain("observable");
    expect(goalCoaching("Add a JavaScript array to store the results")).toContain("behavior");
    expect(goalCoaching("Students can find the nearest open study room")).toBeNull();
  });
  it("summarizes specific actions, versions, and checked behavior", () => {
    let project = recordBuild(idea(), built("Version one instruction"));
    project = recordObservation(project, { action: "Mark a topic practiced", expected: "It disappears from due list", happened: "It stays visible", kind: "core" });
    project = recordFeedback(project, { from: "Me", note: "Due date is hard to spot" });
    project = recordNextGoal(project, "Show topic due dates");
    project = recordBuild(project, built("Show due dates", 2));
    project = recordObservation(project, { action: "Check nearby", expected: "Other topics remain", happened: "Other topics remain", kind: "nearby" });
    expect(studioSummary(project)).toMatchObject({ user: "Students who study after school", iterations: 1, tests: 2, testedVersions: 2, state: "2 versions; 2 tested" });
    expect(studioSummary(project).practiced).toContain("checked nearby behavior");
    expect(project.versions.map((version) => version.number)).toEqual([1, 2]);
  });
});
