import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("./database", () => ({ getPlatformPool: () => ({ query }) }));

import { listStudioApplications, listStudioLearnerProgress } from "./studio-learner-progress";

describe("Studio library privacy boundaries", () => {
  beforeEach(() => { query.mockReset().mockResolvedValue({ rows: [] }); });

  it("returns project setup notes only to the original owner when no private learner row exists", async () => {
    await listStudioApplications("learner-a");
    expect(query.mock.calls[0][0]).toContain("CASE WHEN sp.owner_user_id=$1 THEN sp.brief ELSE '{}'::jsonb END");
    expect(query.mock.calls[0][0]).toContain("COALESCE(lp.archived,false)=false");
    expect(query.mock.calls[0][1]).toEqual(["learner-a"]);
  });

  it("filters private Studio reflections by both the record owner and that learner's app membership", async () => {
    await listStudioLearnerProgress("learner-a");
    expect(query.mock.calls[0][0]).toContain("m.user_id=$1 WHERE p.user_id=$1");
    expect(query.mock.calls[0][1]).toEqual(["learner-a"]);
  });
});
