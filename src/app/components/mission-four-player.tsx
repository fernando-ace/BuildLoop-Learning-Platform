"use client";

import { dispatchMission4 } from "@/lib/store";
import { buildMission4V2, mission4Definition as definition, mission4Scores, mission4Summary, mission4TaskPassed, type Mission4Progress, type Mission4State } from "@/lib/missions/what-next";
import { skillLabel } from "@/lib/learner";

function Choice({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button className={`m2-choice${selected ? " selected" : ""}`} type="button" aria-pressed={selected} onClick={onClick}>{children}<span>{selected ? "Selected" : "Choose"}</span></button>;
}

function Continue({ children, onClick, disabled = false }: { children: string; onClick: () => void; disabled?: boolean }) {
  return <div className="m2-continue"><span>{disabled ? "Choose above or try the task to continue" : "Your choices are saved as you go"}</span><button className="button button-primary" type="button" disabled={disabled} onClick={onClick}>{children}<span aria-hidden="true">→</span></button></div>;
}

function ProductPreview({ state, retest = false }: { state: Mission4State; retest?: boolean }) {
  const build = buildMission4V2(state.goal || "vague", retest ? state.followUp : "");
  const joined = retest ? state.retestJoined : state.joined;
  const leaveTried = retest ? state.retestLeft : state.left;
  const dispatch = dispatchMission4;
  const count = definition.product.sessions[0].seats - (joined && !(leaveTried && build.restoresSeat) ? 1 : 0);
  const membershipEnded = leaveTried && build.canLeave;
  return <section className="m4-product" aria-label={`${definition.product.name} app preview`}>
    <div className="m4-product-head"><div><span className="eyebrow">{retest ? "VERSION 2 · TRY IT AGAIN" : "VERSION 2 · LIVE PREVIEW"}</span><h2>{definition.product.name}</h2></div><span className="m4-live-dot">APP</span></div>
    <p>{definition.product.description}</p>
    <article className="m4-session-card"><div><strong>{definition.product.sessions[0].name}</strong><span>{definition.product.sessions[0].time}</span></div><span className="m4-seats">{count} seats<br/>open</span>
      {!joined || (membershipEnded && build.restoresSeat) ? <button className="button button-primary" type="button" onClick={() => dispatch({ type: retest ? "JOIN_RETEST" : "JOIN" })}>Join session</button>
        : <div className="m4-joined-row"><span className="m4-joined">✓ You’re signed up</span>{build.canLeave && !leaveTried ? <button className={`m4-leave${build.hasTinyControl ? " is-tiny" : ""}`} type="button" aria-label="Leave Algebra together" onClick={() => dispatch({ type: retest ? "LEAVE_RETEST" : "LEAVE" })}>{build.hasTinyControl ? "×" : "Leave session"}</button> : !build.canLeave && !leaveTried ? <button className="m4-can-not-find" type="button" onClick={() => dispatch({ type: retest ? "LEAVE_RETEST" : "LEAVE" })}>I can’t find a way to leave</button> : <span className={build.restoresSeat ? "m4-success" : "m4-problem"}>{build.restoresSeat ? "You left. A seat is open again." : "You’re still signed up. The seat count did not change."}</span>}</div>}
    </article>
    <article className="m4-session-card m4-secondary"><div><strong>{definition.product.sessions[1].name}</strong><span>{definition.product.sessions[1].time}</span></div><span className="m4-seats">{definition.product.sessions[1].seats}<br/>seats open</span><button className="m4-join-secondary" type="button" disabled>Join session</button></article>
    {build.hasExtras && <div className="m4-extras"><strong>New in this update</strong><span>Student chat</span><span>Profiles and ratings</span><span>Session reminders</span></div>}
    {joined && leaveTried && <p className={build.restoresSeat ? "m4-result is-good" : "m4-result is-issue"} role="status">{build.restoresSeat ? "You left the session. The open-seat count is back to 4." : build.canLeave ? "You left the session, but the open-seat count is still 3." : "There’s no leave action. The signup is still in place."}</p>}
  </section>;
}

function TaskStep({ state, retest = false }: { state: Mission4State; retest?: boolean }) {
  const joined = retest ? state.retestJoined : state.joined;
  const left = retest ? state.retestLeft : state.left;
  const label = retest ? "REPEAT THE SAME TASK" : "TRY THE STUDENT TASK";
  return <section className="m4-task"><span className="eyebrow">{label}</span><strong>A student joined the wrong session.</strong><ol><li>Join Algebra together.</li><li>Leave it.</li><li>Check that its open-seat count is correct.</li></ol><p>{!joined ? "Step 1: try joining the session in the app." : !left ? "Step 2: try leaving, or choose the note if no leave option appears." : buildMission4V2(state.goal || "vague", retest ? state.followUp : "").restoresSeat ? "The student can leave and the seat is back." : "The app did not finish the task correctly."}</p></section>;
}

export function MissionFourPlayer({ state, progress }: { state: Mission4State; progress: Mission4Progress }) {
  const dispatch = dispatchMission4;
  const summary = mission4Summary(state);
  const attempt = progress.attempts.length + (state.stage === 8 ? 0 : 1);
  const report = state.goal === "focused"
    ? "Added a way to leave a session and restore its open seat. Joining still works."
    : state.goal === "broad"
      ? "Added a leave action, plus chat, profiles, ratings, and reminders. The seat total may need a closer look."
      : state.goal === "micromanaged"
        ? "Added the small red X shortcut. The signup count should be fine."
        : "Tidied the signup screen. I think it is easier to use now.";
  return <div className="m2-shell m4-shell" data-mission="4">
    <header className="m2-topbar"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); dispatch({ type: "RETURN" }); }}>build<span>loop</span><i /></a><div><strong>Mission 4</strong><span> · {definition.metadata.title}</span></div><button className="text-button" type="button" onClick={() => dispatch({ type: "RETURN" })}>Mission Hub</button></header>
    <div className="m2-progress" aria-label={`Step ${Math.min(state.stage, 7)} of 7`}><span style={{ width: `${Math.min(state.stage, 7) / 7 * 100}%` }} /></div>
    <main className="m2-main">
      <div className="m2-stage-meta"><span>MISSION 4</span><span>{state.stage === 8 ? "COMPLETE" : `STEP ${String(state.stage).padStart(2, "0")} / 07`}</span></div>
      {state.stage === 1 && <>
        <div className="m2-heading"><p className="eyebrow">A REAL STUDENT TRIED THE APP</p><h1>What should we build next?</h1><p>StudySpot already works. A student found one thing that got in the way.</p></div>
        <section className="m4-context-card"><span className="eyebrow">THE APP TODAY</span><h2>{definition.product.name}</h2><p>{definition.product.description}</p><div className="m4-context-row"><strong>{definition.product.sessions[0].name}</strong><span>{definition.product.sessions[0].seats} seats open</span></div></section>
        <section className="m4-report"><span className="eyebrow">LAST BUILDER REPORT</span><p>“{definition.product.previousReport}”</p></section>
        <blockquote className="m4-user-note"><span className="eyebrow">A STUDENT SAID</span><p>“{definition.product.userNote}”</p></blockquote>
        <Continue onClick={() => dispatch({ type: "ADVANCE" })}>Think about what matters</Continue>
      </>}
      {state.stage === 2 && <>
        <div className="m2-heading"><p className="eyebrow">A QUICK THINKING CHAT</p><h1>What should we focus on?</h1><p>Ask about what the student experienced, or take another direction.</p></div>
        <div className="m4-chat"><span className="m4-chat-mark">YOU</span><p>{definition.product.userNote}</p></div>
        <div className="m2-choice-list">{definition.planningChoices.map((option) => <Choice key={option.id} selected={state.planning === option.id} onClick={() => dispatch({ type: "PLAN", id: option.id })}>{option.label}</Choice>)}</div>
        {state.planning && <div className="m4-answer"><strong>Thinking assistant</strong><p>{definition.planningReplies[state.planning]}</p></div>}
        <Continue disabled={!state.planning} onClick={() => dispatch({ type: "ADVANCE" })}>Choose the Builder’s goal</Continue>
      </>}
      {state.stage === 3 && <>
        <div className="m2-heading"><p className="eyebrow">HAND A GOAL TO THE BUILDER</p><h1>What should become possible?</h1><p>Choose a goal. The Builder will decide how to make it happen.</p></div>
        <div className="m2-choice-list">{definition.goals.map((option) => <Choice key={option.id} selected={state.goal === option.id} onClick={() => dispatch({ type: "GOAL", id: option.id })}>{option.label}</Choice>)}</div>
        {state.goal && <div className="m4-goal-note"><strong>Your goal</strong><p>{definition.goals.find((item) => item.id === state.goal)?.kind === "focused" ? "A student can leave a mistaken signup, the seat count stays right, and joining keeps working." : definition.goals.find((item) => item.id === state.goal)?.kind === "vague" ? "The Builder will have to guess what “better” means." : definition.goals.find((item) => item.id === state.goal)?.kind === "broad" ? "Several unrelated changes may take attention from the student’s problem." : "A screen detail was chosen, but the seat-count problem wasn’t mentioned."}</p></div>}
        <Continue disabled={!state.goal} onClick={() => dispatch({ type: "ADVANCE" })}>Build version 2</Continue>
      </>}
      {state.stage === 4 && <>
        <div className="m2-heading"><p className="eyebrow">BUILDER REPORT · VERSION 2</p><h1>The Builder says it’s ready.</h1><p>“{report}”</p></div>
        <div className="m4-build-report"><span className="m4-agent-dot"/><div><strong>Builder · Finished</strong><p>{state.goal === "focused" ? "Changed: leave a session and return its seat." : state.goal === "broad" ? "Changed: added leave, chat, profiles, ratings, and reminders." : state.goal === "micromanaged" ? "Changed: added a small leave shortcut." : "Changed: tidied signup labels."}</p><span>Joining a session still works.</span></div></div>
        <div className="m4-preview-grid"><ProductPreview state={state}/><TaskStep state={state}/></div>
        {!state.firstObserved && <Continue disabled={!state.joined || !state.left} onClick={() => dispatch({ type: "OBSERVE" })}>Tell the Builder what you noticed</Continue>}
        {state.firstObserved && <div className="m4-observed"><strong>{buildMission4V2(state.goal || "vague").restoresSeat ? "The student’s task worked." : "You found a problem the report did not prove."}</strong><p>{buildMission4V2(state.goal || "vague").restoresSeat ? "You can choose whether to make another change or keep this version." : buildMission4V2(state.goal || "vague").canLeave ? "Leaving worked, but the seat count stayed at 3." : "The student remained signed up because there was no way to leave."}</p><button className="button button-primary" type="button" onClick={() => dispatch({ type: "ADVANCE" })}>Choose one follow-up <span aria-hidden="true">→</span></button></div>}
      </>}
      {state.stage === 5 && <>
        <div className="m2-heading"><p className="eyebrow">FOCUSED FEEDBACK</p><h1>{mission4TaskPassed(state) ? "The student’s task worked." : "What will you tell the Builder?"}</h1><p>{mission4TaskPassed(state) ? "You can stop here, or ask for another change." : "Use what you just saw. Keep working parts working."}</p></div>
        <div className="m4-observation-note"><span className="eyebrow">WHAT HAPPENED</span><p>{buildMission4V2(state.goal || "vague").canLeave ? "I left Algebra, but its open-seat count stayed at 3." : "I joined Algebra, but I couldn’t find a way to leave."}</p></div>
        <div className="m2-choice-list">{definition.followUps.map((option) => <Choice key={option.id} selected={state.followUp === option.id} onClick={() => dispatch({ type: "FOLLOW_UP", id: option.id })}>{option.label}</Choice>)}</div>
        <Continue disabled={!state.followUp} onClick={() => dispatch({ type: "BUILD" })}>Send one follow-up</Continue>
        {mission4TaskPassed(state) && <button className="m4-skip-follow-up" type="button" onClick={() => dispatch({ type: "SKIP_FOLLOW_UP" })}>No change needed — choose whether to share</button>}
      </>}
      {state.stage === 6 && <>
        <div className="m2-heading"><p className="eyebrow">FOLLOW-UP BUILD · TRY IT AGAIN</p><h1>The Builder made an update.</h1><p>{state.followUp === "focused" ? "The seat count now returns when a student leaves. Joining still works." : state.followUp === "unrelated" ? "Chat was added. The signup problem is unchanged." : state.followUp === "restart" ? "The whole app was redesigned; the signup problem may still be there." : "Signup was tidied again. The original problem may still be there."}</p></div>
        <div className="m4-build-report"><span className="m4-agent-dot"/><div><strong>Builder · Follow-up complete</strong><p>{state.followUp === "focused" ? "Changed: return one seat when a student leaves." : state.followUp === "unrelated" ? "Changed: added student chat." : state.followUp === "restart" ? "Changed: redesigned StudySpot screens." : "Changed: made signup look clearer."}</p><span>The existing join action is still available.</span></div></div>
        <div className="m4-preview-grid"><ProductPreview state={state} retest/><TaskStep state={state} retest/></div>
        <Continue disabled={!state.retestJoined || !state.retestLeft} onClick={() => dispatch({ type: "ADVANCE" })}>Decide what to do next</Continue>
      </>}
      {state.stage === 7 && <>
        <div className="m2-heading"><p className="eyebrow">YOUR TEST RESULT</p><h1>Would you share this version?</h1><p>{mission4Summary(state).retest}</p></div>
        <div className={`m4-decision-card${mission4TaskPassed(state, true) ? " is-ready" : " is-not-ready"}`}><strong>{mission4TaskPassed(state, true) ? "The student can join, leave, and see the right seat count." : "The student’s signup still needs work."}</strong><span>{mission4TaskPassed(state, true) ? "The task worked when you tried it." : "Your repeated task showed where it still falls short."}</span></div>
        <div className="m4-decision-options"><button className={`m4-decision${state.finalChoice === "ship" ? " selected" : ""}`} type="button" aria-pressed={state.finalChoice === "ship"} onClick={() => dispatch({ type: "FINAL", choice: "ship" })}><strong>Share it</strong><span>Let students use the version you tried.</span></button><button className={`m4-decision${state.finalChoice === "improve" ? " selected" : ""}`} type="button" aria-pressed={state.finalChoice === "improve"} onClick={() => dispatch({ type: "FINAL", choice: "improve" })}><strong>Keep improving</strong><span>Make another change before sharing.</span></button></div>
      </>}
      {state.stage === 8 && <>
        <div className="m2-heading"><p className="eyebrow">MISSION COMPLETE · ATTEMPT {attempt}</p><h1>{mission4TaskPassed(state, true) ? "You checked a version that works." : "You found what still needs work."}</h1><p>Your choices shaped the build, and your test shaped the final call.</p></div>
        <section className="m3-summary m4-summary"><span className="eyebrow">BUILDER SUMMARY</span>{[["THINKING CHAT", summary.planningResult], ["NEXT GOAL", summary.goal], ["FIRST TRY", summary.firstTry], ["FOLLOW-UP", summary.followUp], ["REPEAT TEST", summary.retest], ["YOUR DECISION", summary.decision]].map(([label, value]) => <div className="m3-summary-item" key={label}><span>{label}</span><p>{value}</p></div>)}<div className="m3-summary-lessons"><strong>What your choices show</strong>{summary.lessons.map((lesson) => <p key={lesson}>{lesson}</p>)}</div></section>
        <section className="m2-skill-results"><h2>Builder skills</h2>{mission4Scores(state).map((skill) => <div key={skill.name}><div><strong>{skill.name}</strong><span>{skillLabel(skill.score)}</span></div><div className="skill-track"><span style={{ width: `${skill.score}%` }} /></div><p>{skill.explanation}</p></div>)}</section>
        {progress.attempts.length > 0 && <details className="m4-history"><summary>Previous attempts ({progress.attempts.length})</summary>{progress.attempts.map((item) => <p key={item.number}>Attempt {item.number}: {item.summary.decision} · {item.skills.length} skills recorded.</p>)}</details>}
        <div className="m2-continue"><span>Saved on this device</span><button className="button button-primary" type="button" onClick={() => dispatch({ type: "RETURN" })}>Return to Missions</button><button className="button button-quiet" type="button" onClick={() => dispatch({ type: "START" })}>Replay Mission</button></div>
      </>}
    </main>
  </div>;
}
