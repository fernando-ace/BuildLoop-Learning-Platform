import { describe, expect, it } from "vitest";
import { validateArtifact } from "./contract";
import { deterministicBuilder } from "./provider";

const request = (problem: string, instruction: string) => ({
  project: { name: "My project", user: "Our campus group", problem, why: "Make the task easier", behavior: instruction, constraints: "Keep it local", inScope: ["Track records"], laterIdeas: [] },
  mode: "initial" as const, version: 1, instruction, observations: [], feedback: [],
});

describe("deterministic V3 Builder fallback", () => {
  it("selects a validated relational fixture without claiming OpenAI generation", async () => {
    const result = await deterministicBuilder.generate(request("Volunteers need to register for event shifts and see capacity", "Connect shifts, volunteers, and signups."));
    expect(result.provider).toBe("deterministic");
    expect(result.artifact.format).toBe("buildloop-app-v3");
    expect(validateArtifact(result.artifact)).toMatchObject({ ok: true });
  });

  it("selects the equipment fixture for borrowing workflows", async () => {
    const result = await deterministicBuilder.generate(request("Students need equipment checkout and returns", "Track borrowers, gear, and active checkouts."));
    expect(result.provider).toBe("deterministic");
    expect(result.artifact.format).toBe("buildloop-app-v3");
    if (result.artifact.format === "buildloop-app-v3") expect(result.artifact.workflows.map((workflow) => workflow.id)).toEqual(["checkout_item", "return_item"]);
  });
});
