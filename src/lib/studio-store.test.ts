import { describe, expect, it } from "vitest";
import { createProject, recordBuild } from "./studio";
import { v2Fixtures } from "./builder/v2";
import { buildStudioProjectsFromCloud, createStudioProject, getStudioLearnerSnapshot, migrateStudioProject, migrateStudioState, openStudioProject, updateStudioProject, getStudioState } from "./studio-store";

describe("Studio v1 save compatibility", () => {
  it("keeps a saved V1 artifact immutable in history after a V2 build", () => {
    const v1 = { format: "buildloop-app-v1" as const, title: "Old list", summary: "A saved list", blocks: [{ type: "heading" as const, text: "Old list" }, { type: "collection" as const, title: "Tasks", inputLabel: "Task", addLabel: "Add", emptyText: "Empty", allowRemove: true, allowEdit: true, filterable: true }], changeSummary: ["Added list"], testTasks: ["Add a task"] };
    const first = recordBuild(createProject({ name: "History", user: "Student", problem: "Track tasks", why: "Remember" }, "history"), { provider: "deterministic", title: v1.title, description: v1.summary, instruction: "Build a list", artifact: v1 });
    const second = recordBuild(first, { provider: "deterministic", title: v2Fixtures[2].title, description: v2Fixtures[2].summary, instruction: "Add statuses", artifact: v2Fixtures[2] });
    expect(second.versions.map((version) => version.number)).toEqual([1, 2]);
    expect(second.versions[0].result.artifact).toEqual(v1);
    expect(second.versions[1].result.artifact?.format).toBe("buildloop-app-v2");
  });

  it("opens a project saved before generated artifacts and build states existed", () => {
    const legacy = recordBuild(createProject({ name: "Old project", user: "Students", problem: "They lose track of tasks", why: "They need a simple list" }, "legacy-1"), { provider: "demo", title: "Version 1", description: "Saved prototype concept", instruction: "Build a list" });
    const beforeGoalEight: Record<string, unknown> = { ...legacy };
    delete beforeGoalEight.build;
    const migrated = migrateStudioProject(beforeGoalEight);
    expect(migrated).toMatchObject({ id: "legacy-1", name: "Old project", versions: [{ number: 1, result: { provider: "demo" } }] });
    expect(migrated?.versions[0].result.artifact).toBeUndefined();
  });

  it("recovers interrupted builds and ignores malformed project entries without losing valid saves", () => {
    const project = { ...createProject({ name: "Interrupted", user: "Student", problem: "A task is hard to track", why: "It takes time" }, "p2"), build: { status: "building" as const, attempts: 1 } };
    const state = migrateStudioState({ projects: [null, { id: "partial" }, project], activeId: "missing", screen: "project" });
    expect(state.projects).toHaveLength(1);
    expect(state.activeId).toBeNull();
    expect(state.projects[0].build).toMatchObject({ status: "failed", message: expect.stringContaining("stopped") });
  });

  it("returns a safe empty state for an unparseable save shape", () => {
    expect(migrateStudioState("not an object")).toEqual({ projects: [], activeId: null, screen: "missions" });
  });

  it("restores app versions and private learning notes into a Studio project on a new device", () => {
    const project = buildStudioProjectsFromCloud([{ id: "app_cloud", name: "Study planner", brief: {}, createdAt: "2026-11-01T00:00:00.000Z", versions: [{ number: 1, versionId: "v1", title: "Planner", description: "A first build", builtAt: "2026-11-02T00:00:00.000Z", provider: "demo" }] }], [{
      appId: "app_cloud", revision: 2, stage: "feedback", updatedAt: "2026-11-03T00:00:00.000Z",
      projectNotes: { user: "A student", problem: "They miss assignments", why: "Planning helps", behavior: "Track classes", constraints: "", instruction: "Build a planner", brief: null, nextGoal: "Try reminders", shareDecision: "" },
      features: [{ id: "classes", text: "Class list", inV1: true }], observations: [], feedback: [],
      versionNotes: [{ number: 1, instruction: "Build a planner", builtAt: "2026-11-02T00:00:00.000Z", notes: "Test the schedule", tested: true, observations: [], feedback: [], retestedVersion: null }],
    }]);
    expect(project).toHaveLength(1);
    expect(project[0]).toMatchObject({ id: "app_cloud", problem: "They miss assignments", stage: "feedback", features: [{ inV1: true }], versions: [{ versionId: "v1", instruction: "Build a planner", tested: true }] });
    expect(project[0].versions[0].result.artifact).toBeUndefined();
    expect(getStudioLearnerSnapshot(project[0]).projectNotes.problem).toBe("They miss assignments");
  });

  it("marks an abandoned in-memory build failed when the learner reopens its project", () => {
    const project = createProject({ name: "Recover me", user: "A learner", problem: "A small task is hard", why: "It takes too long" }, "recover-project");
    createStudioProject(project);
    updateStudioProject(project.id, (current) => ({ ...current, build: { status: "building", attempts: 1 } }));
    openStudioProject(project.id);
    expect(getStudioState().projects.find((item) => item.id === project.id)?.build).toMatchObject({ status: "failed", message: expect.stringContaining("stopped") });
  });
});
