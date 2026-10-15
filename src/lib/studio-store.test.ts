import { describe, expect, it } from "vitest";
import { createProject, recordBuild } from "./studio";
import { createStudioProject, migrateStudioProject, migrateStudioState, openStudioProject, updateStudioProject, getStudioState } from "./studio-store";

describe("Studio v1 save compatibility", () => {
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

  it("marks an abandoned in-memory build failed when the learner reopens its project", () => {
    const project = createProject({ name: "Recover me", user: "A learner", problem: "A small task is hard", why: "It takes too long" }, "recover-project");
    createStudioProject(project);
    updateStudioProject(project.id, (current) => ({ ...current, build: { status: "building", attempts: 1 } }));
    openStudioProject(project.id);
    expect(getStudioState().projects.find((item) => item.id === project.id)?.build).toMatchObject({ status: "failed", message: expect.stringContaining("stopped") });
  });
});
