import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.fn();
const readVersion = vi.fn();
const getApplication = vi.fn();
const saveVersion = vi.fn();
vi.mock("@/lib/platform/session", () => ({ getPlatformIdentity: (...args: unknown[]) => identity(...args) }));
vi.mock("@/lib/platform/repository", () => ({ getPlatformRepository: () => ({ readVersion, getApplication, saveVersion }) }));

import { GET } from "./route";

describe("app version read API", () => {
  beforeEach(() => { identity.mockReset(); readVersion.mockReset(); getApplication.mockReset(); saveVersion.mockReset(); });

  it("loads a version artifact only through the authenticated member identity", async () => {
    identity.mockResolvedValue({ id: "learner-a" });
    readVersion.mockResolvedValue({ versionId: "v2", versionNumber: 2, artifact: { title: "Planner" } });
    const response = await GET(new Request("http://localhost/api/apps/app_a/versions?versionId=v2"), { params: Promise.resolve({ appId: "app_a" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: { versionNumber: 2, artifact: { title: "Planner" } } });
    expect(readVersion).toHaveBeenCalledWith("learner-a", "app_a", "v2");
    expect(getApplication).not.toHaveBeenCalled();
  });
});
