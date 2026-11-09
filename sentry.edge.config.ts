import * as Sentry from "@sentry/nextjs";
import { monitoringEnvironment, monitoringRelease, scrubMonitoringEvent } from "./src/lib/platform/monitoring";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: monitoringEnvironment(),
  release: monitoringRelease(),
  tracesSampleRate: 0,
  beforeSend(event) { return scrubMonitoringEvent(event); },
});
