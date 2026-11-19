import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.fn();
const listStudioApplications = vi.fn();
const listStudioLearnerProgress = vi.fn();
const writeStudioLearnerProgress = vi.fn();
const archiveStudioProject = vi.fn();
vi.mock("@/lib/platform/session", () => ({ getPlatformIdentity: (...args: unknown[]) => identity(...args) }));
vi.mock("@/lib/platform/studio-learner-progress", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/platform/studio-learner-progress")>();
  return {
    ...original,
    listStudioApplications: (...args: unknown[]) => listStudioApplications(...args),
    listStudioLearnerProgress: (...args: unknown[]) => listStudioLearnerProgress(...args),
    writeStudioLearnerProgress: (...args: unknown[]) => writeStudioLearnerProgress(...args),
    archiveStudioProject: (...args: unknown[]) => archiveStudioProject(...args),
  };
});

import { DELETE, GET, PUT } from "./route";

const record = {
  stage: "idea",
  projectNotes: { user: "", problem: "", why: "", behavior: "", constraints: "", instruction: "", brief: null, nextGoal: "", shareDecision: "" },
  features: [], observations: [], feedback: [], versionNotes: [],
};

describe("private Studio learner API", () => {
  beforeEach(() => { identity.mockReset(); listStudioApplications.mockReset(); listStudioLearnerProgress.mockReset(); writeStudioLearnerProgress.mockReset(); archiveStudioProject.mockReset(); });

  it("returns app identity with only the signed-in learner's private records", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    listStudioApplications.mockResolvedValue([{ id: "app_a", name: "Planner" }]);
    listStudioLearnerProgress.mockResolvedValue([{ appId: "app_a", projectNotes: { problem: "private" } }]);
    const response = await GET(new Request("http://localhost/api/learner/studio"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ learnerId: "learner-a", applications: [{ id: "app_a" }], learningRecords: [{ projectNotes: { problem: "private" } }] });
    expect(listStudioLearnerProgress).toHaveBeenCalledWith("learner-a");
  });

  it("blocks cross-site writes and scopes accepted writes to the authenticated learner", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    const body = { appId: "app_a", expectedRevision: null, learningRecord: record };
    const rejected = await PUT(new Request("http://localhost:3000/api/learner/studio", { method: "PUT", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect(rejected.status).toBe(403);
    writeStudioLearnerProgress.mockResolvedValue({ appId: "app_a", revision: 1, ...record });
    const accepted = await PUT(new Request("http://localhost:3000/api/learner/studio", { method: "PUT", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) }));
    expect(accepted.status).toBe(200);
    expect(writeStudioLearnerProgress).toHaveBeenCalledWith("learner-a", "app_a", null, record);
  });

  it("archives a project for only the authenticated learner and requires same-origin", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    const blocked = await DELETE(new Request("http://localhost:3000/api/learner/studio?appId=app_a", { method: "DELETE", headers: { origin: "https://attacker.example" } }));
    expect(blocked.status).toBe(403);
    archiveStudioProject.mockResolvedValue(undefined);
    const accepted = await DELETE(new Request("http://localhost:3000/api/learner/studio?appId=app_a", { method: "DELETE", headers: { origin: "http://localhost:3000" } }));
    expect(accepted.status).toBe(200);
    expect(archiveStudioProject).toHaveBeenCalledWith("learner-a", "app_a");
  });
});
