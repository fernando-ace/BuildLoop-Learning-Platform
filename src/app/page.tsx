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
} from "@/lib/mission";
import { dispatchMission, getMissionState, getServerMissionState, subscribeMission } from "@/lib/store";
import type { MissionAction } from "@/lib/reducer";

const subscribeToHydration = () => () => {};
const clientReadySnapshot = () => true;
const serverReadySnapshot = () => false;
const progressStages = ["Meet Ari", "Define", "MVP", "Brief", "Build", "Test", "Feedback", "Iterate", "Ship"];
const issueLabels: Record<string, string> = {
  "blank-name": "Blank borrower names are accepted",
  "double-checkout": "An already borrowed item can be checked out again",
  "return-confusing": "The Return action is hard to spot",
  persistence: "Changes disappear after a refresh",
  "extra-feature": "The AI added an extra feature you did not ask for",
};

function RestoreMission({ state, onReset }: { state: MissionState; onReset: () => void }) {
  if (state.stage === 0) return null;
  return (
    <button className="text-button" onClick={onReset} type="button" aria-label="Start over">
      Start over
    </button>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="welcome-wrap">
      <section className="welcome-copy">
        <div className="welcome-logo" aria-label="BuildLoop">build<span>loop</span><i /></div>
        <p className="welcome-kicker">MISSION 01 <span>·</span> PRODUCT BUILDER</p>
        <h1>Help Ari find<br />the missing cameras.</h1>
        <p className="welcome-description">The photography club keeps losing track of its gear. You’ll work with Ari, direct an AI developer, and test what gets built.</p>
        <div className="welcome-meta"><span>About 20 minutes</span><span className="meta-dot" /><span>No coding needed</span></div>
        <button className="button button-primary button-large" onClick={onStart} type="button">Start the mission <span aria-hidden="true">→</span></button>
      </section>
      <aside className="welcome-side" aria-label="Mission preview">
        <div className="camera-card">
          <div className="camera-frame"><div className="camera-body"><div className="camera-top" /><div className="lens-outer"><div className="lens-inner" /></div><div className="camera-flash" /></div></div>
          <div className="camera-caption"><div><span className="eyebrow">THE CHALLENGE</span><strong>Where’s the camera?</strong></div><span className="caption-arrow">↗</span></div>
        </div>
        <div className="side-note"><span className="note-rule" /><p>Understand first.<br /><strong>Build with purpose.</strong></p></div>
        <span className="decorative-index" aria-hidden="true">01 / 01</span>
      </aside>
    </main>
  );
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
  const [answer, setAnswer] = useState("");
  const [insight, setInsight] = useState("");
  const asked = state.questionsAsked.length;
  const ask = () => {
    if (!selected || asked >= 3) return;
    const question = questionCatalog.find((item) => item.id === selected);
    if (!question) return;
    setAnswer(question.answer); setInsight(question.insight);
    dispatch({ type: "ASK", question: question.id });
    setSelected("");
  };
  return <>
    <StageHeading eyebrow="STEP 01 · MEET THE USER" title="Meet Ari." description="Ari runs the photography club. Ask up to three questions to understand what’s getting in the way." />
    <div className="ari-message"><div className="ari-avatar">A</div><div className="message-copy"><span className="speaker-name">Ari <span>· Photography club officer</span></span><p>We keep track in the group chat, but nobody can tell who has the camera.</p></div></div>
    {answer && <div className="answer-card" aria-live="polite"><span className="answer-label">ARI SAYS</span><p>{answer}</p><span className="answer-insight">↳ {insight}</span></div>}
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
    <div className="selection-list">{problemOptions.map((option, index) => <button key={option.id} className={`selection-card${state.problemChoice === option.id ? " is-selected" : ""}`} onClick={() => dispatch({ type: "SELECT_PROBLEM", problem: option.id })} type="button" aria-pressed={state.problemChoice === option.id}><span className="selection-index">0{index + 1}</span><span className="selection-text">{option.text}</span><span className="selection-radio" /></button>)}</div>
    {selected && <div className="inline-feedback"><span className="feedback-mark">↗</span><p>{selected.reason}</p></div>}
    <StageContinue disabled={!state.problemChoice} onClick={() => dispatch({ type: "ADVANCE" })}>Choose an MVP</StageContinue>
  </>;
}

function ScopeStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const cost = costOf(state.selectedFeatures);
  const overBudget = cost > 7;
  const allCore = featureCatalog.filter((item) => item.core).every((item) => state.selectedFeatures.includes(item.id));
  return <>
    <StageHeading eyebrow="STEP 03 · SCOPE THE MVP" title="Spend your build budget." description="Choose what the first version needs. Your budget is tight on purpose: focus on proving the useful behavior." />
    <div className="budget-bar"><div><span className="eyebrow">BUILD BUDGET</span><strong>{7 - cost} <span>of 7 points left</span></strong></div><div className="budget-blocks" aria-label={`${cost} of 7 budget points used`}>{Array.from({ length: 7 }, (_, i) => <span className={i < cost ? "is-used" : ""} key={i} />)}</div></div>
    <div className="feature-list">{featureCatalog.map((feature) => {
      const checked = state.selectedFeatures.includes(feature.id);
      return <button key={feature.id} className={`feature-row${checked ? " is-selected" : ""}`} onClick={() => dispatch({ type: "TOGGLE_FEATURE", feature: feature.id })} type="button" aria-pressed={checked}>
        <span className="feature-check">{checked ? "✓" : ""}</span><span className="feature-name">{feature.label}{feature.core && <small>CORE</small>}</span><span className="feature-cost">{feature.cost} pt{feature.cost > 1 ? "s" : ""}</span>
      </button>;
    })}</div>
    <div className="scope-note"><span>{allCore ? "✓" : "↗"}</span><p>{allCore ? "Your core flow is covered: list, checkout, name, return, and saved state." : "Can a club member borrow a camera and can Ari see who has it? Make sure your MVP can answer both."}</p></div>
    <StageContinue disabled={!state.selectedFeatures.length || overBudget} onClick={() => dispatch({ type: "ADVANCE" })}>{overBudget ? "Over budget" : "Write a build brief"}</StageContinue>
  </>;
}

function BriefStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const quality = evaluateBrief(state.brief);
  const qualities = [{ key: "context", label: "Context", hint: "Who is it for and why?" }, { key: "behavior", label: "Behavior", hint: "What should it do?" }, { key: "boundaries", label: "Boundaries", hint: "What should stay out?" }, { key: "verification", label: "Checks", hint: "How will we know it works?" }] as const;
  return <>
    <StageHeading eyebrow="STEP 04 · DIRECT THE AI" title="Brief your AI developer." description="Describe what to build in your own words. A useful brief says who it’s for, what it should do, and how to check the result." />
    <div className="brief-layout"><div className="brief-editor"><label htmlFor="build-brief" className="eyebrow">YOUR BUILD BRIEF</label><textarea id="build-brief" value={state.brief} onChange={(event) => dispatch({ type: "SET_BRIEF", brief: event.target.value })} placeholder="Build a simple equipment tracker for Ari’s photography club…" maxLength={800} /><div className="editor-foot"><span>Write it like you’re talking to a developer.</span><span>{state.brief.length} / 800</span></div><div className="brief-prompts"><span className="eyebrow">THINGS TO CONSIDER</span><div><span>Who is it for?</span><span>What should it do?</span><span>What should it skip?</span><span>How will you test it?</span></div></div></div>
      <div className="quality-panel"><div className="quality-head"><span className="eyebrow">BRIEF QUALITY</span><strong>{quality.total}<span> / 100</span></strong></div><div className="quality-rows">{qualities.map((part) => <div className="quality-row" key={part.key}><span className={`quality-dot ${quality[part.key] ? "is-met" : ""}`} /><span className="quality-label">{part.label}</span><span className="quality-hint">{quality[part.key] ? "Covered" : part.hint}</span></div>)}</div><p className="quality-foot">This checks for useful details, not perfect wording.</p></div></div>
    <StageContinue disabled={!state.brief.trim()} onClick={() => dispatch({ type: "BUILD", issues: getBuildIssues({ ...state, promptQuality: quality }), quality })}>Send to the AI</StageContinue>
  </>;
}

function BuildStage({ state, dispatch }: { state: MissionState; dispatch: Dispatch<MissionAction> }) {
  const quality = state.promptQuality;
  return <>
    <StageHeading eyebrow="STEP 05 · AI BUILD" title="The AI says it’s done." description="Your developer built a first version from your brief. Before you trust the handoff, take a look at what’s actually there." />
    <div className="build-status"><span className="status-icon">✓</span><div><strong>First version ready</strong><span>Build time · 42 seconds</span></div><span className="status-tag">BUILD COMPLETE</span></div>
    <div className="build-review"><div className="review-heading"><span className="eyebrow">IMPLEMENTATION NOTES</span><span className="review-score">BRIEF {quality.total} / 100</span></div><p className="review-summary">The AI made an equipment tracker based on your instructions.</p><div className="review-split"><div className="review-column"><span className="review-label">INCLUDED</span>{state.selectedFeatures.map((id) => <span className="review-line" key={id}><i />{featureCatalog.find((feature) => feature.id === id)?.label}</span>)}</div><div className="review-column warning-column"><span className="review-label">NEEDS A LOOK</span>{state.buildIssues.map((issue) => <span className="review-line" key={issue}><i />{issueLabels[issue]}</span>)}{!state.buildIssues.length && <span className="review-line"><i />No obvious gaps in the brief.</span>}</div></div></div>
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
    <StageHeading eyebrow="STEP 06 · TEST THE PRODUCT" title="Put it through its paces." description="Try the app, then pick the checks you want to run. Testing is how you find out whether the build matches the brief." />
    <ProductPreview state={state} dispatch={dispatch} />
    <div className="test-section"><div className="test-section-head"><div><span className="eyebrow">TEST PLAN</span><h2>What should we check?</h2></div><span className="test-run-count">{state.testsRun.length} run</span></div>
      <div className="test-list">{testCases.map((test) => {
        const result = state.testResults[test.id];
        const ran = state.testsRun.includes(test.id);
        return <div className={`test-row${ran ? result?.passed ? " is-pass" : " is-fail" : ""}`} key={test.id}><div className="test-state">{ran ? result?.passed ? "✓" : "!" : "·"}</div><div className="test-copy"><span className="test-category">{test.category}</span><strong>{test.label}</strong><span>{ran ? result?.detail : test.description}</span></div><button className={`test-button${ran ? " has-run" : ""}`} onClick={() => dispatch({ type: "RUN_TEST", test: test.id })} type="button">{ran ? "Run again" : "Run test"}</button></div>;
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
    <div className="iteration-list">{iterationOptions.map((option, index) => <button key={option.id} className={`iteration-row${state.iterationChoice === option.id ? " is-selected" : ""}`} onClick={() => dispatch({ type: "SELECT_ITERATION", iteration: option.id })} type="button" aria-pressed={state.iterationChoice === option.id}><span className="selection-index">0{index + 1}</span><span className="iteration-text"><strong>{option.text}</strong><small>Evidence: {option.signal}</small></span><span className="selection-radio" /></button>)}</div>
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
    <div className="score-section"><div className="section-label"><span className="eyebrow">YOUR BUILDER SKILLS</span><span>Based on the choices you made</span></div><div className="score-grid">{scores.map((item) => <article className="score-card" key={item.name}><div className="score-top"><h2>{item.name}</h2><strong>{item.score}<span> / 100</span></strong></div><div className="score-track"><span style={{ width: `${item.score}%` }} /></div><p>{item.explanation}</p></article>)}</div></div>
    <details className="summary-details" open><summary><span>Builder summary</span><span className="summary-expand">MISSION RECORD · 01</span></summary><div className="summary-grid"><SummaryItem label="USER" value={summary.user} /><SummaryItem label="PROBLEM" value={summary.problem} /><SummaryItem label="MVP" value={summary.mvp.length ? summary.mvp.join(" · ") : "No features selected"} /><SummaryItem label="TESTS RUN" value={summary.tests.length ? summary.tests.map((test) => `${test.name} (${test.result?.passed ? "passed" : "found an issue"})`).join(" · ") : "No tests run"} /><SummaryItem label="FEEDBACK" value={summary.feedback.length ? summary.feedback.join(" · ") : "No feedback selected"} /><SummaryItem label="ITERATION" value={summary.iteration} /><SummaryItem label="WHY THIS CHANGE" value={summary.iterationReason} /></div><div className="summary-equipment"><span className="eyebrow">FINAL PRODUCT STATE</span>{summary.finalEquipment.map((item) => <span key={item.name}>{item.name}<strong>{item.borrower}</strong></span>)}</div></details>
    <div className="result-actions"><span>Your mission progress is saved on this device.</span><button className="button button-quiet" onClick={() => dispatch({ type: "RESET" })} type="button">Play again ↺</button></div>
  </>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="summary-item"><span className="eyebrow">{label}</span><p>{value}</p></div>;
}

export default function MissionPage() {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReadySnapshot, serverReadySnapshot);
  const state = useSyncExternalStore(subscribeMission, getMissionState, getServerMissionState);
  const dispatch = dispatchMission;
  if (state.stage === 0) return <div data-hydrated={hydrated}><Welcome onStart={() => dispatch({ type: "START" })} /></div>;
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
