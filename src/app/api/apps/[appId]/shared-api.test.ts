import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { volunteerCoordinationV4 } from "@/lib/builder/v4-fixtures";
import { closeSharedAppRepository, getSharedAppRepository } from "@/lib/shared-apps/store";
import { POST as selectIdentity } from "./identity/route";
import { POST as mutate } from "./mutations/route";
import { GET as loadApp } from "./route";

const directories: string[] = [];
afterEach(() => {
  closeSharedAppRepository();
  delete process.env.BUILDLOOP_SHARED_DB_PATH;
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("published app HTTP boundary", () => {
  it("uses the signed persona cookie rather than user and role values in a browser request", async () => {
    const directory = mkdtempSync(join(tmpdir(), "buildloop-shared-api-"));
    directories.push(directory);
    process.env.BUILDLOOP_SHARED_DB_PATH = join(directory, "shared.sqlite");
    const repository = getSharedAppRepository();
    repository.publish("http-app", 1, volunteerCoordinationV4);
    const context = { params: Promise.resolve({ appId: "http-app" }) };
    const identityResponse = await selectIdentity(new Request("http://localhost/api/apps/http-app/identity", { method: "POST", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ userId: "vol_ada" }) }), context);
    expect(identityResponse.status).toBe(200);
    const cookie = identityResponse.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toContain("buildloop_identity_http-app=");
    if (!cookie) throw new Error("Expected the identity route to set a signed persona cookie.");

    const forged = await mutate(new Request("http://localhost/api/apps/http-app/mutations", { method: "POST", headers: { origin: "http://localhost", host: "localhost", cookie, "content-type": "application/json" }, body: JSON.stringify({ versionId: "v1", user: { id: "vol_coordinator", roles: ["coordinator"] }, operation: { type: "update", collection: "shifts", recordId: "shift_setup", values: { capacity: 999 } } }) }), context);
    expect(forged.status).toBe(403);

    const crossSite = await mutate(new Request("http://localhost/api/apps/http-app/mutations", { method: "POST", headers: { host: "localhost", cookie, "content-type": "application/json" }, body: JSON.stringify({ versionId: "v1", operation: { type: "delete", collection: "registrations", recordId: "registration_ada" } }) }), context);
    expect(crossSite.status).toBe(403);

    const response = await loadApp(new Request("http://localhost/api/apps/http-app", { headers: { cookie } }), context);
    const body = await response.json();
    expect(body.user.id).toBe("vol_ada");
    expect(body.artifact.collections.find((collection: { id: string }) => collection.id === "registrations").seed).toEqual([]);
  });
});
