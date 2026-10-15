export type StudioStage = "idea" | "scope" | "brief" | "try" | "feedback" | "goal" | "retest" | "summary";
export interface StudioFeature { id: string; text: string; inV1: boolean }
export interface StudioObservation { action: string; expected: string; happened: string; kind: "core" | "nearby"; version: number }
export interface StudioFeedback { from: string; note: string; version: number }
export interface StudioVersion { number: number; instruction: string; builtAt: string; status: "complete"; notes: string; tested: boolean; result: BuilderResult; observations?: string[]; feedback?: string[]; retestedVersion?: number }
export interface BuilderBrief { user: string; problem: string; behavior: string; constraints: string; scope: string[] }
export interface BuilderResult { title: string; description: string; provider: "demo" | "openai" | "deterministic"; instruction: string; artifact?: import("./builder/contract").GeneratedApp; attempts?: number; usage?: { inputTokens?: number; outputTokens?: number } }
export interface StudioBuild { status: "ready" | "building" | "validating" | "complete" | "failed"; message?: string; attempts: number; startedAt?: string }
export interface StudioProject { id: string; name: string; user: string; problem: string; why: string; stage: StudioStage; features: StudioFeature[]; behavior: string; constraints: string; instruction: string; brief: BuilderBrief | null; versions: StudioVersion[]; observations: StudioObservation[]; feedback: StudioFeedback[]; nextGoal: string; shareDecision: "ready" | "keep_working" | ""; createdAt: string; updatedAt: string; build?: StudioBuild }
export interface StudioState { projects: StudioProject[]; activeId: string | null; screen: "missions" | "hub" | "new" | "project" }
export const initialStudioState: StudioState = { projects: [], activeId: null, screen: "missions" };
export function currentProject(state: StudioState) { return state.projects.find((p) => p.id === state.activeId) ?? null; }
export function createProject(input: Pick<StudioProject, "name" | "user" | "problem" | "why">, id = crypto.randomUUID(), now = new Date().toISOString()): StudioProject {
  return { ...input, id, stage: "idea", features: [], behavior: "", constraints: "", instruction: "", brief: null, versions: [], observations: [], feedback: [], nextGoal: "", shareDecision: "", createdAt: now, updatedAt: now };
}
export function problemCoaching(problem: string, user: string): string | null {
  const p = problem.trim().toLowerCase(), u = user.trim().toLowerCase();
  if (!p) return "What gets in this person’s way? A rough answer is enough to start.";
  if (/^(everyone|anyone|people|all people|everybody)$/.test(u)) return "Try naming one kind of person who would use this first.";
  if (/^(build|make|create|add|develop)\b/.test(p)) return "That sounds like a feature. What problem would that solve for someone?";
  if (p.length < 18) return "Can you say what happens and why it is difficult for them?";
  return null;
}
export function buildBrief(project: StudioProject): BuilderBrief { return { user: project.user, problem: project.problem, behavior: project.behavior, constraints: project.constraints, scope: project.features.filter((f) => f.inV1).map((f) => f.text) }; }
export function inspectBrief(brief: BuilderBrief) { return { user: Boolean(brief.user.trim()), problem: Boolean(brief.problem.trim()), behavior: Boolean(brief.behavior.trim()), constraints: Boolean(brief.constraints.trim()), scope: brief.scope.length > 0 }; }
export function inspectInstruction(brief: BuilderBrief, instruction: string) {
  const text = instruction.toLowerCase();
  const mentions = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !["they", "them", "that", "this", "with", "from", "when", "what", "need", "want", "help"].includes(word)).some((word) => text.includes(word));
  return { user: mentions(brief.user), problem: mentions(brief.problem), behavior: mentions(brief.behavior), constraints: brief.constraints.trim() ? mentions(brief.constraints) : false, scope: brief.scope.length > 0 && brief.scope.some(mentions) };
}
export function goalCoaching(goal: string) { const value = goal.trim(); if (!value) return "What should a person be able to do after this change?"; if (/\b(add|use|write|create)\b.{0,35}\b(array|javascript|function|database|component|api)\b/i.test(value)) return "Try describing the behavior you want first. You can still add implementation details after that."; if (value.length < 18 || /^(make it better|improve it|fix it|make it work)$/i.test(value)) return "Make the goal observable: what should the user be able to do?"; return null; }
export function recordBuild(project: StudioProject, result: BuilderResult, now = new Date().toISOString()): StudioProject {
  const version: StudioVersion = { number: project.versions.length + 1, instruction: result.instruction, builtAt: now, status: "complete", notes: "", tested: false, result, observations: [], feedback: [], retestedVersion: project.versions.at(-1)?.number };
  return { ...project, versions: [...project.versions, version], stage: "try", build: { status: "complete", attempts: result.attempts ?? 1 } };
}
export function setBuildState(project: StudioProject, status: StudioBuild["status"], details: Partial<StudioBuild> = {}): StudioProject { return { ...project, build: { status, attempts: project.build?.attempts ?? 0, ...details } }; }
export function recordObservation(project: StudioProject, observation: Omit<StudioObservation, "version">): StudioProject {
  if (!project.versions.length) return project;
  const latest = project.versions.at(-1)!;
  const versions = project.versions.map((version) => version.number === latest.number ? { ...version, tested: true, observations: [...(version.observations ?? []), `${observation.action}: ${observation.happened}`] } : version);
  return { ...project, versions, observations: [...project.observations, { ...observation, version: latest.number }] };
}
export function recordFeedback(project: StudioProject, feedback: Omit<StudioFeedback, "version">): StudioProject {
  if (!project.versions.length) return project;
  const versionNumber = project.versions.at(-1)!.number;
  const note = `${feedback.from}: ${feedback.note}`;
  return { ...project, versions: project.versions.map((version) => version.number === versionNumber ? { ...version, feedback: [...(version.feedback ?? []), note] } : version), feedback: [...project.feedback, { ...feedback, version: versionNumber }] };
}
export function recordNextGoal(project: StudioProject, nextGoal: string): StudioProject { return { ...project, nextGoal, stage: "retest" }; }
export function updateVersionNotes(project: StudioProject, notes: string): StudioProject {
  if (!project.versions.length) return project;
  return { ...project, versions: project.versions.map((version, index) => index === project.versions.length - 1 ? { ...version, notes } : version) };
}
export function studioSummary(project: StudioProject) { const practiced = [project.user && "named a user", project.problem && "described a problem", project.features.some((f) => f.inV1) && "chose a focused first version", project.versions.some((v) => v.tested) && "tested a build", project.feedback.length && "recorded feedback", project.observations.some((o) => o.kind === "nearby") && "checked nearby behavior"].filter(Boolean) as string[]; const practiceNext = [!project.feedback.some((f) => f.from !== "Me") && "Invite a potential user to try the next version", !project.observations.some((o) => o.kind === "nearby") && "Check a nearby task after making a change"].slice(0, 2); return { user: project.user || "Not recorded", problem: project.problem || "Not recorded", firstVersion: project.versions[0]?.result.description ?? "No build yet", feedback: project.feedback.map((f) => `${f.from}: ${f.note}`), observations: project.observations.map((o) => `${o.kind === "nearby" ? "Nearby check" : "Main task"} (Version ${o.version}) — you did: ${o.action}; expected: ${o.expected}; observed: ${o.happened}`), iterations: Math.max(0, project.versions.length - 1), tests: project.observations.length, testedVersions: project.versions.filter((v) => v.tested).length, state: project.versions.length ? `${project.versions.length} version${project.versions.length === 1 ? "" : "s"}; ${project.versions.filter((v) => v.tested).length} tested` : "Not built yet", shareDecision: project.shareDecision === "ready" ? "Chose to share" : project.shareDecision === "keep_working" ? "Chose to keep working" : "Decision not recorded", practiced, practiceNext }; }
