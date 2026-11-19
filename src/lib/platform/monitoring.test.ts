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
      contexts: {
        response: { headers: { "set-cookie": "session=response-secret" }, cookies: { session: "response-cookie" }, status_code: 401 },
        trace: { trace_id: "trace-id", span_id: "span-id", data: { "http.url": "https://buildloop.example/?prompt=private" }, tags: { prompt: "private learner text" } },
        device: { device_unique_identifier: "device-id", name: "private-hostname", family: "desktop" },
        app: { app_identifier: "private-app-id", app_version: "0.1.0" },
        state: { state: { type: "learner", value: { prompt: "private learner text" } } },
        profile: { profile_id: "private-profile-id" },
        culture: { locale: "private-locale" },
        cloud_resource: { "cloud.account.id": "private-cloud-account" },
        custom: { prompt: "private custom context" },
      },
      exception: { values: [{ type: "Error", value: "private error", mechanism: { type: "generic", data: { target: "private target" } }, stacktrace: { frames: [{ filename: "route.ts", vars: { token: "stack-secret" } }] } }] },
      threads: { values: [{ name: "main", stacktrace: { frames: [{ filename: "route.ts", vars: { prompt: "thread-private" } }] } }] },
      spans: [{ trace_id: "trace-id", span_id: "span-id", start_timestamp: 1, status: "ok", data: { "http.url": "https://buildloop.example/?token=span-secret" } }],
      fingerprint: ["private-fingerprint"],
      tags: { operation: "monitoring.test", accountId: "private-account-id" },
      extra: { prompt: "learner content" },
      user: { email: "learner@example.test" },
    };
    const scrubbed = scrubMonitoringEvent(event);
    expect(scrubbed.request).toEqual({ url: "https://buildloop.example/invite/[redacted]" });
    expect(scrubbed.breadcrumbs).toEqual([{ category: "console", level: "info" }]);
    expect(scrubbed.transaction).toBe("/invite/[redacted]");
    expect(scrubbed.logentry).toEqual({ message: "BuildLoop runtime error" });
    expect(scrubbed.contexts).toEqual({
      response: { status_code: 401 },
      trace: { trace_id: "trace-id", span_id: "span-id" },
      device: { family: "desktop" },
      app: { app_version: "0.1.0" },
    });
    expect(scrubbed.exception?.values?.[0]).toMatchObject({ type: "Error", value: "BuildLoop runtime error", mechanism: { type: "generic" }, stacktrace: { frames: [{ filename: "route.ts" }] } });
    expect(scrubbed.threads?.values[0].stacktrace?.frames?.[0]).toEqual({ filename: "route.ts" });
    expect(scrubbed).not.toHaveProperty("spans");
    expect(scrubbed).not.toHaveProperty("fingerprint");
    expect(scrubbed.tags).toEqual({ operation: "monitoring.test" });
    expect(scrubbed).not.toHaveProperty("extra");
    expect(scrubbed).not.toHaveProperty("user");
  });
});
