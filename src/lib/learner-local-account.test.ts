import { describe, expect, it, vi } from "vitest";
import { applyCloudLearnerSnapshot, captureLocalLearnerCopy, getCloudLearnerSnapshot, getInitialCloudLearnerSnapshot, restoreLocalLearnerCopy } from "./store";

describe("Mission browser cache account isolation", () => {
  it("switches linked accounts without showing or losing the previous learner's progress", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (name: string) => values.get(name) ?? null,
      setItem: (name: string, value: string) => { values.set(name, value); },
      removeItem: (name: string) => { values.delete(name); },
    } });
    try {
      const learnerA = { ...getInitialCloudLearnerSnapshot(), activeMission: 4 };
      expect(applyCloudLearnerSnapshot(learnerA)).toBe(true);
      values.set("buildloop-learner-v2:cloud-link", JSON.stringify({ userId: "learner-a", cleanSnapshot: "a" }));
      expect(captureLocalLearnerCopy("learner-a")).toBe(true);

      expect(restoreLocalLearnerCopy("learner-b")).toBe(true);
      expect(getCloudLearnerSnapshot().activeMission).toBe(1);
      expect(values.has("buildloop-learner-v2:cloud-link")).toBe(false);

      const learnerB = { ...getInitialCloudLearnerSnapshot(), activeMission: 2 };
      expect(applyCloudLearnerSnapshot(learnerB)).toBe(true);
      values.set("buildloop-learner-v2:cloud-link", JSON.stringify({ userId: "learner-b", cleanSnapshot: "b" }));
      expect(captureLocalLearnerCopy("learner-b")).toBe(true);

      expect(restoreLocalLearnerCopy("learner-a")).toBe(true);
      expect(getCloudLearnerSnapshot().activeMission).toBe(4);
      expect(JSON.parse(values.get("buildloop-learner-v2:cloud-link") ?? "{}").userId).toBe("learner-a");
    } finally { vi.unstubAllGlobals(); }
  });
});
