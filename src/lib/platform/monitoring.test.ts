import { describe, expect, it } from "vitest";
import { scrubMonitoringEvent } from "./monitoring";

describe("monitoring event privacy", () => {
  it("removes request payloads and redacts invitation paths and breadcrumb content", () => {
    const event = {
      request: { url: "https://buildloop.example/invite/secret-token?token=query-token", data: "private learner text", headers: { cookie: "session=secret" }, query_string: "token=query-token" },
      breadcrumbs: [{ category: "console", message: "private note", data: { prompt: "learner content" }, level: "info" }],
      extra: { prompt: "learner content" },
      user: { email: "learner@example.test" },
    };
    const scrubbed = scrubMonitoringEvent(event);
    expect(scrubbed.request).toEqual({ url: "https://buildloop.example/invite/[redacted]" });
    expect(scrubbed.breadcrumbs).toEqual([{ category: "console", level: "info" }]);
    expect(scrubbed).not.toHaveProperty("extra");
    expect(scrubbed).not.toHaveProperty("user");
  });
});
