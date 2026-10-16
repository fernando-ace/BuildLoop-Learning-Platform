import { BuilderError, MAX_BUILDER_INPUT_CHARS, validateArtifact, type BuilderRequest } from "@/lib/builder/contract";
import { getBuilder } from "@/lib/builder/provider";
import { getPlatformIdentity } from "@/lib/platform/session";
import { getPlatformRepository, PlatformError } from "@/lib/platform/repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const hits = new Map<string, number[]>();
const limits = { name: 80, user: 500, problem: 1000, why: 500, behavior: 1000, constraints: 1000 };

function isBoundedText(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  const identity = await getPlatformIdentity(request);
  if (!identity) return Response.json({ error: "Sign in to build in Studio." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (process.env.BUILDLOOP_BUILDER_MODE !== "deterministic") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",");
    const ip = forwarded?.at(-1)?.trim() || "local";
    const now = Date.now(); const recent = (hits.get(ip) ?? []).filter((at) => now - at < 60_000);
    if (recent.length >= 5) return Response.json({ error: "Too many builds just now. Wait a minute and try again." }, { status: 429 });
    recent.push(now); hits.set(ip, recent);
  }
  let body: unknown;
  try { const raw = await request.text(); if (raw.length > MAX_BUILDER_INPUT_CHARS * 2) return Response.json({ error: "This project brief is too long to build." }, { status: 413 }); body = JSON.parse(raw); } catch { return Response.json({ error: "The Builder request was incomplete." }, { status: 400 }); }
  if (!body || typeof body !== "object") return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.appId !== "string" || !/^app_[0-9a-f-]{36}$/.test(value.appId)) return Response.json({ error: "Open a saved Studio project before building." }, { status: 400 });
  const project = value.project as Record<string, unknown> | null;
  if (!project || !Object.entries(limits).every(([key, max]) => isBoundedText(project[key], max)) || !Array.isArray(project.inScope) || project.inScope.length > 12 || !project.inScope.every((x) => isBoundedText(x, 180)) || !Array.isArray(project.laterIdeas) || project.laterIdeas.length > 12 || !project.laterIdeas.every((x) => isBoundedText(x, 180))) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  if (!isBoundedText(value.instruction, 1200) || value.instruction.length > MAX_BUILDER_INPUT_CHARS || !["initial", "iteration"].includes(String(value.mode)) || !Number.isInteger(value.version) || Number(value.version) < 1 || Number(value.version) > 20) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  const observationRows = Array.isArray(value.observations) ? value.observations.slice(-8) : [];
  if (observationRows.some((entry) => isRecord(entry) && Object.values(entry).some((item) => typeof item === "string" && item.length > 1_000))) return Response.json({ error: "The project history is too long to include in one build." }, { status: 413 });
  if (observationRows.some((entry) => !isRecord(entry) || Object.keys(entry).some((key) => !["action", "expected", "happened", "kind", "version"].includes(key)) || !["action", "expected", "happened"].every((key) => typeof entry[key] === "string") || !["core", "nearby"].includes(String(entry.kind)) || !Number.isInteger(entry.version))) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  const feedbackRows = Array.isArray(value.feedback) ? value.feedback.slice(-8) : [];
  if (feedbackRows.some((entry) => isRecord(entry) && Object.values(entry).some((item) => typeof item === "string" && item.length > 1_000))) return Response.json({ error: "The project history is too long to include in one build." }, { status: 413 });
  if (feedbackRows.some((entry) => !isRecord(entry) || Object.keys(entry).some((key) => !["from", "note", "version"].includes(key)) || typeof entry.from !== "string" || typeof entry.note !== "string" || !Number.isInteger(entry.version))) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  if (feedbackRows.some((entry) => (entry as Record<string, string>).from.length > 100)) return Response.json({ error: "The project history is too long to include in one build." }, { status: 413 });
  const previousValidation = value.previous === undefined ? undefined : validateArtifact(value.previous);
  if (previousValidation && !previousValidation.ok) return Response.json({ error: "The previous app version is not valid for another build." }, { status: 400 });
  const input = JSON.stringify(body);
  if (input.length > MAX_BUILDER_INPUT_CHARS * 2) return Response.json({ error: "This project has too much history to include in one build." }, { status: 413 });
  const safe: BuilderRequest = {
    project: project as BuilderRequest["project"], mode: value.mode as BuilderRequest["mode"], version: Number(value.version), instruction: value.instruction,
    previous: previousValidation?.artifact,
    observations: observationRows as BuilderRequest["observations"],
    feedback: feedbackRows as BuilderRequest["feedback"],
  };
  try {
    const result = await getBuilder().generate(safe);
    if (!(process.env.NODE_ENV === "test" && process.env.BUILDLOOP_TEST_DB_PERSISTENCE !== "1")) {
      await getPlatformRepository().saveVersion(identity, value.appId, safe.version, result.artifact, { provider: result.provider, attempts: result.attempts, projectName: project.name });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  }
  catch (error) {
    if (error instanceof PlatformError) return Response.json({ error: error.message, code: error.code }, { status: error.code === "forbidden" ? 403 : error.code === "conflict" ? 409 : 400, headers: { "Cache-Control": "no-store" } });
    if (error instanceof BuilderError) {
      const status = error.code === "configuration" ? 503 : error.code === "invalid_output" ? 422 : error.code === "timeout" ? 504 : 502;
      const message = error.code === "configuration" ? "The Builder is not configured yet. Ask your project guide to set it up." : error.code === "invalid_output" ? "The Builder returned a version BuildLoop could not safely run. Your project is safe; try again." : "The Builder couldn't connect right now. Your project is safe. Try the build again.";
      return Response.json({ error: message, code: error.code }, { status });
    }
    return Response.json({ error: "The Builder couldn't finish this version. Your project is safe; try again." }, { status: 502 });
  }
}
