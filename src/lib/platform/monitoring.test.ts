import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/core";
import { scrubMonitoringEvent } from "./monitoring";

describe("monitoring event privacy", () => {
  it("removes request payloads and redacts invitation paths and breadcrumb content", () => {
    const event: Event = {
      request: { url: "https://buildloop.example/invite/secret-token?token=query-token#private-fragment", data: "private learner text", headers: { cookie: "session=secret" }, cookies: { session: "session-secret" }, query_string: "token=query-token", env: { Authorization: "Bearer secret" } },
      breadcrumbs: [{ category: "console", message: "private note", data: { prompt: "learner content" }, level: "info" }],
      transaction: "/invite/another-secret?token=transaction-token",
      logentry: { message: "private message", params: ["learner prompt", "secret token"] },
      extra: { prompt: "learner content" },
      user: { email: "learner@example.test" },
    };
    const scrubbed = scrubMonitoringEvent(event);
    expect(scrubbed.request).toEqual({ url: "https://buildloop.example/invite/[redacted]" });
    expect(scrubbed.breadcrumbs).toEqual([{ category: "console", level: "info" }]);
    expect(scrubbed.transaction).toBe("/invite/[redacted]");
    expect(scrubbed.logentry).toEqual({ message: "BuildLoop runtime error" });
    expect(scrubbed).not.toHaveProperty("extra");
    expect(scrubbed).not.toHaveProperty("user");
  });
});
