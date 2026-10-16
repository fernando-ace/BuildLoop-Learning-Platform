import { describe, expect, it } from "vitest";
import { validateArtifact } from "./contract";
import { deterministicBuilder } from "./provider";
import { permissionBoundaryLabV4 } from "./v4-fixtures";

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
    const result = await deterministicBuilder.generate(request("Students need equipment checkout and returns", "Track borrowers, gear, and active checkouts as linked records."));
    expect(result.provider).toBe("deterministic");
    expect(result.artifact.format).toBe("buildloop-app-v3");
    if (result.artifact.format === "buildloop-app-v3") expect(result.artifact.workflows.map((workflow) => workflow.id)).toEqual(["checkout_item", "return_item"]);
  });

  it("adds an owned cancellation workflow without widening another role's access", async () => {
    const initial = await deterministicBuilder.generate(request("Create a permission boundary lab for volunteers with private signups", "Connect volunteers, shifts, and registrations with member and admin roles."));
    expect(initial.artifact.format).toBe("buildloop-app-v4");
    const previous = initial.artifact.format === "buildloop-app-v4" ? initial.artifact : permissionBoundaryLabV4;
    const next = await deterministicBuilder.generate({ ...request("Volunteers can cancel their own signup but not someone else's", "Let each volunteer cancel their own signup, but not another volunteer's signup."), previous, mode: "iteration", version: 2 });
    expect(next.artifact.format).toBe("buildloop-app-v4");
    if (next.artifact.format === "buildloop-app-v4") {
      const removal = next.artifact.permissions.find((permission) => permission.collection === "registrations" && permission.operations.includes("delete") && permission.visibility === "owned");
      expect(removal?.role).toBe("member");
      expect(removal?.ownership).toMatchObject({ op: "equals", left: { op: "recordField", field: "volunteer_id" }, right: { op: "userField", field: "id" } });
      const cancel = next.artifact.workflows.find((workflow) => workflow.collection === "registrations" && /cancel|remove/i.test(workflow.id));
      expect(cancel?.steps).toEqual([expect.objectContaining({ type: "delete", collection: "registrations", target: "current" })]);
      expect(next.artifact.workflowPermissions.find((item) => item.workflow === cancel?.id)?.roles).toContain("member");
      expect(next.artifact.permissions.some((permission) => permission.role === "admin" && permission.collection === "registrations" && permission.visibility === "owned" && permission.operations.includes("delete"))).toBe(false);
    }
  });
});
