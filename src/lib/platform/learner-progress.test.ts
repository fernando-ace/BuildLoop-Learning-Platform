import { describe, expect, it } from "vitest";
import { PlatformError } from "./repository";
import { validateLearnerSnapshot } from "./learner-progress";

function snapshot() {
  return {
    activeMission: 1,
    mission1State: { stage: 0 }, mission1Progress: { attempts: [] },
    mission2State: { stage: 0 }, mission2Progress: { attempts: [] }, mission2AttemptCount: 0,
    mission3State: { stage: 0 }, mission3Progress: { attempts: [] },
    mission4State: { stage: 0 }, mission4Progress: { attempts: [] },
    mission5State: { stage: 0 }, mission5Progress: { attempts: [] },
    mission6State: { stage: 0 }, mission6Progress: { attempts: [] },
  };
}

describe("learner progress persistence contract", () => {
  it("accepts the six mission checkpoints and attempt records", () => {
    expect(validateLearnerSnapshot(snapshot())).toMatchObject({ activeMission: 1, mission6Progress: { attempts: [] } });
  });

  it("rejects an invalid active mission or malformed mission checkpoint", () => {
    expect(() => validateLearnerSnapshot({ ...snapshot(), activeMission: 7 })).toThrow(PlatformError);
    expect(() => validateLearnerSnapshot({ ...snapshot(), mission3Progress: [] })).toThrow(PlatformError);
  });

  it("bounds learner supplied state before writing it to PostgreSQL", () => {
    expect(() => validateLearnerSnapshot({ ...snapshot(), mission1State: { stage: 1, note: "x".repeat(1_000_001) } })).toThrow("too large");
  });
});
