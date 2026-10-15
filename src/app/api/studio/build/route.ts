import { BuilderError, MAX_BUILDER_INPUT_CHARS, type BuilderRequest } from "@/lib/builder/contract";
import { getBuilder } from "@/lib/builder/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

const hits = new Map<string, number[]>();
const limits = { name: 80, user: 500, problem: 1000, why: 500, behavior: 1000, constraints: 1000 };

function isBoundedText(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }
function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
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
  const project = value.project as Record<string, unknown> | null;
  if (!project || !Object.entries(limits).every(([key, max]) => isBoundedText(project[key], max)) || !Array.isArray(project.inScope) || project.inScope.length > 12 || !project.inScope.every((x) => isBoundedText(x, 180)) || !Array.isArray(project.laterIdeas) || project.laterIdeas.length > 12 || !project.laterIdeas.every((x) => isBoundedText(x, 180))) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  if (!isBoundedText(value.instruction, 1200) || value.instruction.length > MAX_BUILDER_INPUT_CHARS || !["initial", "iteration"].includes(String(value.mode)) || !Number.isInteger(value.version) || Number(value.version) < 1 || Number(value.version) > 20) return Response.json({ error: "The Builder request was incomplete." }, { status: 400 });
  const input = JSON.stringify(body);
  if (input.length > MAX_BUILDER_INPUT_CHARS * 2) return Response.json({ error: "This project has too much history to include in one build." }, { status: 413 });
  const safe: BuilderRequest = {
    project: project as BuilderRequest["project"], mode: value.mode as BuilderRequest["mode"], version: Number(value.version), instruction: value.instruction,
    previous: value.previous as BuilderRequest["previous"],
    observations: Array.isArray(value.observations) ? value.observations.slice(-8) as BuilderRequest["observations"] : [],
    feedback: Array.isArray(value.feedback) ? value.feedback.slice(-8) as BuilderRequest["feedback"] : [],
  };
  try { return Response.json(await getBuilder().generate(safe), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof BuilderError) {
      const status = error.code === "configuration" ? 503 : error.code === "invalid_output" ? 422 : error.code === "timeout" ? 504 : 502;
      const message = error.code === "configuration" ? "The Builder is not configured yet. Ask your project guide to set it up." : error.code === "invalid_output" ? "The Builder returned a version BuildLoop could not safely run. Your project is safe; try again." : "The Builder couldn't connect right now. Your project is safe. Try the build again.";
      return Response.json({ error: message, code: error.code }, { status });
    }
    return Response.json({ error: "The Builder couldn't finish this version. Your project is safe; try again." }, { status: 502 });
  }
}
