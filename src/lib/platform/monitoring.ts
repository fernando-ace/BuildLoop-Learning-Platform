export function scrubMonitoringEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  const mutable = event as { request?: { [key: string]: unknown }; breadcrumbs?: unknown[]; extra?: unknown; user?: unknown; message?: string; transaction?: string; logentry?: { [key: string]: unknown }; exception?: { values?: Array<{ value?: string }> } };
  if (mutable.request) {
    delete mutable.request.data;
    delete mutable.request.cookies;
    delete mutable.request.headers;
    delete mutable.request.query_string;
    const rawUrl = mutable.request.url;
    if (typeof rawUrl === "string") {
      try {
        const url = new URL(rawUrl);
        url.pathname = url.pathname.replace(/^\/invite\/[^/]+/, "/invite/[redacted]");
        mutable.request.url = url.origin + url.pathname;
      } catch { mutable.request.url = "[redacted]"; }
    }
  }
  if (mutable.breadcrumbs) mutable.breadcrumbs = mutable.breadcrumbs.map((breadcrumb) => {
    if (!breadcrumb || typeof breadcrumb !== "object") return {};
    const item = breadcrumb as Record<string, unknown>;
    return { category: item.category, timestamp: item.timestamp, type: item.type, level: item.level };
  });
  if (mutable.transaction) mutable.transaction = mutable.transaction.replace(/^\/invite\/[^/]+/, "/invite/[redacted]");
  if (mutable.message) mutable.message = "BuildLoop runtime error";
  if (mutable.logentry?.message) mutable.logentry.message = "BuildLoop runtime error";
  if (mutable.exception?.values) for (const value of mutable.exception.values) value.value = "BuildLoop runtime error";
  delete mutable.extra;
  delete mutable.user;
  return event;
}

export function monitoringEnvironment() {
  return process.env.BUILDLOOP_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function monitoringRelease() {
  return process.env.BUILDLOOP_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "local";
}
