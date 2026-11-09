import { describe, expect, it } from "vitest";
import { PlatformError } from "./repository";
import { validateStudioLearnerSnapshot } from "./studio-learner-progress";

const record = () => ({
  stage: "feedback",
  projectNotes: { user: "A student", problem: "Missed a class detail", why: "They need to plan", behavior: "Record it", constraints: "", instruction: "Build a planner", brief: null, nextGoal: "Try it", shareDecision: "" },
  features: [{ id: "calendar", text: "Calendar", inV1: true }],
  observations: [{ action: "Add a class", expected: "Saved", happened: "Saved", kind: "core", version: 1 }],
  feedback: [{ from: "Me", note: "Clear", version: 1 }],
  versionNotes: [{ number: 1, instruction: "Build a class planner", builtAt: "2026-11-01T00:00:00.000Z", notes: "First attempt", tested: true, observations: ["Added a class"], feedback: ["Me: Clear"], retestedVersion: null }],
});

describe("private Studio learner record", () => {
  it("accepts explicit reflection and version learning data", () => {
    expect(validateStudioLearnerSnapshot(record())).toMatchObject({ stage: "feedback", features: [{ id: "calendar" }] });
  });

  it("rejects an unknown stage and malformed learner reflection", () => {
    expect(() => validateStudioLearnerSnapshot({ ...record(), stage: "published" })).toThrow(PlatformError);
    expect(() => validateStudioLearnerSnapshot({ ...record(), feedback: [{ from: "Me", note: "missing version" }] })).toThrow(PlatformError);
  });

  it("bounds personally authored reflection before storage", () => {
    const value = record();
    value.projectNotes.problem = "x".repeat(10_001);
    expect(() => validateStudioLearnerSnapshot(value)).toThrow("too long");
  });
});
