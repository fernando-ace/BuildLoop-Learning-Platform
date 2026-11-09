import * as Sentry from "@sentry/nextjs";
import { scrubMonitoringEvent } from "./src/lib/platform/monitoring";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_BUILDLOOP_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  release: process.env.NEXT_PUBLIC_BUILDLOOP_RELEASE ?? "local",
  tracesSampleRate: 0,
  beforeSend(event) { return scrubMonitoringEvent(event); },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
