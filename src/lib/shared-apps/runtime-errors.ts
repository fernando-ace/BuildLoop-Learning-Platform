export type SharedErrorCode = "validation" | "authorization" | "not_found" | "conflict" | "constraint" | "stale_version" | "migration" | "workflow" | "persistence";
export class SharedRuntimeError extends Error {
  constructor(public readonly code: SharedErrorCode, message: string, public readonly details?: unknown) { super(message); }
}

export type SharedOperation =
  | { type: "create"; collection: string; values: Record<string, unknown> }
  | { type: "update"; collection: string; recordId: string; values: Record<string, unknown> }
  | { type: "delete"; collection: string; recordId: string }
  | { type: "workflow"; workflow: string; recordId: string; inputs?: Record<string, string | number | boolean | null | string[]> };
