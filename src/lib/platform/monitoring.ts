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
  if (event.transaction) {
    event.transaction = event.transaction
      .split(/[?#]/, 1)[0]
      .replace(/(\/invite\/)[^/]+/g, "$1[redacted]");
  }
  if (event.message) event.message = "BuildLoop runtime error";
  if (event.logentry?.message) event.logentry.message = "BuildLoop runtime error";
  if (event.logentry) delete event.logentry.params;
  if (event.exception?.values) for (const value of event.exception.values) value.value = "BuildLoop runtime error";
  delete event.extra;
  delete event.user;
  return event;
}

export function monitoringEnvironment() {
  return process.env.BUILDLOOP_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function monitoringRelease() {
  return process.env.BUILDLOOP_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
}
