"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { buildBrief, createProject, currentProject, demoBuilder, goalCoaching, inspectInstruction, problemCoaching, recordBuild, recordFeedback, recordObservation, studioSummary, updateVersionNotes, type StudioProject, type StudioStage } from "@/lib/studio";
import { createStudioProject, deleteStudioProject, getServerStudioState, getStudioState, openStudioProject, setStudioStage, showStudioHub, subscribeStudio, updateStudioProject } from "@/lib/studio-store";

const labels: Record<StudioStage, string> = { idea: "Your idea", scope: "Version 1", brief: "Builder Brief", try: "Try it", feedback: "Feedback", goal: "Next goal", retest: "Retest", summary: "Project summary" };
const stages: StudioStage[] = ["idea", "scope", "brief", "try", "feedback", "goal", "retest", "summary"];
function field(id: string, label: string, value: string, update: (value: string) => void, placeholder: string, multiline = false) {
  return <label className="studio-field" htmlFor={id}><span>{label}</span>{multiline ? <textarea id={id} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} rows={3} /> : <input id={id} value={value} onChange={(event) => update(event.target.value)} placeholder={placeholder} />}</label>;
}
function ProjectList({ projects }: { projects: StudioProject[] }) {
  return <section className="studio-project-list"><div className="studio-section-title"><div><span className="eyebrow">YOUR STUDIO</span><h2>Projects</h2></div><button className="button button-primary" onClick={() => openStudioProject(null)}>Start a project <span aria-hidden="true">→</span></button></div>
    {projects.length ? <div className="studio-projects">{projects.map((project) => <article className="studio-project-row" key={project.id}><div><span className="eyebrow">{project.versions.length ? `${project.versions.length} VERSION${project.versions.length === 1 ? "" : "S"}` : "NEW IDEA"}</span><h3>{project.name}</h3><p>{project.problem || "Your project is ready to take shape."}</p></div><button className="button button-quiet" onClick={() => openStudioProject(project.id)}>{project.stage === "summary" ? "Open summary" : "Resume project"} →</button></article>)}</div> : <p className="studio-empty">Your own projects will show up here.</p>}
  </section>;
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
  const patch = (changes: Partial<StudioProject>) => { if (project) updateStudioProject(project.id, (value) => ({ ...value, ...changes })); };
  const advance = (stage: StudioStage) => { if (project) setStudioStage(project.id, stage); };
  const build = async (instruction: string, afterBuild: StudioStage = "try") => {
    if (!project || building) return;
    setBuilding(true);
    try {
      const result = await demoBuilder.build(instruction.trim(), project.versions.length + 1);
      updateStudioProject(project.id, (current) => ({ ...recordBuild(current, result), stage: afterBuild }));
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
      <p className="studio-nudge">These are reminders, not a rigid template. Make the instruction sound like you.</p>{continueButton("Build Version 1", () => { patch({ brief }); void build(project.instruction); }, !project.instruction.trim())}</>;
  } else if (project.stage === "try") {
    const latest = project.versions.at(-1)!;
    content = <>{heading("Try what was built before asking for changes.", "This Builder makes a local demo result. It is a prototype concept, not a deployed app.")}
      <article className="studio-result"><span className="eyebrow">{latest.result.title} · LOCAL DEMO BUILDER</span><h2>{project.name}</h2><p>{latest.result.description}</p><details><summary>Instruction used</summary><p>{latest.instruction}</p></details></article>
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
      <div className="studio-context"><span className="eyebrow">WHAT YOU KNOW SO FAR</span><p>{project.observations.at(-1)?.happened || "You have tried the current version."}</p>{project.feedback.at(-1) && <p>Feedback: “{project.feedback.at(-1)?.note}”</p>}</div>{field("studio-next-goal", "What should change next?", project.nextGoal, (nextGoal) => patch({ nextGoal }), "Describe an outcome you could check.", true)}{advice && <p className="studio-coach" role="status">A thought to help you focus: {advice}</p>}{continueButton("Build Version 2", () => { const instruction = `${project.instruction}\n\nVersion ${project.versions.length + 1} goal: ${project.nextGoal}`; patch({ nextGoal: project.nextGoal }); void build(instruction, "retest"); }, !project.nextGoal.trim())}</>;
  } else if (project.stage === "retest") {
    const latest = project.versions.at(-1)!;
    content = <>{heading("Try it again, then check nearby behavior.", "Repeat the same task to see whether your change helped. Then check that something nearby still works.")}
      <article className="studio-result compact"><span className="eyebrow">VERSION {latest.number} · WHAT CHANGED</span><p>{project.nextGoal}</p><p>{latest.result.description}</p></article>
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
      <div className="studio-history"><span className="eyebrow">PROJECT HISTORY</span>{project.versions.map((version) => <article key={version.number}><strong>Version {version.number}</strong><span>{new Date(version.builtAt).toLocaleString()}</span><p><b>Instruction:</b> {version.instruction}{version.notes && <> · <b>Note:</b> {version.notes}</>}</p><small>{version.tested ? "Tested" : "Not tested yet"}</small></article>)}</div>
      <div className="studio-actions"><button className="button button-quiet" onClick={() => advance("goal")}>Build another version</button><button className="button button-primary" onClick={showStudioHub}>All Studio projects →</button></div></>;
  }
  const editDetails = project.stage === "idea" ? null : <details className="studio-edit-details"><summary>Edit project details</summary><div className="studio-form">{field("edit-user", "Who is this for?", project.user, (user) => patch({ user, brief: null }), "A specific person or group")}{field("edit-problem", "What problem are they facing?", project.problem, (problem) => patch({ problem, brief: null }), "Describe the hard part.", true)}{field("edit-why", "Why does it matter?", project.why, (why) => patch({ why }), "What could get easier?")}</div></details>;
  return frame(<main className="studio-main studio-workspace"><div className="studio-workspace-nav"><button className="text-button" onClick={showStudioHub}>← All projects</button><button className="text-button studio-delete" onClick={() => { if (confirm(`Delete “${project.name}” and its history?`)) deleteStudioProject(project.id); }}>Delete project</button></div>{progress}{content}{editDetails}</main>);
}
