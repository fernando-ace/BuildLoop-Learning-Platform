import { randomUUID } from "node:crypto";
import { getReleaseMetadata } from "./config";

type LogFields = Record<string, string | number | boolean | null | undefined>;

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const record = { timestamp: new Date().toISOString(), level, event, ...getReleaseMetadata(), ...fields };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
