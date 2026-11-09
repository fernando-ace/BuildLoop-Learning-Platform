import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const lookup = vi.fn();
const release = vi.fn();
vi.mock("./database", () => ({ getPlatformPool: () => ({ connect: async () => ({ query: execute, release }), query: lookup }) }));

import { PlatformError } from "./repository";
import { writeLearnerProgress } from "./learner-progress";

const progress = {
  activeMission: 1,
  mission1State: { stage: 0 }, mission1Progress: { attempts: 0 },
  mission2State: { stage: 0 }, mission2Progress: { attempts: [] }, mission2AttemptCount: 0,
  mission3State: { stage: 0 }, mission3Progress: { attempts: [] },
  mission4State: { stage: 0 }, mission4Progress: { attempts: [] },
  mission5State: { stage: 0 }, mission5Progress: { attempts: [] },
  mission6State: { stage: 0 }, mission6Progress: { attempts: [] },
};

describe("learner progress revision writes", () => {
  beforeEach(() => { execute.mockReset(); lookup.mockReset(); release.mockReset(); });

  it("writes only for the requested learner and matching revision", async () => {
    execute.mockResolvedValue({ rows: [{ user_id: "learner-a", revision: 2, updated_at: new Date(), ...progress }] });
    const saved = await writeLearnerProgress("learner-a", 1, progress);
    expect(saved.revision).toBe(2);
    expect(execute.mock.calls[0][0]).toContain("WHERE user_id = $1 AND revision = $16");
    expect(execute.mock.calls[0][1][0]).toBe("learner-a");
    expect(execute.mock.calls[0][1][15]).toBe(1);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects a stale write without replacing the current account record", async () => {
    execute.mockResolvedValue({ rows: [] });
    lookup.mockResolvedValue({ rows: [{ user_id: "learner-a", revision: 3, updated_at: new Date() }] });
    await expect(writeLearnerProgress("learner-a", 2, progress)).rejects.toMatchObject<Partial<PlatformError>>({ code: "conflict" });
    expect(execute.mock.calls[0][0]).toContain("WHERE user_id = $1 AND revision = $16");
  });
});
