import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const release = vi.fn();
vi.mock("./database", () => ({ getPlatformPool: () => ({ connect: async () => ({ query: execute, release }) }) }));

import { PlatformError } from "./repository";
import { archiveStudioProject, writeStudioLearnerProgress } from "./studio-learner-progress";

const record = {
  stage: "idea",
  projectNotes: { user: "", problem: "", why: "", behavior: "", constraints: "", instruction: "", brief: null, nextGoal: "", shareDecision: "" },
  features: [], observations: [], feedback: [], versionNotes: [],
};

describe("private Studio record access", () => {
  beforeEach(() => { execute.mockReset(); release.mockReset(); });

  it("requires membership in the exact associated app before inserting a private record", async () => {
    execute.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rows: [{ user_id: "learner-a", app_id: "app_a", stage: "idea", project_notes: record.projectNotes, features: [], observations: [], feedback: [], version_notes: [], revision: 1, updated_at: new Date() }] });
    const result = await writeStudioLearnerProgress("learner-a", "app_a", null, record);
    expect(result.revision).toBe(1);
    expect(execute.mock.calls[0][1]).toEqual(["app_a", "learner-a"]);
    expect(execute.mock.calls[1][0]).toContain("ON CONFLICT(user_id,app_id) DO NOTHING");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects a learner without membership before any write", async () => {
    execute.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(writeStudioLearnerProgress("learner-a", "app_b", null, record)).rejects.toMatchObject<Partial<PlatformError>>({ code: "not_found" });
    expect(execute).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("uses a per-learner revision check for concurrent updates", async () => {
    execute.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rows: [] });
    await expect(writeStudioLearnerProgress("learner-a", "app_a", 2, record)).rejects.toMatchObject<Partial<PlatformError>>({ code: "conflict" });
    expect(execute.mock.calls[1][0]).toContain("WHERE user_id=$1 AND app_id=$2 AND revision=$9");
  });

  it("archives a Studio project only in the signed-in learner's library", async () => {
    execute.mockResolvedValueOnce({ rowCount: 1, rows: [] }).mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await archiveStudioProject("learner-a", "app_a");
    expect(execute.mock.calls[0][1]).toEqual(["app_a", "learner-a"]);
    expect(execute.mock.calls[1][0]).toContain("archived=true");
    expect(execute.mock.calls[1][1]).toEqual(["learner-a", "app_a"]);
  });
});
