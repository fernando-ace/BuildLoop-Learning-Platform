import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.fn();
const readLearnerProgress = vi.fn();
const writeLearnerProgress = vi.fn();
vi.mock("@/lib/platform/session", () => ({ getPlatformIdentity: (...args: unknown[]) => identity(...args) }));
vi.mock("@/lib/platform/learner-progress", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/platform/learner-progress")>();
  return { ...original, readLearnerProgress: (...args: unknown[]) => readLearnerProgress(...args), writeLearnerProgress: (...args: unknown[]) => writeLearnerProgress(...args) };
});

import { GET, PUT } from "./route";

const validProgress = {
  activeMission: 1,
  mission1State: { stage: 0 }, mission1Progress: { attempts: [] },
  mission2State: { stage: 0 }, mission2Progress: { attempts: [] }, mission2AttemptCount: 0,
  mission3State: { stage: 0 }, mission3Progress: { attempts: [] },
  mission4State: { stage: 0 }, mission4Progress: { attempts: [] },
  mission5State: { stage: 0 }, mission5Progress: { attempts: [] },
  mission6State: { stage: 0 }, mission6Progress: { attempts: [] },
};

describe("learner progress route", () => {
  beforeEach(() => { identity.mockReset(); readLearnerProgress.mockReset(); writeLearnerProgress.mockReset(); });

  it("reads only the signed-in user's record", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    readLearnerProgress.mockResolvedValue({ revision: 2, activeMission: 4 });
    const response = await GET(new Request("http://localhost:3000/api/learner/progress"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(readLearnerProgress).toHaveBeenCalledWith("learner-a");
  });

  it("rejects unauthenticated access and cross-site writes", async () => {
    identity.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost:3000/api/learner/progress"))).status).toBe(401);
    const response = await PUT(new Request("http://localhost:3000/api/learner/progress", { method: "PUT", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: null, progress: validProgress }) }));
    expect(response.status).toBe(403);
    expect(writeLearnerProgress).not.toHaveBeenCalled();
  });

  it("saves against the authenticated user and supplied record revision", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    writeLearnerProgress.mockResolvedValue({ revision: 5, activeMission: 1 });
    const response = await PUT(new Request("http://localhost:3000/api/learner/progress", { method: "PUT", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: 4, progress: validProgress }) }));
    expect(response.status).toBe(200);
    expect(writeLearnerProgress).toHaveBeenCalledWith("learner-a", 4, validProgress);
  });
});
