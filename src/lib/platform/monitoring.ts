import type { Event } from "@sentry/core";

export function scrubMonitoringEvent<T extends Event>(event: T): T {
  if (!event || typeof event !== "object") return event;
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    delete event.request.env;
    const rawUrl = event.request.url;
    if (typeof rawUrl === "string") {
      try {
        const url = new URL(rawUrl);
        url.pathname = url.pathname.replace(/^\/invite\/[^/]+/, "/invite/[redacted]");
        event.request.url = url.origin + url.pathname;
      } catch { event.request.url = "[redacted]"; }
    }
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
    if (!breadcrumb || typeof breadcrumb !== "object") return {};
    const item = breadcrumb;
    return { category: item.category, timestamp: item.timestamp, type: item.type, level: item.level };
  });
  if (event.contexts) {
    const contexts = event.contexts;
    const safeContexts: NonNullable<Event["contexts"]> = {};
    if (contexts.app?.app_version) safeContexts.app = { app_version: contexts.app.app_version };
    if (contexts.device) safeContexts.device = {
      ...(contexts.device.family ? { family: contexts.device.family } : {}),
      ...(contexts.device.arch ? { arch: contexts.device.arch } : {}),
      ...(contexts.device.device_type ? { device_type: contexts.device.device_type } : {}),
    };
    if (contexts.os) safeContexts.os = {
      ...(contexts.os.name ? { name: contexts.os.name } : {}),
      ...(contexts.os.version ? { version: contexts.os.version } : {}),
    };
    if (typeof contexts.response?.status_code === "number") safeContexts.response = { status_code: contexts.response.status_code };
    if (contexts.trace?.trace_id && contexts.trace.span_id) safeContexts.trace = {
      trace_id: contexts.trace.trace_id,
      span_id: contexts.trace.span_id,
      ...(contexts.trace.parent_span_id ? { parent_span_id: contexts.trace.parent_span_id } : {}),
      ...(contexts.trace.op ? { op: contexts.trace.op } : {}),
      ...(contexts.trace.status ? { status: contexts.trace.status } : {}),
      ...(contexts.trace.origin ? { origin: contexts.trace.origin } : {}),
    };
    event.contexts = safeContexts;
  }
  if (event.transaction) {
    event.transaction = event.transaction
      .split(/[?#]/, 1)[0]
      .replace(/(\/invite\/)[^/]+/g, "$1[redacted]");
  }
  if (event.message) event.message = "BuildLoop runtime error";
  if (event.logentry?.message) event.logentry.message = "BuildLoop runtime error";
  if (event.logentry) delete event.logentry.params;
  if (event.exception?.values) for (const value of event.exception.values) {
    value.value = "BuildLoop runtime error";
    if (value.mechanism) delete value.mechanism.data;
    for (const frame of value.stacktrace?.frames ?? []) delete frame.vars;
  }
  for (const thread of event.threads?.values ?? []) {
    for (const frame of thread.stacktrace?.frames ?? []) delete frame.vars;
  }
  delete event.extra;
  delete event.user;
  delete event.spans;
  delete event.measurements;
  delete event.fingerprint;
  if (event.tags) {
    const operation = event.tags.operation;
    if (typeof operation === "string" && /^[A-Za-z0-9._:-]{1,80}$/.test(operation)) event.tags = { operation };
    else delete event.tags;
  }
  return event;
}

export function monitoringEnvironment() {
  return process.env.BUILDLOOP_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function monitoringRelease() {
  return process.env.BUILDLOOP_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
}
