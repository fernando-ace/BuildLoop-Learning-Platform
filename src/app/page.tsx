"use client";

import { useSyncExternalStore, useState, type Dispatch, type ReactNode } from "react";
import {
  costOf,
  evaluateBrief,
  featureCatalog,
  getBuildIssues,
  iterationOptions,
  makeBuilderSummary,
  problemOptions,
  questionCatalog,
  skillScores,
  type MissionState,
  type TestId,
  mission1Definition,
  testLabelText,
} from "@/lib/mission";
import { dispatchMission, getActiveMission, getLearnerProgress, getMission2Progress, getMission2State, getMission3Progress, getMission3State, getMission4Progress, getMission4State, getMissionState, getServerLearnerProgress, getServerMission2Progress, getServerMission2State, getServerMission3Progress, getServerMission3State, getServerMission4Progress, getServerMission4State, getServerMissionState, startMission2, startMission3, startMission4, subscribeMission } from "@/lib/store";
import { learnerSkills, skillLabel, type LearnerProgress } from "@/lib/learner";
import type { MissionAction } from "@/lib/reducer";
import { ChoiceList } from "@/app/components/choice-list";
import { MissionTwoPlayer } from "@/app/components/mission-two-player";
import { mission2Definition, type Mission2Progress, type Mission2State } from "@/lib/missions/the-vague-request";
import { mission3Definition, type Mission3Progress, type Mission3State } from "@/lib/missions/one-prompt-wont-do-it";
import { MissionThreePlayer } from "@/app/components/mission-three-player";
import { mission4Definition, type Mission4Progress, type Mission4State } from "@/lib/missions/what-next";
import { MissionFourPlayer } from "@/app/components/mission-four-player";

const subscribeToHydration = () => () => {};
const clientReadySnapshot = () => true;
const serverReadySnapshot = () => false;
const progressStages = mission1Definition.steps.map((step) => step.label);
const buildIssueLabels: Readonly<Record<string, string>> = mission1Definition.consequences.buildIssues;
function RestoreMission({ state, onReset }: { state: MissionState; onReset: () => void }) {
  if (state.stage === 0) return null;
  return (
    <button className="text-button" onClick={onReset} type="button" aria-label="Start over">
      Start over
    </button>
  );
}

function MissionHub({ state, progress, mission2State, mission2Progress, mission3State, mission3Progress, mission4State, mission4Progress, onStart, onStart2, onStart3, onStart4 }: { state: MissionState; progress: LearnerProgress; mission2State: Mission2State; mission2Progress: Mission2Progress; mission3State: Mission3State; mission3Progress: Mission3Progress; mission4State: Mission4State; mission4Progress: Mission4Progress; onStart: () => void; onStart2: () => void; onStart3: () => void; onStart4: () => void }) {
  const isInProgress = state.stage > 0 && !state.shipped;
  const mission2InProgress = mission2State.stage > 0 && mission2State.stage < 10;
  const mission2Unlocked = progress.completed;
  const mission3InProgress = mission3State.stage > 0 && mission3State.stage < 8;
  const mission3Unlocked = mission2Progress.completed;
  const mission4InProgress = mission4State.stage > 0 && mission4State.stage < 8;
  const mission4Unlocked = mission3Progress.completed;
  const completedCount = Number(progress.completed) + Number(mission2Progress.completed) + Number(mission3Progress.completed) + Number(mission4Progress.completed);
  const status = isInProgress ? "In progress" : progress.completed ? "Completed" : "Not started";
  const latestResults = mission4Progress.completed ? mission4Progress.latestSkillResults : mission3Progress.completed ? mission3Progress.latestSkillResults : mission2Progress.completed ? mission2Progress.latestSkillResults : progress.latestSkillResults;
  const latest = new Map(latestResults.map((skill) => [skill.name, skill]));
  return <div className="hub-shell">
    <header className="hub-topbar"><div className="brand">build<span>loop</span><i /></div><span className="hub-local">Your progress is saved on this device</span></header>
    <main className="hub-main">
      <section className="hub-intro"><p className="eyebrow">YOUR MISSION HUB</p><h1>Learn to build real things with AI.</h1><p>Make decisions, see what happens, and practice taking an idea all the way to a working product.</p></section>
      <section className="learner-progress" aria-label="Learner progress"><div><span className="eyebrow">YOUR PROGRESS</span><strong>{completedCount ? `${completedCount} of 4 missions complete` : isInProgress ? "Mission 1 in progress" : "Your learning journey starts here"}</strong></div><span>{progress.attempts + mission2Progress.attempts.length + mission3Progress.attempts.length + mission4Progress.attempts.length} {progress.attempts + mission2Progress.attempts.length + mission3Progress.attempts.length + mission4Progress.attempts.length === 1 ? "attempt" : "attempts"}</span><div className="hub-progress-track" aria-label={`${Math.round(completedCount / 4 * 100)}% mission progress`}><span style={{ width: `${completedCount / 4 * 100}%` }} /></div></section>
      <section className="mission-cards" aria-label="Missions">
        <article className="hub-mission-card">
          <div className="hub-card-top"><span className="mission-number">MISSION {mission1Definition.metadata.number}</span><span className={`mission-status ${isInProgress ? "is-progress" : progress.completed ? "is-completed" : ""}`}>{status}</span></div>
          <h2>{mission1Definition.metadata.title}</h2><p className="mission-description">{mission1Definition.metadata.description}</p>
          <div className="hub-skills"><span className="eyebrow">YOU’LL PRACTICE</span><div><span>Understand the user</span><span>Find the real problem</span><span>Choose what to build first</span><span>Test and improve</span></div></div>
          <div className="hub-card-footer"><span>{progress.completed ? `Completed · ${progress.attempts} ${progress.attempts === 1 ? "attempt" : "attempts"}` : `About ${mission1Definition.metadata.estimatedMinutes} minutes · No coding needed`}</span><button className="button button-primary" onClick={onStart} type="button">{isInProgress ? "Continue Mission" : progress.completed ? "Replay Mission" : "Start Mission"}<span aria-hidden="true">→</span></button></div>
        </article>
        <article className={`hub-mission-card hub-mission-two${mission2Unlocked ? "" : " is-locked"}`} aria-label={mission2Unlocked ? "Mission 2" : "Mission 2 locked"}>
          <div className="hub-card-top"><span className="mission-number">MISSION {mission2Definition.metadata.number}</span><span className={`mission-status ${mission2InProgress ? "is-progress" : mission2Progress.completed ? "is-completed" : ""}`}>{mission2Unlocked ? mission2InProgress ? "In progress" : mission2Progress.completed ? "Completed" : "Not started" : "Locked"}</span></div>
          <h2>{mission2Unlocked ? mission2Definition.metadata.title : "Locked for now"}</h2><p className="mission-description">{mission2Unlocked ? mission2Definition.metadata.description : "Complete Mission 1 to continue your journey."}</p>
          {mission2Unlocked && <div className="hub-skills"><span className="eyebrow">YOU’LL PRACTICE</span><div>{mission2Definition.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div>}
          <div className="hub-card-footer"><span>{mission2Unlocked ? `About ${mission2Definition.metadata.estimatedMinutes} minutes · No coding needed` : "Available after Mission 1"}</span>{mission2Unlocked && <button className="button button-primary" onClick={onStart2} type="button">{mission2InProgress ? "Continue Mission" : mission2Progress.completed ? "Replay Mission" : "Start Mission"}<span aria-hidden="true">→</span></button>}</div>
        </article>
        <article className={`hub-mission-card hub-mission-two${mission3Unlocked ? "" : " is-locked"}`} aria-label={mission3Unlocked ? "Mission 3" : "Mission 3 locked"}>
          <div className="hub-card-top"><span className="mission-number">MISSION {mission3Definition.metadata.number}</span><span className={`mission-status ${mission3InProgress ? "is-progress" : mission3Progress.completed ? "is-completed" : ""}`}>{mission3Unlocked ? mission3InProgress ? "In progress" : mission3Progress.completed ? "Completed" : "Not started" : "Locked"}</span></div>
          <h2>{mission3Unlocked ? mission3Definition.metadata.title : "Locked for now"}</h2><p className="mission-description">{mission3Unlocked ? mission3Definition.metadata.description : "Complete Mission 2 to continue your journey."}</p>
          {mission3Unlocked && <div className="hub-skills"><span className="eyebrow">YOU’LL PRACTICE</span><div>{mission3Definition.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div>}
          <div className="hub-card-footer"><span>{mission3Unlocked ? `About ${mission3Definition.metadata.estimatedMinutes} minutes · No coding needed` : "Available after Mission 2"}</span>{mission3Unlocked && <button className="button button-primary" onClick={onStart3} type="button">{mission3InProgress ? "Continue Mission" : mission3Progress.completed ? "Replay Mission" : "Start Mission"}<span aria-hidden="true">→</span></button>}</div>
        </article>
        <article className={`hub-mission-card hub-mission-two${mission4Unlocked ? "" : " is-locked"}`} aria-label={mission4Unlocked ? "Mission 4" : "Mission 4 locked"}>
          <div className="hub-card-top"><span className="mission-number">MISSION {mission4Definition.metadata.number}</span><span className={`mission-status ${mission4InProgress ? "is-progress" : mission4Progress.completed ? "is-completed" : ""}`}>{mission4Unlocked ? mission4InProgress ? "In progress" : mission4Progress.completed ? "Completed" : "Not started" : "Locked"}</span></div>
          <h2>{mission4Unlocked ? mission4Definition.metadata.title : "Locked for now"}</h2><p className="mission-description">{mission4Unlocked ? mission4Definition.metadata.description : "Complete Mission 3 to continue your journey."}</p>
          {mission4Unlocked && <div className="hub-skills"><span className="eyebrow">YOU’LL PRACTICE</span><div>{["Choose what matters", "Give a clear goal", "Try the real result", "Share when it works"].map((skill) => <span key={skill}>{skill}</span>)}</div></div>}
          <div className="hub-card-footer"><span>{mission4Unlocked ? `About ${mission4Definition.metadata.estimatedMinutes} minutes · No coding needed` : "Available after Mission 3"}</span>{mission4Unlocked && <button className="button button-primary" onClick={onStart4} type="button">{mission4InProgress ? "Continue Mission" : mission4Progress.completed ? "Replay Mission" : "Start Mission"}<span aria-hidden="true">→</span></button>}</div>
        </article>
      </section>
      <section className="skill-progress"><div className="skill-heading"><div><span className="eyebrow">SKILLS YOU’RE BUILDING</span><h2>Small steps add up.</h2></div>{progress.completed && <span className="skill-note">Based on your latest attempt</span>}</div><div className="skill-list">{learnerSkills.map((name) => {
        const score = latest.get(name)?.score;
        return <div className="hub-skill" key={name}><div><strong>{name}</strong><span>{score === undefined ? "Not practiced yet" : skillLabel(score)}</span></div><div className="skill-track"><span style={{ width: `${score ?? 0}%` }} /></div></div>;
      })}</div>{progress.completed && progress.latestSkillResults.length > 0 && <p className="skill-disclaimer">These are gameplay signals based on your choices, not a formal assessment.</p>}</section>
    </main>
  </div>;
}

function ProgressHeader({ state, onReset }: { state: MissionState; onReset: () => void }) {
  const progressIndex = Math.max(0, Math.min(8, state.stage === 9 ? 8 : state.stage - 1));
  return (
    <header className="topbar">
      <div className="brand">build<span>loop</span><i /></div>
      <div className="mission-name">Mission 1 <span>·</span> The Missing Cameras</div>
      <div className="top-actions"><span className="save-label"><span className="save-dot" /> Saved</span><RestoreMission state={state} onReset={onReset} /></div>
      <nav className="progress" aria-label="Mission progress">
        {progressStages.map((label, index) => {
          const complete = index < progressIndex || state.shipped;
          const active = index === progressIndex && !state.shipped;
          return <div className={`progress-step${active ? " is-active" : ""}${complete ? " is-complete" : ""}`} key={label} aria-current={active ? "step" : undefined}>
            <span className="progress-node">{complete ? "✓" : String(index + 1).padStart(2, "0")}</span><span className="progress-label">{label}</span>
          </div>;
        })}
      </nav>
    </header>
  );
}

function GuidePanel({ state }: { state: MissionState }) {
  const collected = state.questionsAsked.map((id) => questionCatalog.find((q) => q.id === id)?.insight).filter(Boolean);
  const problem = problemOptions.find((p) => p.id === state.problemChoice);
  return <aside className="guide-panel">
    <div className="guide-heading"><span className="guide-icon" aria-hidden="true">≡</span><h2>Field notes</h2></div>
    <div className="guide-callout"><span className="callout-line" /><p>{state.stage <= 1 ? <>Start with the <strong>problem</strong>, not the features.</> : state.stage === 2 ? <>A clear problem points toward a <strong>useful first step.</strong></> : state.stage === 3 ? <>Make the smallest version that proves the <strong>useful behavior.</strong></> : state.stage === 4 ? <>Clear instructions help the AI build the <strong>right thing.</strong></> : state.stage === 6 ? <>“Done” is a claim. <strong>Testing is evidence.</strong></> : state.stage === 7 ? <>Feedback is evidence, <strong>not a to-do list.</strong></> : <>Keep what works. Change what the <strong>evidence shows.</strong></>}</p></div>
    <div className="notes-list"><span className="eyebrow">WHAT WE KNOW</span>
      {collected.length ? collected.map((note, index) => <p className="note-item" key={`${note}-${index}`}><span className="note-marker">{String(index + 1).padStart(2, "0")}</span>{note}</p>) : <p className="notes-empty">Ask Ari a few questions. Your useful clues will collect here.</p>}
      {problem && <p className="note-item"><span className="note-marker">↳</span>{problem.text}</p>}
    </div>
    {state.stage > 0 && state.stage < 9 && <div className="guide-footer"><span className="footer-label">YOUR ROLE</span><span>You decide what gets built.</span></div>}
  </aside>;
}

function PageFrame({ state, dispatch, children }: { state: MissionState; dispatch: Dispatch<MissionAction>; children: ReactNode }) {
  const [showReset, setShowReset] = useState(false);
  return <div className="app-shell">
    <ProgressHeader state={state} onReset={() => setShowReset(true)} />
    <main className="mission-grid">
      <section className="main-panel" key={state.stage}>{children}</section>
      <GuidePanel state={state} />
    </main>
    {showReset && <div className="modal-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-heading"><p className="eyebrow">RESTART MISSION</p><h2 id="reset-heading">Start fresh?</h2><p>Your saved choices and progress will be cleared.</p><div className="dialog-actions"><button className="button button-quiet" onClick={() => setShowReset(false)} type="button">Keep playing</button><button className="button button-primary" onClick={() => { setShowReset(false); dispatch({ type: "RESET" }); }} type="button">Start over</button></div></section></div>}
  </div>;
}

function StageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="stage-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>;
}

function StageContinue({ children, disabled = false, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return <div className="continue-row"><span className="continue-hint">{disabled ? "Make a choice to continue" : "Your choices are saved as you go"}</span><button className="button button-primary" onClick={onClick} disabled={disabled} type="button">{children}<span aria-hidden="true">→</span></button></div>;
}

function Discovery({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const [selected, setSelected] = useState("");
  const asked = state.questionsAsked.length;
  const character = mission1Definition.characters[0];
  const lastQuestion = questionCatalog.find((question) => question.id === state.questionsAsked.at(-1));
  const ask = () => {
    if (!selected || asked >= 3) return;
    const question = questionCatalog.find((item) => item.id === selected);
    if (!question) return;
    dispatch({ type: "ASK", question: question.id });
    setSelected("");
  };
  return <>
    <StageHeading eyebrow="STEP 01 · MEET THE USER" title={`Meet ${character.name}.`} description={`${character.name} runs the photography club. Ask up to three questions to understand what’s getting in the way.`} />
    <div className="ari-message"><div className="ari-avatar">{character.name[0]}</div><div className="message-copy"><span className="speaker-name">{character.name} <span>· {character.role}</span></span><p>{character.introduction}</p></div></div>
    {lastQuestion && <div className="answer-card" aria-live="polite"><span className="answer-label">ARI SAYS</span><p>{lastQuestion.answer}</p><span className="answer-insight">↳ {lastQuestion.insight}</span></div>}
    <div className="choice-heading"><div><span className="eyebrow">{asked < 3 ? `${3 - asked} QUESTIONS LEFT` : "YOU’VE HEARD FROM ARI"}</span><h2>{asked >= 3 ? "What did you learn?" : "What do you want to ask?"}</h2></div><span className="question-count">{String(asked).padStart(2, "0")} / 03</span></div>
    <div className="choice-list">{questionCatalog.map((question) => {
      const alreadyAsked = state.questionsAsked.includes(question.id);
      return <button key={question.id} className={`choice-row${selected === question.id ? " is-selected" : ""}${alreadyAsked ? " is-asked" : ""}`} onClick={() => setSelected(question.id)} disabled={alreadyAsked || asked >= 3} type="button" aria-pressed={selected === question.id}>
        <span className="choice-radio" aria-hidden="true">{alreadyAsked ? "✓" : selected === question.id ? "•" : ""}</span><span>{question.text}</span><span className="choice-chevron">↗</span>
      </button>;
    })}</div>
    <div className="continue-row"><span className="continue-hint">{asked ? "Good questions help you see the real need." : "Look for a question that reveals the problem."}</span>
      {asked < 3 ? <button className="button button-primary" disabled={!selected} onClick={ask} type="button">Ask Ari <span aria-hidden="true">→</span></button> : <button className="button button-primary" onClick={() => dispatch({ type: "ADVANCE" })} type="button">Define the problem <span aria-hidden="true">→</span></button>}
      {asked >= 2 && asked < 3 && <button className="text-button continue-secondary" onClick={() => dispatch({ type: "ADVANCE" })} type="button">I have enough to continue</button>}
    </div>
  </>;
}

function ProblemStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const selected = problemOptions.find((option) => option.id === state.problemChoice);
  return <>
    <StageHeading eyebrow="STEP 02 · DEFINE THE PROBLEM" title="What needs fixing?" description="Pick the statement that best describes Ari’s problem. Specific problems lead to more useful solutions." />
    <ChoiceList label="Choose the problem that best describes Ari’s need" options={problemOptions.map((option) => ({ id: option.id, label: option.text }))} value={state.problemChoice} onChange={(problem) => dispatch({ type: "SELECT_PROBLEM", problem })} />
    {selected && <div className="inline-feedback"><span className="feedback-mark">↗</span><p>{selected.reason}</p></div>}
    <StageContinue disabled={!state.problemChoice} onClick={() => dispatch({ type: "ADVANCE" })}>Choose what to build first</StageContinue>
  </>;
}

function ScopeStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const cost = costOf(state.selectedFeatures);
  const overBudget = cost > mission1Definition.scoring.featureBudget;
  const allCore = featureCatalog.filter((item) => item.core).every((item) => state.selectedFeatures.includes(item.id));
  return <>
    <StageHeading eyebrow="STEP 03 · THE FIRST VERSION" title="What does Ari need first?" description="Choose the parts that help the club track who has each item. Extras can wait until the basic handoff works." />
    <div className="budget-bar"><div><span className="eyebrow">ROOM IN THIS VERSION</span><strong>{mission1Definition.scoring.featureBudget - cost} <span>choices left</span></strong></div><div className="budget-blocks" aria-label={`${cost} of ${mission1Definition.scoring.featureBudget} choices used`}>{Array.from({ length: mission1Definition.scoring.featureBudget }, (_, i) => <span className={i < cost ? "is-used" : ""} key={i} />)}</div></div>
    <div className="feature-list">{featureCatalog.map((feature) => {
      const checked = state.selectedFeatures.includes(feature.id);
      return <button key={feature.id} className={`feature-row${checked ? " is-selected" : ""}`} onClick={() => dispatch({ type: "TOGGLE_FEATURE", feature: feature.id })} type="button" aria-pressed={checked}>
        <span className="feature-check">{checked ? "✓" : ""}</span><span className="feature-name">{feature.label}{feature.core && <small>CORE</small>}</span><span className="feature-cost">{feature.cost} pt{feature.cost > 1 ? "s" : ""}</span>
      </button>;
    })}</div>
    <div className="scope-note"><span>{allCore ? "✓" : "↗"}</span><p>{allCore ? "Your first version covers the handoff: list, borrow, name, return, and saved state." : "Can a member borrow a camera and can Ari see who has it? Make sure the first version can do both."}</p></div>
    <StageContinue disabled={!state.selectedFeatures.length || overBudget} onClick={() => dispatch({ type: "ADVANCE" })}>{overBudget ? "Too many choices" : "Give the AI a goal"}</StageContinue>
  </>;
}

function BriefStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const quality = evaluateBrief(state.brief);
  const qualities = [{ key: "context", label: "Who it helps", hint: "Who is it for and why?" }, { key: "behavior", label: "What they can do", hint: "What should it do?" }, { key: "boundaries", label: "What can wait", hint: "What should stay out?" }, { key: "verification", label: "How you’ll know", hint: "How will we know it works?" }] as const;
  return <>
    <StageHeading eyebrow="STEP 04 · GIVE THE AI A GOAL" title="What should the AI build?" description="Say who it helps, what they should be able to do, and how you’ll know it worked." />
    <div className="brief-layout"><div className="brief-editor"><label htmlFor="build-brief" className="eyebrow">YOUR REQUEST TO THE AI</label><textarea id="build-brief" value={state.brief} onChange={(event) => dispatch({ type: "SET_BRIEF", brief: event.target.value })} placeholder="Build a simple equipment tracker for Ari’s photography club…" maxLength={800} /><div className="editor-foot"><span>Write it like you’re telling a helpful builder what to make.</span><span>{state.brief.length} / 800</span></div><div className="brief-prompts"><span className="eyebrow">A FEW USEFUL DETAILS</span><div><span>Who does it help?</span><span>What should they do?</span><span>What can wait?</span><span>How will you know?</span></div></div></div>
      <div className="quality-panel"><div className="quality-head"><span className="eyebrow">HELPFUL DETAILS</span><strong>{quality.total / 25}<span> / 4</span></strong></div><div className="quality-rows">{qualities.map((part) => <div className="quality-row" key={part.key}><span className={`quality-dot ${quality[part.key] ? "is-met" : ""}`} /><span className="quality-label">{part.label}</span><span className="quality-hint">{quality[part.key] ? "Included" : part.hint}</span></div>)}</div><p className="quality-foot">This checks for useful details, not perfect wording.</p></div></div>
    <StageContinue disabled={!state.brief.trim()} onClick={() => dispatch({ type: "BUILD", issues: getBuildIssues({ ...state, promptQuality: quality }), quality })}>Send to the AI</StageContinue>
  </>;
}

function BuildStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const quality = state.promptQuality;
  return <>
    <StageHeading eyebrow="STEP 05 · AI BUILD" title="The AI says it’s done." description="Your developer built a first version from your request. Before you trust the report, take a look at what’s actually there." />
    <div className="build-status"><span className="status-icon">✓</span><div><strong>The developer followed your goal.</strong><span>Your request shaped what was built.</span></div><span className="status-tag">BUILD COMPLETE</span></div>
    <div className="build-review"><div className="review-heading"><span className="eyebrow">WHAT THE BUILDER MADE</span><span className="review-score">{quality.total / 25} helpful details</span></div><p className="review-summary">The AI made an equipment tracker based on your request.</p><div className="review-split"><div className="review-column"><span className="review-label">INCLUDED</span>{state.selectedFeatures.map((id) => <span className="review-line" key={id}><i />{featureCatalog.find((feature) => feature.id === id)?.label}</span>)}</div><div className="review-column warning-column"><span className="review-label">NEEDS A LOOK</span>{state.buildIssues.map((issue) => <span className="review-line" key={issue}><i />{buildIssueLabels[issue] ?? issue}</span>)}{!state.buildIssues.length && <span className="review-line"><i />No obvious gaps in the request.</span>}</div></div></div>
    <div className="callout-strip"><span>!</span><p>AI can build quickly. <strong>You’re still responsible for checking the result.</strong></p></div>
    <StageContinue onClick={() => dispatch({ type: "ADVANCE" })}>Open the product</StageContinue>
  </>;
}

function ProductPreview({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const item = state.equipment.find((entry) => entry.id === "camera")!;
  const hasCheckout = state.selectedFeatures.includes("checkout") && state.selectedFeatures.includes("borrower");
  const hasReturn = state.selectedFeatures.includes("return");
  return <div className="product-preview">
    <div className="product-head"><div><span className="eyebrow">AI BUILD · YOUR APP</span><h2>Club gear</h2></div><span className="live-label"><i /> LIVE PREVIEW</span></div>
    {state.buildIssues.includes("extra-feature") && <div className="extra-feature"><span>✦</span> Member activity <span className="extra-pill">Added by AI</span></div>}
    <div className="equipment-list">{state.equipment.filter((entry) => state.selectedFeatures.includes("list") || entry.id === "camera").map((gear) => <div className="equipment-row" key={gear.id}><div className="gear-mark">{gear.kind === "Camera" ? "◉" : gear.kind === "Support" ? "╱" : gear.kind === "Audio" ? "≈" : "▤"}</div><div className="gear-name"><strong>{gear.name}</strong><span>{gear.available ? "Ready to borrow" : `With ${gear.borrower || "—"}`}</span></div><span className={`availability ${gear.available ? "is-available" : "is-out"}`}><i />{gear.available ? "Available" : "Checked out"}</span><div className="gear-action">{!gear.available && hasReturn && <button className={`small-action${state.buildIssues.includes("return-confusing") ? "" : " is-prominent"}`} onClick={() => dispatch({ type: "RETURN", itemId: gear.id })} type="button">Return</button>}</div></div>)}</div>
    {hasCheckout && <div className="checkout-form"><label htmlFor="borrower-name">Check out Canon EOS M50</label><div className="checkout-controls"><input id="borrower-name" aria-label="Borrower name" value={state.borrowerInput} onChange={(event) => dispatch({ type: "SET_BORROWER", borrower: event.target.value })} placeholder="Borrower name" /><button className="button button-primary" onClick={() => dispatch({ type: "CHECKOUT", itemId: "camera", invalid: !state.borrowerInput.trim() })} disabled={!item.available && !state.buildIssues.includes("double-checkout")} type="button">Check out</button></div>{state.buildIssues.includes("blank-name") && <span className="form-hint warning">This build may accept an empty name. Try it and find out.</span>}</div>}
    {!hasCheckout && <p className="missing-feature">Checkout and borrower tracking weren’t both included in the MVP.</p>}
    <div className="preview-footer"><span>Preview interactions change the product state.</span><button className="text-button" onClick={() => dispatch({ type: "SIMULATE_REFRESH" })} type="button">Simulate refresh ↻</button><button className="text-button" onClick={() => dispatch({ type: "RUN_TEST", test: "checkout" })} type="button">Run happy path ↗</button></div>
  </div>;
}

function TestStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const testCases: { id: TestId; label: string; description: string; category: string }[] = [
    { id: "checkout", label: "Check out a camera", description: "Borrower appears and camera becomes unavailable.", category: "CORE FLOW" },
    { id: "return", label: "Return the camera", description: "Borrower clears and camera becomes available.", category: "CORE FLOW" },
    { id: "blank-name", label: "Try a blank borrower name", description: "Checkout is rejected and nothing changes.", category: "EDGE CASE" },
    { id: "double-checkout", label: "Try checking out an item twice", description: "A borrowed item stays unavailable.", category: "EDGE CASE" },
    { id: "persistence", label: "Refresh after changing an item", description: "The updated borrower and availability remain.", category: "SAVED STATE" },
  ];
  return <>
    <StageHeading eyebrow="STEP 06 · TRY THE APP" title="Try Ari’s equipment tracker." description="Use the app yourself, then check the important things you want to work." />
    <ProductPreview state={state} dispatch={dispatch} />
    <div className="test-section"><div className="test-section-head"><div><span className="eyebrow">TEST PLAN</span><h2>What should we check?</h2></div><span className="test-run-count">{state.testsRun.length} run</span></div>
      <div className="test-list">{testCases.map((test) => {
        const result = state.testResults[test.id];
        const ran = state.testsRun.includes(test.id);
        return <div className={`test-row${ran ? result?.passed ? " is-pass" : " is-fail" : ""}`} key={test.id}><div className="test-state">{ran ? result?.passed ? "✓" : "!" : "·"}</div><div className="test-copy"><span className="test-category">{test.category}</span><strong>{testLabelText[test.id]}</strong><span>{ran ? result?.detail : test.description}</span></div><button className={`test-button${ran ? " has-run" : ""}`} onClick={() => dispatch({ type: "RUN_TEST", test: test.id })} type="button">{ran ? "Run again" : "Run test"}</button></div>;
      })}</div>
    </div>
    <StageContinue onClick={() => dispatch({ type: "ADVANCE" })}>See what Ari thinks</StageContinue>
  </>;
}

function FeedbackStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const feedback = [
    { id: "useful", title: "“This is really useful.”", description: "Ari gets a quick view of the equipment." },
    { id: "return", title: "Ari pauses before returning the camera.", description: "They look around the screen for a few seconds." },
    { id: "reservations", title: "“Could we add reservations?”", description: "Ari suggests a feature for a later version." },
    { id: "dark", title: "“Dark mode would be cool.”", description: "Another student shares a preference." },
  ];
  return <>
    <StageHeading eyebrow="STEP 07 · GATHER FEEDBACK" title="Watch Ari use it." description="Ari tried the product. Choose the feedback that should guide the next change. You can select more than one signal." />
    <div className="feedback-list">{feedback.map((item) => {
      const selected = state.feedbackChoices.includes(item.id);
      return <button className={`feedback-card${selected ? " is-selected" : ""}`} key={item.id} onClick={() => dispatch({ type: "SELECT_FEEDBACK", feedback: item.id })} type="button" aria-pressed={selected}><span className="feedback-check">{selected ? "✓" : ""}</span><span className="feedback-copy"><strong>{item.title}</strong><span>{item.description}</span></span><span className="feedback-kind">{item.id === "return" ? "OBSERVED" : item.id === "useful" ? "OUTCOME" : "SUGGESTION"}</span></button>;
    })}</div>
    <div className="callout-strip soft"><span>↗</span><p>A request can be worth remembering without being the <strong>next thing to build.</strong></p></div>
    <StageContinue onClick={() => dispatch({ type: "ADVANCE" })}>Choose an iteration</StageContinue>
  </>;
}

function IterationStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const chosen = iterationOptions.find((item) => item.id === state.iterationChoice);
  const before = state.iterationChoice === "blank" ? "The checkout accepted an empty name." : state.iterationChoice === "return" ? "Ari paused while looking for Return." : "The core gear flow works; this change came from a suggestion.";
  const after = state.iterationChoice === "blank" ? "Empty names are rejected before the item changes." : state.iterationChoice === "return" ? "Return is visible beside each checked out item." : state.iterationChoice === "reservations" ? "Reservations were added; Ari’s return task is still unchanged." : state.iterationChoice === "dark" ? "Dark mode was added; Ari’s return task is still unchanged." : "The app was rebuilt, so working behavior needs a new round of checks.";
  const evidence = state.iterationChoice === "blank" ? state.iterationTested ? "The invalid checkout test now passes." : "Retest a blank checkout to confirm the fix." : state.iterationChoice === "return" ? state.iterationTested ? "Ari can spot Return without searching." : "Watch Ari find Return, then test the return flow." : "No test shows this change solved Ari’s main problem.";
  return <>
    <StageHeading eyebrow="STEP 08 · CHOOSE AN ITERATION" title="What should change first?" description="Pick one improvement. Keep the working parts and focus on what the evidence says." />
    <ChoiceList label="Choose an iteration based on the evidence" options={iterationOptions.map((option) => ({ id: option.id, label: option.text, detail: option.signal }))} value={state.iterationChoice} onChange={(iteration) => dispatch({ type: "SELECT_ITERATION", iteration })} variant="iteration" />
    {chosen && <div className="iteration-preview"><div className="iteration-preview-head"><span className="eyebrow">{state.iterationTested ? "SECOND BUILD · READY TO REVIEW" : "FOCUSED UPDATE"}</span><span className="kept-label">{state.iterationTested ? "IMPLEMENTED FROM YOUR CHOICE" : "KEEPING THE REST OF THE APP"}</span></div><div className="before-after"><div><span className="eyebrow">BEFORE</span><p>{before}</p></div><span className="change-arrow">→</span><div><span className="eyebrow">AFTER</span><p>{after}</p></div></div>{state.iterationTested && <div className="second-build-preview">{state.iterationChoice === "return" ? <><div><span className="gear-mark">◉</span><span><strong>Canon EOS M50</strong><small>With Ari</small></span></div><button className="small-action is-prominent" type="button" tabIndex={-1}>Return</button></> : state.iterationChoice === "blank" ? <><span className="blank-preview">Borrower name is required</span><span className="blocked-action">Check out · blocked</span></> : <><span className="feature-added">{chosen.text}</span><span className="feature-added-note">The core return task remains unchanged.</span></>}</div>}<div className={`evidence-line${state.iterationTested && state.iterationChoice === "return" || state.iterationTested && state.iterationChoice === "blank" ? " is-verified" : ""}`}><span>{state.iterationTested && ["return", "blank"].includes(state.iterationChoice) ? "✓" : "↗"}</span><p><strong>Evidence:</strong> {evidence}</p></div></div>}
    {!state.iterationTested ? <StageContinue disabled={!chosen} onClick={() => dispatch({ type: "RETEST" })}>Retest the change</StageContinue> : <div className="continue-row"><span className="continue-hint">The focused change is checked and ready.</span><button className="button button-primary" onClick={() => dispatch({ type: "SHIP" })} type="button">Ship the product <span aria-hidden="true">→</span></button></div>}
  </>;
}

function ResultsStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const scores = skillScores(state);
  const summary = makeBuilderSummary(state);
  return <>
    <StageHeading eyebrow="STEP 09 · SHIP IT" title="You shipped something useful." description="You took Ari’s problem from first conversation to a tested product. Here’s what you learned by doing it." />
    <div className="ship-banner"><span className="ship-check">✓</span><div><strong>Mission complete</strong><span>The Missing Cameras · First version shipped</span></div><span className="ship-date">BUILDLOOP / 01</span></div>
    <div className="score-section"><div className="section-label"><span className="eyebrow">YOUR BUILDER SKILLS</span><span>Based on the choices you made</span></div><div className="score-grid">{scores.map((item) => <article className="score-card" key={item.name}><div className="score-top"><h2>{item.name}</h2><strong>{skillLabel(item.score)}</strong></div><div className="score-track"><span style={{ width: `${item.score}%` }} /></div><p>{item.explanation}</p></article>)}</div></div>
    <details className="summary-details" open><summary><span>Builder summary</span><span className="summary-expand">YOUR MISSION RECORD · ATTEMPT {getLearnerProgress().currentAttempt}</span></summary><div className="summary-grid"><SummaryItem label="USER" value={summary.user} /><SummaryItem label="PROBLEM YOU IDENTIFIED" value={summary.problem} /><SummaryItem label="FIRST VERSION" value={summary.mvp.length ? summary.mvp.join(" · ") : "No features selected"} /><SummaryItem label="WHAT YOU TOLD THE AI" value={summary.brief} /><SummaryItem label="WHAT THE AI BUILT" value={summary.buildOutcome} /><SummaryItem label="WHAT HAPPENED WHEN YOU TRIED IT" value={summary.tests.length ? summary.tests.map((test) => `${test.name}: ${test.result?.detail ?? "not recorded"}`).join(" · ") : "No tests run"} /><SummaryItem label="FEEDBACK YOU NOTICED" value={summary.feedback.length ? summary.feedback.join(" · ") : "No feedback selected"} /><SummaryItem label="FEEDBACK YOU ACTED ON" value={summary.feedbackActedOn} /><SummaryItem label="CHANGE YOU MADE" value={summary.changeMade} /><SummaryItem label="WHAT YOU SHIPPED" value={summary.shipped} /></div><div className="summary-equipment"><span className="eyebrow">FINAL PRODUCT STATE</span>{summary.finalEquipment.map((item) => <span key={item.name}>{item.name}<strong>{item.borrower}</strong></span>)}</div></details>
    <section className="lesson-section"><span className="eyebrow">WHAT YOUR CHOICES TAUGHT YOU</span><div>{summary.lessons.map((lesson) => <p key={lesson}><span aria-hidden="true">↗</span>{lesson}</p>)}</div></section>
    <div className="result-actions"><span>Your mission and skill progress are saved on this device.</span><button className="button button-quiet" onClick={() => dispatch({ type: "START" })} type="button">Replay Mission <span aria-hidden="true">↺</span></button><button className="button button-primary" onClick={() => dispatch({ type: "RESET" })} type="button">Return to Missions <span aria-hidden="true">→</span></button></div>
  </>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="summary-item"><span className="eyebrow">{label}</span><p>{value}</p></div>;
}

export default function MissionPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReadySnapshot, serverReadySnapshot);
  const state = useSyncExternalStore(subscribeMission, getMissionState, getServerMissionState);
  const learnerProgress = useSyncExternalStore(subscribeMission, getLearnerProgress, getServerLearnerProgress);
  const mission2State = useSyncExternalStore(subscribeMission, getMission2State, getServerMission2State);
  const mission2Progress = useSyncExternalStore(subscribeMission, getMission2Progress, getServerMission2Progress);
  const mission3State = useSyncExternalStore(subscribeMission, getMission3State, getServerMission3State);
  const mission3Progress = useSyncExternalStore(subscribeMission, getMission3Progress, getServerMission3Progress);
  const mission4State = useSyncExternalStore(subscribeMission, getMission4State, getServerMission4State);
  const mission4Progress = useSyncExternalStore(subscribeMission, getMission4Progress, getServerMission4Progress);
  const activeMission = useSyncExternalStore(subscribeMission, getActiveMission, () => 1);
  const dispatch = dispatchMission;
  if (activeMission === 4 && mission4State.stage > 0) return <div data-hydrated={hydrated}><MissionFourPlayer state={mission4State} progress={mission4Progress} /></div>;
  if (activeMission === 3 && mission3State.stage > 0) return <div data-hydrated={hydrated}><MissionThreePlayer state={mission3State} progress={mission3Progress} /></div>;
  if (activeMission === 2 && mission2State.stage > 0) return <div data-hydrated={hydrated}><MissionTwoPlayer state={mission2State} progress={mission2Progress} attemptCount={mission2Progress.attempts.length + 1} /></div>;
  if (activeMission === 0 || state.stage === 0) return <div data-hydrated={hydrated}><MissionHub state={state} progress={learnerProgress} mission2State={mission2State} mission2Progress={mission2Progress} mission3State={mission3State} mission3Progress={mission3Progress} mission4State={mission4State} mission4Progress={mission4Progress} onStart={() => dispatch({ type: "START" })} onStart2={startMission2} onStart3={startMission3} onStart4={startMission4} /></div>;
  let stageView: ReactNode;
  switch (state.stage) {
    case 1: stageView = <Discovery state={state} dispatch={dispatch} />; break;
    case 2: stageView = <ProblemStage state={state} dispatch={dispatch} />; break;
    case 3: stageView = <ScopeStage state={state} dispatch={dispatch} />; break;
    case 4: stageView = <BriefStage state={state} dispatch={dispatch} />; break;
    case 5: stageView = <BuildStage state={state} dispatch={dispatch} />; break;
    case 6: stageView = <TestStage state={state} dispatch={dispatch} />; break;
    case 7: stageView = <FeedbackStage state={state} dispatch={dispatch} />; break;
    case 8: stageView = <IterationStage state={state} dispatch={dispatch} />; break;
    default: stageView = <ResultsStage state={state} dispatch={dispatch} />;
  }
  return <div data-hydrated={hydrated}><PageFrame state={state} dispatch={dispatch}>{stageView}</PageFrame></div>;
}
