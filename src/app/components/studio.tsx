"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { buildBrief, createProject, currentProject, goalCoaching, inspectInstruction, problemCoaching, recordBuild, recordFeedback, recordObservation, setBuildState, studioSummary, updateVersionNotes, type StudioProject, type StudioStage } from "@/lib/studio";
import { buildPreviewDocument } from "@/lib/builder/preview";
import { validateArtifact } from "@/lib/builder/contract";
import { seedRuntimeData, type GeneratedAppV2 } from "@/lib/builder/v2";
import { applyRuntimeMigration, planRuntimeMigration, validateRuntimeData } from "@/lib/builder/migration";
import { describeSchemaChanges, diffApplicationSchemas } from "@/lib/builder/schema-diff";
import type { StudioMigrationProvenance } from "@/lib/studio";
import { createStudioProject, deleteStudioProject, getServerStudioState, getStudioState, getStudioStorageMessage, openStudioProject, setStudioStage, showStudioHub, subscribeStudio, updateStudioProject } from "@/lib/studio-store";

const labels: Record<StudioStage, string> = { idea: "Your idea", scope: "Version 1", brief: "Builder Brief", try: "Try it", feedback: "Feedback", goal: "Next goal", retest: "Retest", summary: "Project summary" };
const stages: StudioStage[] = ["idea", "scope", "brief", "try", "feedback", "goal", "retest", "summary"];
function field(id: string, label: string, value: string, update: (value: string) => void, placeholder: string, multiline = false) {
  const maxLength = id.includes("name") ? 80 : id === "studio-feature" ? 180 : id.includes("instruction") ? 1200 : multiline ? 1000 : 500;
  return <label className="studio-field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} maxLength={maxLength} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} rows={3} /> : <input id={id} maxLength={maxLength} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} />}</label>;
}
function ProjectList({ projects }: { projects: StudioProject[] }) {
  return <section className="studio-project-list"><div className="studio-section-title"><div><span className="eyebrow">YOUR STUDIO</span><h2>Projects</h2></div><button className="button button-primary" onClick={() => openStudioProject(null)}>Start a project <span aria-hidden="true">→</span></button></div>
    {projects.length ? <div className="studio-projects">{projects.map((project) => <article className="studio-project-row" key={project.id}><div><span className="eyebrow">{project.versions.length ? `${project.versions.length} VERSION${project.versions.length === 1 ? "" : "S"}` : "NEW IDEA"}</span><h3>{project.name}</h3><p>{project.problem || "Your project is ready to take shape."}</p></div><button className="button button-quiet" onClick={() => openStudioProject(project.id)}>{project.stage === "summary" ? "Open summary" : "Resume project"} →</button></article>)}</div> : <p className="studio-empty">Your own projects will show up here.</p>}
  </section>;
}

function ArtifactChanges({ items }: { items: string[] }) {
  const groups = ["Added", "Changed", "Removed"].map((group) => ({ group, items: items.filter((item) => item.startsWith(group)) })).filter((group) => group.items.length);
  const leftovers = items.filter((item) => !["Added", "Changed", "Removed"].some((group) => item.startsWith(group)));
  return <div className="studio-artifact-changes">{groups.map(({ group, items: entries }) => <section key={group}><strong>{group}</strong>{entries.map((item) => <p key={item}>{item}</p>)}</section>)}{leftovers.map((item) => <p key={item}>{item}</p>)}</div>;
}

function SchemaComparison({ before, after }: { before: StudioProject["versions"][number]; after: StudioProject["versions"][number] }) {
  const oldArtifact = before.result.artifact, newArtifact = after.result.artifact;
  const changes = oldArtifact?.format === "buildloop-app-v2" && newArtifact?.format === "buildloop-app-v2" ? diffApplicationSchemas(oldArtifact, newArtifact) : [];
  const groups = [
    ["Data model", changes.filter((change) => change.kind.startsWith("collection-") || change.kind.startsWith("field-") || change.kind === "sample-data-changed")],
    ["App", changes.filter((change) => change.kind === "app-title-changed" || change.kind === "app-summary-changed")],
    ["Views", changes.filter((change) => change.kind.startsWith("view-"))],
    ["Forms", changes.filter((change) => change.kind.startsWith("form-"))],
    ["Actions", changes.filter((change) => change.kind.startsWith("action-"))],
    ["Search and filtering", changes.filter((change) => change.kind === "search-changed" || change.kind === "filter-changed")],
    ["Metrics", changes.filter((change) => change.kind.startsWith("metric-"))],
    ["Navigation", changes.filter((change) => change.kind === "navigation-changed")],
  ] as const;
  return <details className="studio-version-comparison"><summary>Compare Version {before.number} with Version {after.number}</summary>
    {groups.map(([label, items]) => items.length > 0 && <section key={label}><strong>{label}</strong><ul>{describeSchemaChanges([...items]).map((item) => <li key={item}>{item}</li>)}</ul></section>)}
    {!changes.length && <p>These versions use different app formats or have no V2 schema changes to compare.</p>}
  </details>;
}

function MigrationSummary({ migration }: { migration: NonNullable<StudioProject["versions"][number]["migration"]> }) {
  return <section className={`studio-migration-summary ${migration.warnings.length ? "has-warnings" : ""}`} aria-label={`Version ${migration.targetVersion} data migration`}>
    <span className="eyebrow">DATA IN VERSION {migration.targetVersion}</span>
    <p><strong>{migration.migratedRecords} record{migration.migratedRecords === 1 ? "" : "s"} carried forward</strong>{migration.defaultedValues ? ` · ${migration.defaultedValues} field value${migration.defaultedValues === 1 ? "" : "s"} filled or reset` : ""}</p>
    {migration.removedRecords > 0 && <p>{migration.removedRecords} record{migration.removedRecords === 1 ? "" : "s"} remain in Version {migration.sourceVersion} history.</p>}
    {migration.warnings.map((warning) => <p key={warning} role="status">{warning}</p>)}
  </section>;
}

function V2PreviewFrame({ artifact, previousArtifact, projectId, version, onMigration }: { artifact: GeneratedAppV2; previousArtifact?: GeneratedAppV2; projectId: string; version: number; onMigration?: (migration: StudioMigrationProvenance) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const migrationCallback = useRef(onMigration);
  useEffect(() => { migrationCallback.current = onMigration; }, [onMigration]);
  const storageKey = `buildloop-runtime-v2:${encodeURIComponent(projectId)}:${version}`;
  useEffect(() => {
    const readSnapshot = (raw: string | null, expectedArtifact: GeneratedAppV2, expectedVersion: number) => {
      if (!raw) return { data: null as unknown, invalid: false };
      const saved = JSON.parse(raw) as unknown;
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return { data: null, invalid: true };
      const envelope = saved as Record<string, unknown>;
      const data = envelope.format === "buildloop-runtime-snapshot-v1"
        ? envelope.projectId === projectId && envelope.version === expectedVersion && envelope.artifactFormat === "buildloop-app-v2" ? envelope.data : null
        : saved;
      const checked = validateRuntimeData(expectedArtifact, data);
      return checked.ok ? { data: checked.data as unknown, invalid: false } : { data: null, invalid: true };
    };
    const saveSnapshot = (data: unknown) => {
      const serializedData = JSON.stringify(data);
      if (new TextEncoder().encode(serializedData).length > 64_000) throw new Error("size");
      const envelope = JSON.stringify({ format: "buildloop-runtime-snapshot-v1", projectId, version, artifactFormat: "buildloop-app-v2", savedAt: new Date().toISOString(), data });
      const runtimePrefix = `buildloop-runtime-v2:${encodeURIComponent(projectId)}:`;
      let runtimeSize = 0;
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const existingKey = window.localStorage.key(index);
        if (existingKey?.startsWith(runtimePrefix)) runtimeSize += window.localStorage.getItem(existingKey)?.length ?? 0;
      }
      const previousSize = window.localStorage.getItem(storageKey)?.length ?? 0;
      if (runtimeSize - previousSize + envelope.length > 1_600_000) throw new Error("size");
      window.localStorage.setItem(storageKey, envelope);
    };
    const onMessage = (event: MessageEvent) => {
      if (!frame.current?.contentWindow || event.source !== frame.current.contentWindow) return;
      const message = event.data;
      if (!message || message.channel !== "buildloop-v2" || message.projectId !== projectId || message.version !== version) return;
      const send = (type: string, data?: unknown) => frame.current?.contentWindow?.postMessage({ channel: "buildloop-v2", type, projectId, version, data }, "*");
      if (message.type === "load") {
        try {
          const raw = window.localStorage.getItem(storageKey);
          if (raw) {
            const saved = readSnapshot(raw, artifact, version);
            send("state", saved.data);
            if (saved.invalid) send("error", "This version’s saved data could not be checked. Its original save was left untouched and the preview opened with sample data.");
            return;
          }
          if (!previousArtifact || version < 2) { send("state", null); return; }
          const previousVersion = version - 1;
          const previousKey = `buildloop-runtime-v2:${encodeURIComponent(projectId)}:${previousVersion}`;
          const previousRaw = window.localStorage.getItem(previousKey);
          const sourceSnapshot = previousRaw ? readSnapshot(previousRaw, previousArtifact, previousVersion) : { data: seedRuntimeData(previousArtifact), invalid: false };
          const plan = planRuntimeMigration(previousArtifact, artifact, sourceSnapshot.data, previousVersion, version);
          const result = applyRuntimeMigration(previousArtifact, artifact, sourceSnapshot.data, plan);
          const warnings = [...result.warnings];
          if (sourceSnapshot.invalid) warnings.push(`Version ${previousVersion} data could not be checked; its original save is untouched.`);
          let persisted = false;
          try { saveSnapshot(result.data); persisted = true; }
          catch { warnings.push("The new version is open, but this browser could not save its snapshot. Recent changes may not survive a refresh."); }
          const migration: StudioMigrationProvenance = { sourceVersion: previousVersion, targetVersion: version, completedAt: new Date().toISOString(), ...result.counts, status: !result.ok ? "fallback" : warnings.length ? "warning" : previousRaw ? "migrated" : "initialized", changes: plan.changes.slice(0, 40).map(({ kind, collectionId, fieldId, itemId, destructive }) => ({ kind, collectionId, fieldId, itemId, destructive })), warnings: warnings.slice(0, 12) };
          migrationCallback.current?.(migration);
          send("state", result.data);
          if (warnings.length) send("error", warnings.join(" "));
          else if (!persisted) send("error", "The new version’s data could not be saved in this browser.");
        } catch { send("error", "This browser could not read or migrate the previous version. The earlier save remains available."); send("state", null); }
      } else if (message.type === "save") {
        const runtimeData = message.data && typeof message.data === "object" && !Array.isArray(message.data) ? message.data as Record<string, unknown> : null;
        if (!runtimeData) { send("error", "Preview data could not be saved because its shape was invalid."); return; }
        const checked = validateRuntimeData(artifact, runtimeData);
        if (checked.ok) {
          try { saveSnapshot(checked.data); }
          catch { send("error", "Preview data reached this browser’s local save limit. Remove some records before refreshing."); }
        } else send("error", "Preview data did not match this version’s field rules and was not saved.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [artifact, previousArtifact, projectId, storageKey, version]);
  const reset = () => frame.current?.contentWindow?.postMessage({ channel: "buildloop-v2", type: "reset", projectId, version }, "*");
  return <div className="studio-preview"><div className="studio-preview-head"><span className="eyebrow">INTERACTIVE APP PREVIEW · VERSION {version}</span><button className="text-button" type="button" onClick={reset}>Reset preview data</button></div><iframe ref={frame} title={`${artifact.title} interactive preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={buildPreviewDocument(artifact, { projectId, version })} /></div>;
}

function NewProjectForm() {
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [problem, setProblem] = useState("");
  const [why, setWhy] = useState("");
  const coaching = problemCoaching(problem, user);
  return <><div className="studio-form">{field("new-name", "Project name", name, setName, "e.g. Practice planner")}{field("new-user", "Who is this for?", user, setUser, "One kind of person")}{field("new-problem", "What are they trying to do, and what gets in the way?", problem, setProblem, "Describe the hard part.", true)}{field("new-why", "Why does solving this matter?", why, setWhy, "What could get easier?")}</div>{coaching && <p className="studio-coach" role="status">A thought to help you shape it: {coaching}</p>}<div className="studio-actions"><button className="button button-primary" disabled={!name.trim()} onClick={() => createStudioProject(createProject({ name: name.trim(), user: user.trim(), problem: problem.trim(), why: why.trim() }))} type="button">Create project →</button></div></>;
}

export function Studio({ onBack, courseComplete }: { onBack: () => void; courseComplete: boolean }) {
  const state = useSyncExternalStore(subscribeStudio, getStudioState, getServerStudioState);
  const project = currentProject(state);
  const [featureDraft, setFeatureDraft] = useState("");
  const [feedbackFrom, setFeedbackFrom] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [action, setAction] = useState("");
  const [expected, setExpected] = useState("");
  const [happened, setHappened] = useState("");
  const [nearby, setNearby] = useState("");
  const [building, setBuilding] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const patch = (changes: Partial<StudioProject>) => { if (project) updateStudioProject(project.id, (value) => ({ ...value, ...changes })); };
  const advance = (stage: StudioStage) => { if (project) setStudioStage(project.id, stage); };
  const build = async (instruction: string, afterBuild: StudioStage = "try") => {
    if (!project || building) return;
    setBuilding(true);
    updateStudioProject(project.id, (current) => ({ ...setBuildState(current, "building", { attempts: (current.build?.attempts ?? 0) + 1, startedAt: new Date().toISOString() }), stage: current.stage }));
    try {
      const request = { project: { name: project.name, user: project.user, problem: project.problem, why: project.why, behavior: project.behavior, constraints: project.constraints, inScope: project.features.filter((item) => item.inV1).map((item) => item.text), laterIdeas: project.features.filter((item) => !item.inV1).map((item) => item.text) }, mode: project.versions.length ? "iteration" : "initial", version: project.versions.length + 1, instruction: instruction.trim(), previous: project.versions.at(-1)?.result.artifact, observations: project.observations.slice(-8), feedback: project.feedback.slice(-8) };
      const response = await fetch("/api/studio/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const payload = await response.json() as { provider?: "openai" | "deterministic"; artifact?: unknown; attempts?: number; usage?: { inputTokens?: number; outputTokens?: number }; error?: string };
      if (!response.ok) throw new Error(payload.error || "The Builder couldn't finish this version. Your project is safe; try again.");
      updateStudioProject(project.id, (current) => setBuildState(current, "validating"));
      const valid = validateArtifact(payload.artifact);
      if (!valid.ok) throw new Error("The Builder returned a version BuildLoop could not safely run. Your project is safe; try again.");
      const result = { provider: payload.provider ?? "openai" as const, instruction: instruction.trim(), title: valid.artifact.title, description: valid.artifact.summary, artifact: valid.artifact, attempts: payload.attempts ?? 1, usage: payload.usage };
      updateStudioProject(project.id, (current) => ({ ...recordBuild(current, result), stage: afterBuild }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Builder couldn't finish this version. Your project is safe; try again.";
      updateStudioProject(project.id, (current) => ({ ...setBuildState(current, "failed", { message }), stage: current.stage }));
    } finally { setBuilding(false); }
  };
  const back = <button className="text-button" onClick={onBack} type="button">← Back to Missions</button>;
  const frame = (content: ReactNode) => <div className="studio-shell"><header className="studio-topbar"><div className="brand">build<span>loop</span></div><span className="hub-local">Studio · Saved on this device</span>{back}</header>{content}</div>;
  if (state.screen === "hub") return frame(<main className="studio-main"><section className="studio-intro"><span className="eyebrow">BUILDLOOP STUDIO</span><h1>Use the workflow on something you care about.</h1><p>Start with a person and a problem. Build a small first version, try it, learn, and improve it.</p>{!courseComplete && <p className="studio-recommend">You can begin now. Completing the six Missions first is recommended.</p>}</section>
    <section className="studio-transition"><span className="eyebrow">LEARN THE WORKFLOW <span aria-hidden="true">→</span> USE THE WORKFLOW</span><p>{courseComplete ? "You practiced the workflow. Now use it on something you care about." : "A project you care about is a good place to practice."}</p></section><ProjectList projects={state.projects} /></main>);

  if (state.screen === "new") return frame(<main className="studio-main studio-workspace"><button className="text-button" onClick={showStudioHub}>← All Studio projects</button><div className="studio-heading"><span className="eyebrow">A PROJECT OF YOUR OWN</span><h1>What would you like to make easier?</h1><p>Start with a person and the problem they face. You can revise these answers later.</p></div><NewProjectForm /></main>);
  if (!project) return frame(<main className="studio-main"><p>Your project could not be found.</p><button className="button button-primary" onClick={showStudioHub}>Return to Studio</button></main>);

  const index = stages.indexOf(project.stage);
  const progress = project.stage !== "summary" ? <nav className="studio-progress" aria-label="Project steps">{stages.slice(0, 7).map((step, i) => <span key={step} className={i <= index ? "is-current" : ""}>{i + 1}<small>{labels[step]}</small></span>)}</nav> : null;
  const heading = (title: string, description: string) => <div className="studio-heading"><span className="eyebrow">{project.name} · {labels[project.stage].toUpperCase()}</span><h1>{title}</h1><p>{description}</p></div>;
  const continueButton = (label: string, onClick: () => void, disabled = false) => <div className="studio-actions"><button className="button button-primary" onClick={onClick} disabled={disabled} type="button">{label} →</button></div>;
  const preview = (artifact: import("@/lib/builder/contract").GeneratedApp, version: number) => {
    if (artifact.format !== "buildloop-app-v2") return <div className="studio-preview"><div className="studio-preview-head"><span className="eyebrow">INTERACTIVE APP PREVIEW</span><span>Runs in an isolated preview</span></div><iframe title={`${artifact.title} interactive preview`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={buildPreviewDocument(artifact)} /></div>;
    const source = project.versions.find((item) => item.number === version - 1)?.result.artifact;
    const previousArtifact = source?.format === "buildloop-app-v2" ? source : undefined;
    return <V2PreviewFrame artifact={artifact} previousArtifact={previousArtifact} projectId={project.id} version={version} onMigration={(migration) => updateStudioProject(project.id, (current) => ({ ...current, versions: current.versions.map((item) => item.number === version ? { ...item, migration } : item) }))} />;
  };
  let content: React.ReactNode;
  if (project.stage === "idea") {
    const coaching = problemCoaching(project.problem, project.user);
    content = <>{heading("Start with one person and one problem.", "You do not need perfect answers. You can change them as you learn.")}
      <div className="studio-form">{field("studio-name", "Project name", project.name, (name) => patch({ name }), "e.g. Practice planner")}{field("studio-user", "Who is this for?", project.user, (user) => patch({ user }), "A specific person or group")}{field("studio-problem", "What are they trying to do, and what gets in the way?", project.problem, (problem) => patch({ problem }), "Describe the hard part, not just an app feature.", true)}{field("studio-why", "Why does solving this matter to them?", project.why, (why) => patch({ why }), "What would get easier?")}</div>
      {coaching && <p className="studio-coach" role="status">A thought to help you shape it: {coaching}</p>}{continueButton("Choose a small first version", () => advance("scope"), !project.name.trim())}</>;
  } else if (project.stage === "scope") {
    content = <>{heading("What is the smallest useful version?", "Keep what helps solve the main problem. Save other good ideas for later.")}
      <div className="studio-feature-add">{field("studio-feature", "Feature idea", featureDraft, setFeatureDraft, "One thing the person could do") }<button className="button button-quiet" onClick={() => { if (featureDraft.trim()) { patch({ features: [...project.features, { id: crypto.randomUUID(), text: featureDraft.trim(), inV1: true }] }); setFeatureDraft(""); } }} type="button">Add idea</button></div>
      <div className="studio-feature-columns"><section><h2>Version 1</h2>{project.features.filter((f) => f.inV1).map((item) => <div className="studio-feature" key={item.id}><span>{item.text}</span><button className="text-button" onClick={() => patch({ features: project.features.map((f) => f.id === item.id ? { ...f, inV1: false } : f) })}>Move to Later Ideas</button></div>)}{!project.features.some((f) => f.inV1) && <p className="studio-empty">Add the core thing this person needs.</p>}</section><section className="studio-later"><h2>Later Ideas</h2>{project.features.filter((f) => !f.inV1).map((item) => <div className="studio-feature" key={item.id}><span>{item.text}</span><button className="text-button" onClick={() => patch({ features: project.features.map((f) => f.id === item.id ? { ...f, inV1: true } : f) })}>Bring into Version 1</button></div>)}{!project.features.some((f) => !f.inV1) && <p className="studio-empty">Ideas moved out of Version 1 stay here.</p>}</section></div>
      <p className="studio-nudge">If the first version needs many features, see if one can wait until you learn more.</p>{continueButton("Write the Builder Brief", () => { patch({ brief: buildBrief(project) }); advance("brief"); }, !project.features.some((f) => f.inV1))}</>;
  } else if (project.stage === "brief") {
    const brief = buildBrief(project), checks = inspectInstruction(brief, project.instruction);
    content = <>{heading("Tell the Builder what you want.", "Write the instruction yourself. Use what you learned about the person and Version 1, then check what may be missing.")}
      <div className="studio-context"><span className="eyebrow">WHAT YOU’VE LEARNED</span><p><strong>{project.user}</strong> needs help because {project.problem}</p><p>Version 1: {brief.scope.join(" · ")}</p></div>
      {field("studio-behavior", "What should the person be able to do?", project.behavior, (behavior) => patch({ behavior }), "Describe what should happen, step by step.", true)}{field("studio-constraints", "What should the Builder keep in mind?", project.constraints, (constraints) => patch({ constraints }), "Important limits, style, or things to avoid.", true)}{field("studio-instruction", "Your Builder instruction", project.instruction, (instruction) => patch({ instruction }), "Use your own words. Explain what to build and what it should do.", true)}
      <div className="studio-checks"><strong>Look at your instruction. Can a Builder tell…</strong>{Object.entries({ user: "Who it is for", problem: "The problem", behavior: "What should happen", constraints: "Important constraints", scope: "Version 1 features" }).map(([key, text]) => <span key={key} className={checks[key as keyof typeof checks] ? "is-ready" : ""}>{checks[key as keyof typeof checks] ? "✓" : "·"} {text}</span>)}</div>
      <p className="studio-nudge">These are reminders, not a rigid template. Make the instruction sound like you.</p>{continueButton(building ? "Building Version 1…" : "Build Version 1", () => { patch({ brief }); void build(project.instruction); }, !project.instruction.trim() || building)}</>;
  } else if (project.stage === "try") {
    const latest = project.versions.at(-1)!;
    content = <>{heading("Try the app before asking for changes.", "Use it for a real task. Notice what worked, what felt confusing, and what surprised you.")}
      <article className="studio-result"><span className="eyebrow">VERSION {latest.number} · {latest.result.provider === "deterministic" ? "DETERMINISTIC TEST BUILDER" : latest.result.provider === "openai" ? "AI BUILDER" : "LEGACY DEMO"}</span><h2>{latest.result.title}</h2><p>{latest.result.description}</p>{project.versions.length > 1 && latest.result.artifact?.format === "buildloop-app-v2" && project.versions.at(-2)?.result.artifact?.format === "buildloop-app-v2" ? <ArtifactChanges items={describeSchemaChanges(diffApplicationSchemas(project.versions.at(-2)!.result.artifact as GeneratedAppV2, latest.result.artifact))} /> : latest.result.artifact && <ArtifactChanges items={latest.result.artifact.changeSummary} />}{latest.migration && <MigrationSummary migration={latest.migration} />}<details><summary>Builder Brief used</summary><p>{latest.instruction}</p></details></article>
      {latest.result.artifact ? preview(latest.result.artifact, latest.number) : <p className="studio-coach">This saved version was created before interactive previews were available.</p>}
      {latest.result.artifact && <section className="studio-test-hint"><strong>Try a task</strong><ul>{latest.result.artifact.testTasks.map((task) => <li key={task}><button className="text-button" type="button" onClick={() => setAction(task)}>{task}</button></li>)}</ul><p>Choose a suggestion or write your own task in your observation.</p></section>}
      {field("studio-version-notes", "A note for this version", latest.notes, (notes) => updateStudioProject(project.id, (current) => updateVersionNotes(current, notes)), "What do you want to remember about this build?")}
      <div className="studio-context"><span className="eyebrow">TRY CHECKLIST</span><p>Can someone {project.behavior || "complete the main task"}?</p><p>Does the result match your instruction? Did anything unexpected happen?</p></div>
      <section className="studio-test"><span className="eyebrow">TRY IT · VERSION {latest.number}</span><h2>What happened when you tried it?</h2>{field("studio-action", "What did you do?", action, setAction, "The steps you tried")}{field("studio-expected", "What did you expect?", expected, setExpected, "What should have happened?")}{field("studio-happened", "What happened instead?", happened, setHappened, "What did you see?")}</section>
      <p className="studio-test-hint">Start with the main task: can the person complete it? Did anything unexpected happen?</p>{continueButton("Record test and gather feedback", () => { updateStudioProject(project.id, (current) => ({ ...recordObservation(current, { action, expected, happened, kind: "core" }), stage: "feedback" })); }, !action.trim())}</>;
  } else if (project.stage === "feedback") {
    content = <>{heading("What did you learn from trying it?", "Record your own observation or ask another person who might use this. A suggestion does not have to become a feature.")}
      <div className="studio-feedback-summary"><span className="eyebrow">YOUR TEST</span><p><strong>You did:</strong> {project.observations.at(-1)?.action}</p><p><strong>You expected:</strong> {project.observations.at(-1)?.expected}</p><p><strong>You saw:</strong> {project.observations.at(-1)?.happened}</p></div>
      <div className="studio-form">{field("studio-feedback-from", "Who shared feedback?", feedbackFrom, setFeedbackFrom, "Me, or the person who tried it")}{field("studio-feedback-note", "What did they notice or say?", feedbackNote, setFeedbackNote, "Capture what they actually experienced.", true)}</div>{continueButton("Choose what to work on next", () => { if (feedbackNote.trim()) updateStudioProject(project.id, (current) => recordFeedback(current, { from: feedbackFrom.trim() || "Me", note: feedbackNote.trim() })); advance("goal"); })}</>;
  } else if (project.stage === "goal") {
    const advice = goalCoaching(project.nextGoal);
    content = <>{heading("Choose one outcome for the next version.", "Use what you observed. Describe what the person should be able to do; you can add implementation details too.")}
      <div className="studio-context"><span className="eyebrow">WHAT YOU KNOW SO FAR</span><p>{project.observations.at(-1)?.happened || "You have tried the current version."}</p>{project.feedback.at(-1) && <p>Feedback: “{project.feedback.at(-1)?.note}”</p>}</div>{field("studio-next-goal", "What should change next?", project.nextGoal, (nextGoal) => patch({ nextGoal }), "Describe an outcome you could check.", true)}{advice && <p className="studio-coach" role="status">A thought to help you focus: {advice}</p>}{continueButton(building ? `Building Version ${project.versions.length + 1}…` : `Build Version ${project.versions.length + 1}`, () => { const instruction = `${project.instruction}\n\nVersion ${project.versions.length + 1} goal: ${project.nextGoal}`; patch({ nextGoal: project.nextGoal }); void build(instruction, "retest"); }, !project.nextGoal.trim() || building)}</>;
  } else if (project.stage === "retest") {
    const latest = project.versions.at(-1)!;
    const previousTest = latest.retestedVersion ? project.observations.find((item) => item.version === latest.retestedVersion && item.kind === "core") : undefined;
    content = <>{heading("Try it again, then check nearby behavior.", "Repeat the earlier task to see whether your change helped. Then check that something nearby still works.")}
      {previousTest && <section className="studio-context"><span className="eyebrow">REPEAT YOUR VERSION {previousTest.version} TASK</span><p>You tried: {previousTest.action}</p><p>You expected: {previousTest.expected}</p><p>Then: {previousTest.happened}</p></section>}
      <article className="studio-result compact"><span className="eyebrow">VERSION {latest.number} · BUILDER CHANGE SUMMARY</span><p>{project.nextGoal}</p>{latest.result.artifact ? <ArtifactChanges items={latest.result.artifact.changeSummary} /> : <p>{latest.result.description}</p>}</article>
      {latest.migration && <MigrationSummary migration={latest.migration} />}
      {project.versions.length > 1 && <SchemaComparison before={project.versions.at(-2)!} after={latest} />}
      {latest.result.artifact && preview(latest.result.artifact, latest.number)}
      {field("studio-version-notes", "A note for this version", latest.notes, (notes) => updateStudioProject(project.id, (current) => updateVersionNotes(current, notes)), "What do you want to remember about this update?")}
      <section className="studio-test">{field("studio-retest-action", "Repeat: what did you do?", action, setAction, "Repeat the same steps as before")}{field("studio-retest-expected", "What did you expect this time?", expected, setExpected, "What should the change do?")}{field("studio-retest-happened", "What happened?", happened, setHappened, "What did you observe?")}{field("studio-nearby", "Check one nearby behavior", nearby, setNearby, "What else did you try, and did it still work?", true)}</section>
      {continueButton("See your project summary", () => { updateStudioProject(project.id, (current) => ({ ...recordObservation(recordObservation(current, { action, expected, happened, kind: "core" }), { action: "Nearby check", expected: "Working behavior stays intact", happened: nearby, kind: "nearby" }), stage: "summary" })); }, !action.trim() || !nearby.trim())}</>;
  } else {
    const summary = studioSummary(project);
    content = <>{heading("Look how far your idea came.", "Here is the story of the project, built from the choices and checks you recorded.")}
      <div className="studio-summary-grid"><article><span className="eyebrow">USER</span><p>{summary.user}</p></article><article><span className="eyebrow">ORIGINAL PROBLEM</span><p>{summary.problem}</p></article><article><span className="eyebrow">FIRST VERSION</span><p>{project.features.filter((f) => f.inV1).map((f) => f.text).join(" · ") || "Not recorded"}</p></article><article><span className="eyebrow">FEEDBACK</span><p>{summary.feedback.join(" · ") || "No feedback recorded"}</p></article><article><span className="eyebrow">WHAT YOU TESTED</span><p>{summary.observations.join(" · ") || "No observations recorded"}</p></article><article><span className="eyebrow">NEXT GOAL</span><p>{project.nextGoal || "Not recorded"}</p></article><article><span className="eyebrow">ITERATIONS AND TESTS</span><p>{summary.iterations} update{summary.iterations === 1 ? "" : "s"} · {summary.tests} observations · {summary.testedVersions} version{summary.testedVersions === 1 ? "" : "s"} tested</p></article><article><span className="eyebrow">CURRENT STATE</span><p>{summary.state} · {summary.shareDecision}</p></article></div>
      <section className="studio-evidence"><span className="eyebrow">WHAT YOU DID WELL</span><p>{summary.practiced.length ? summary.practiced.join(" · ") : "Each project is a chance to practice."}</p></section>
      {summary.practiceNext.length > 0 && <section className="studio-evidence"><span className="eyebrow">A COUPLE OF THINGS TO PRACTICE NEXT</span><p>{summary.practiceNext.join(" · ")}</p></section>}
      <section className="studio-share"><h2>Is this ready to share?</h2><p>Make a deliberate choice based on what you tested.</p><div><button className={`button ${project.shareDecision === "ready" ? "button-primary" : "button-quiet"}`} onClick={() => patch({ shareDecision: "ready" })}>Ready to share</button><button className={`button ${project.shareDecision === "keep_working" ? "button-primary" : "button-quiet"}`} onClick={() => patch({ shareDecision: "keep_working" })}>Keep working</button></div></section>
      <div className="studio-history"><span className="eyebrow">PROJECT HISTORY</span>{project.versions.map((version, index) => <article key={version.number}><strong>Version {version.number}</strong><span>{new Date(version.builtAt).toLocaleString()}</span><p><b>Instruction:</b> {version.instruction}{version.notes && <> · <b>Note:</b> {version.notes}</>}</p><small>{version.tested ? "Tested" : "Not tested yet"}</small>{version.migration && <MigrationSummary migration={version.migration} />}{index > 0 && <SchemaComparison before={project.versions[index - 1]} after={version} />}{version.result.artifact && <button className="text-button" onClick={() => setViewingVersion(version.number)} type="button">Preview Version {version.number}</button>}</article>)}</div>
      {viewingVersion !== null && (() => { const version = project.versions.find((item) => item.number === viewingVersion); return version?.result.artifact ? <section><h2>Version {version.number} preview</h2>{preview(version.result.artifact, version.number)}<button className="text-button" onClick={() => setViewingVersion(null)} type="button">Close older preview</button></section> : null; })()}
      <div className="studio-actions"><button className="button button-quiet" onClick={() => advance("goal")}>Build another version</button><button className="button button-primary" onClick={showStudioHub}>All Studio projects →</button></div></>;
  }
  const editDetails = project.stage === "idea" ? null : <details className="studio-edit-details"><summary>Edit project details</summary><div className="studio-form">{field("edit-user", "Who is this for?", project.user, (user) => patch({ user, brief: null }), "A specific person or group")}{field("edit-problem", "What problem are they facing?", project.problem, (problem) => patch({ problem, brief: null }), "Describe the hard part.", true)}{field("edit-why", "Why does it matter?", project.why, (why) => patch({ why }), "What could get easier?")}</div></details>;
  const buildNotice = project.build?.status === "failed" ? <section className="studio-build-error" role="alert"><strong>{project.build.message || "The Builder couldn't finish this version. Your project is safe; try again."}</strong><button className="button button-quiet" disabled={building} onClick={() => { const instruction = project.versions.length ? `${project.instruction}\n\nNext goal: ${project.nextGoal}` : project.instruction; void build(instruction, project.versions.length ? "retest" : "try"); }}>Retry build</button></section> : null;
  const buildingNotice = building || project.build?.status === "building" || project.build?.status === "validating" ? <p className="studio-building" role="status" aria-live="polite">{project.build?.status === "validating" ? "Checking that this version is safe to run…" : "The Builder is making your version…"}</p> : null;
  const storageNotice = getStudioStorageMessage() ? <p className="studio-build-error" role="status">{getStudioStorageMessage()}</p> : null;
  return frame(<main className="studio-main studio-workspace"><div className="studio-workspace-nav"><button className="text-button" onClick={showStudioHub}>← All projects</button><button className="text-button studio-delete" onClick={() => { if (confirm(`Delete “${project.name}” and its history?`)) deleteStudioProject(project.id); }}>Delete project</button></div>{progress}{storageNotice}{buildingNotice}{buildNotice}{content}{editDetails}</main>);
}
