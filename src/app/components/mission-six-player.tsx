"use client";

import { dispatchMission6 } from "@/lib/store";
import { mission6Build, mission6Definition, mission6NearbyPassed, mission6RetestPassed, mission6Scores, mission6Summary, type Mission6Progress, type Mission6State } from "@/lib/missions/build-it-for-real";
import { skillLabel } from "@/lib/learner";

function Continue({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
  return <div className="continue-row"><span className="continue-hint">{disabled ? "Try the app first" : "Your progress is saved as you go"}</span><button className="button button-primary" disabled={disabled} onClick={onClick} type="button">{children}<span aria-hidden="true">→</span></button></div>;
}

function SelectCard({ selected, title, children, onClick }: { selected: boolean; title: string; children: string; onClick: () => void }) {
  return <button type="button" className={`m5-choice${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onClick}><strong>{title}</strong><span>{children}</span></button>;
}

function Shifts({ state, area }: { state: Mission6State; area: "first" | "retest" | "nearby" }) {
  const build = mission6Build(state);
  const signup = area === "first" ? state.firstSignup : area === "retest" ? state.retestSignup : state.nearbyFirst;
  const overlapTried = area === "first" ? state.overlapTried : state.retestOverlapTried;
  const join = () => dispatchMission6({ type: "SIGNUP", area });
  const tryOverlap = () => dispatchMission6({ type: "OVERLAP", area: area === "nearby" ? "first" : area });
  const secondResult = overlapTried ? build.overlap ? "You already have a shift then. This signup was stopped." : "Signup saved. You now have two shifts at the same time." : "Choose this shift after the welcome-table shift.";
  return <section className="m5-product m6-product" aria-label="Campus Crew app preview">
    <div className="m5-product-head"><div><span className="eyebrow">{area === "first" ? "LIVE APP · TRY IT" : area === "retest" ? "UPDATED APP · TRY THE SAME STEPS" : "ANOTHER CHECK · TRY THE SPACE LIMIT"}</span><h2>Campus Crew</h2></div><span className="m5-app-badge">APP</span></div>
    <p>Saturday campus fair · volunteer jobs</p>
    <article className="m5-club-card"><div className="m5-club-heading"><div><strong>Welcome table</strong><span>1–2 PM · 2 spaces</span></div><span className="m5-seats">{signup ? "1" : "2"}<br/>open</span></div>
      {build.signup ? <button className="button button-primary" type="button" onClick={join} disabled={signup}>{signup ? "✓ Jordan is signed up" : "Sign up Jordan"}</button> : <p className="m6-result is-problem">This version does not have volunteer signup yet.</p>}
      {signup && <p className={`m5-result${build.confirmed ? " is-good" : " is-problem"}`} role="status">{build.confirmed ? "Signup saved. Jordan is on the list." : "The button changed, but there is no clear confirmation."}</p>}
    </article>
    {area !== "nearby" && <article className="m5-club-card"><div className="m5-club-heading"><div><strong>Info booth</strong><span>1:30–2:30 PM · 1 space</span></div><span className="m5-seats">1<br/>open</span></div>
      <button className="m5-leave" type="button" disabled={!signup || overlapTried} onClick={tryOverlap}>Try this overlapping shift</button>
      {overlapTried && <p className={`m5-result${build.overlap ? " is-good" : " is-problem"}`} role="status">{secondResult}</p>}
    </article>}
    {build.extras > 0 && <div className="m5-my-clubs"><strong>More tools</strong><p>{build.extras >= 3 ? "Profiles, announcements, and extra settings make the signup page harder to scan." : "Extra settings are taking space beside the open jobs."}</p></div>}
    {area === "nearby" && <article className="m5-club-card"><div className="m5-club-heading"><div><strong>Welcome table · one space left</strong><span>Jordan and one volunteer are signed up</span></div><span className="m5-seats">1<br/>open</span></div><button className="m5-leave" type="button" disabled={!signup || state.nearbyOverbookTried} onClick={() => dispatchMission6({ type: "OVERBOOK" })}>Try one more signup</button>{state.nearbyOverbookTried && <p className={`m5-result${mission6NearbyPassed(state) ? " is-good" : " is-problem"}`} role="status">{mission6NearbyPassed(state) ? "The job is full. This signup was stopped." : "A third person was added even though no spaces remained."}</p>}</article>}
  </section>;
}

function Header({ state }: { state: Mission6State }) {
  const current = Math.min(Math.max(state.stage - 1, 0), 9);
  return <header className="m2-topbar m5-topbar m6-topbar"><div className="brand">build<span>loop</span><i /></div><div className="m2-top-title">Mission 6 <span>·</span> {mission6Definition.title}</div><span className="m2-save"><i/> Saved</span><nav className="m5-progress" aria-label="Mission progress">{mission6Definition.steps.map((label, index) => <span key={label} className={index < current || state.stage === 11 ? "is-done" : index === current ? "is-current" : ""}><i>{index < current || state.stage === 11 ? "✓" : index + 1}</i><small>{label}</small></span>)}</nav></header>;
}

export function MissionSixPlayer({ state, progress, courseSkills, onStartStudio }: { state: Mission6State; progress: Mission6Progress; courseSkills: { name: string; score: number }[]; onStartStudio: () => void }) {
  const dispatch = dispatchMission6;
  const build = mission6Build(state);
  const retest = mission6RetestPassed(state);
  const nearby = mission6NearbyPassed(state);
  const summary = mission6Summary(state);
  const attempt = progress.attempts.length + 1;
  const strongest = [...courseSkills].sort((a, b) => b.score - a.score).slice(0, 3);
  const practice = [...courseSkills].filter((skill) => skill.score < 80).sort((a, b) => a.score - b.score).slice(0, 3);
  return <div className="m2-shell m5-shell m6-shell" data-mission="6">
    <Header state={state}/>
    <main className="m2-main m5-main">
      <div className="m2-stage-meta"><span>MISSION 6 · THE FULL PROJECT</span><span>{state.stage === 11 ? "COMPLETE" : `STEP ${String(Math.min(state.stage, 10)).padStart(2, "0")} / 10`}</span></div>
      {state.stage === 1 && <>
        <div className="m2-heading"><p className="eyebrow">THE EVENT</p><h1>A campus fair is coming up.</h1><p>Lee is organizing it with a small student team. They need help with volunteer shifts.</p></div>
        <section className="m5-story-card"><span className="eyebrow">LEE · EVENT ORGANIZER</span><p>“We use messages and a shared spreadsheet. People sometimes think they signed up when they haven’t, and some jobs are left empty. Could you help us?”</p></section>
        <div className="m6-question-grid">{mission6Definition.questions.map((item) => <button key={item.id} className={`m5-choice${state.questionsAsked.includes(item.id) ? " is-selected" : ""}`} type="button" aria-pressed={state.questionsAsked.includes(item.id)} onClick={() => dispatch({ type: "ASK", id: item.id })}><strong>{item.label}</strong>{state.questionsAsked.includes(item.id) && <span>{item.fact}</span>}</button>)}</div>
        <Continue onClick={() => dispatch({ type: "ADVANCE" })}>Choose a first version</Continue>
      </>}
      {state.stage === 2 && <>
        <div className="m2-heading"><p className="eyebrow">VERSION 1</p><h1>What should it help people do?</h1><p>Pick the parts you want in the first version. You can leave some ideas for later.</p></div>
        <div className="m6-feature-grid">{mission6Definition.features.map((item) => <button key={item.id} className={`m5-choice${state.selectedFeatures.includes(item.id) ? " is-selected" : ""}`} type="button" aria-pressed={state.selectedFeatures.includes(item.id)} onClick={() => dispatch({ type: "FEATURE", id: item.id })}><strong>{item.label}</strong><span>{item.core ? "For the volunteer signup or event-day work" : "A later idea"}</span></button>)}</div>
        <Continue disabled={!state.selectedFeatures.length} onClick={() => dispatch({ type: "ADVANCE" })}>Brief the Builder</Continue>
      </>}
      {state.stage === 3 && <>
        <div className="m2-heading"><p className="eyebrow">TELL THE BUILDER</p><h1>What should happen?</h1><p>Choose the instruction you would send with your version-one plan.</p></div>
        <div className="m2-choice-list">{mission6Definition.briefs.map((item) => <SelectCard key={item.id} selected={state.brief === item.id} title={item.kind === "focused" ? "Give a clear outcome" : item.kind === "list" ? "Send the whole feature list" : item.kind === "technical" ? "Describe how to build it" : "Keep it very short"} onClick={() => dispatch({ type: "BRIEF", id: item.id })}>{item.label}</SelectCard>)}</div>
        {state.brief && <div className="m5-observation"><span className="eyebrow">YOUR INSTRUCTION</span><p>{mission6Definition.briefs.find((item) => item.id === state.brief)?.label}</p></div>}
        <Continue disabled={!state.brief} onClick={() => dispatch({ type: "ADVANCE" })}>Build version 1</Continue>
      </>}
      {state.stage === 4 && <>
        <div className="m2-heading"><p className="eyebrow">VERSION 1 · TRY THE VOLUNTEER TASK</p><h1>Jordan wants the 1 PM welcome-table shift.</h1><p>Sign Jordan up, then see what happens when they try another shift at the same time.</p></div>
        <div className="m5-app-layout"><Shifts state={state} area="first"/><aside className="m5-task"><span className="eyebrow">JORDAN’S TASK</span><strong>Sign up for one shift, then try the overlap.</strong><ol><li>Sign Jordan up for the welcome table</li><li>Try the info booth shift</li><li>Look for a saved message and overlap warning</li></ol><p>{!state.firstSignup ? "Try the first signup in the app." : !state.overlapTried ? "Now try the info booth shift." : build.overlap ? "Jordan has one shift. The second signup was stopped." : "Jordan now has two shifts at the same time."}</p></aside></div>
        {build.coverage && <div className="m5-observation"><strong>Organizer view</strong><p>Jobs with no volunteers: First aid · Cleanup</p></div>}
        <Continue disabled={!state.firstSignup || !state.overlapTried} onClick={() => dispatch({ type: "ADVANCE" })}>Read what people said</Continue>
      </>}
      {state.stage === 5 && <>
        <div className="m2-heading"><p className="eyebrow">AFTER VERSION 1</p><h1>Two people tried the app.</h1><p>Choose the comments that should guide your next change.</p></div>
        <div className="m6-feedback-list">{mission6Definition.feedback.map((item) => <button key={item.id} className={`m5-choice${state.feedbackChoices.includes(item.id) ? " is-selected" : ""}`} type="button" aria-pressed={state.feedbackChoices.includes(item.id)} onClick={() => dispatch({ type: "FEEDBACK", id: item.id })}><span className="eyebrow">{item.from}</span><strong>{item.label}</strong><span>{item.kind === "problem" ? "What they saw" : item.kind === "useful" ? "A helpful idea" : item.kind === "suggestion" ? "A possible way to build it" : "A new feature idea"}</span></button>)}</div>
        <Continue disabled={!state.feedbackChoices.length} onClick={() => dispatch({ type: "ADVANCE" })}>Set the next goal</Continue>
      </>}
      {state.stage === 6 && <>
        <div className="m2-heading"><p className="eyebrow">VERSION 2 · SET A GOAL</p><h1>What should the Builder work on?</h1><p>Use what you saw and heard to choose one next step.</p></div>
        <div className="m2-choice-list">{mission6Definition.goals.map((item) => <SelectCard key={item.id} selected={state.goal === item.id} title={item.kind === "focused" ? "Fix the shift conflict" : item.kind === "broad" ? "Change lots of things" : item.kind === "guess" ? "Hide times that overlap" : "Make signup better"} onClick={() => dispatch({ type: "GOAL", id: item.id })}>{item.label}</SelectCard>)}</div>
        <Continue disabled={!state.goal} onClick={() => dispatch({ type: "ADVANCE" })}>Build version 2</Continue>
      </>}
      {state.stage === 7 && <>
        <div className="m2-heading"><p className="eyebrow">BUILDER · VERSION 2</p><h1>The Builder made an update.</h1><p>{state.goal === "focused" ? "The shift check is clearer, and the space limit stayed the same." : state.goal === "guess" ? "Overlapping times are hidden. The update also changed how full shifts are counted." : state.goal === "broad" ? "Several screens and settings changed. Check the signup behavior closely." : "The signup page changed a little, but the Builder had to guess what better meant."}</p></div>
        <div className="m5-build-report"><i/><div><strong>Changed for version 2</strong><p>{state.goal === "focused" ? "Jordan cannot take two shifts at the same time." : state.goal === "guess" ? "A time that overlaps is hidden; the space count may no longer stop at full." : state.goal === "broad" ? "New settings were added alongside a few signup changes." : "The signup label and page spacing changed."}</p><span>The Builder’s report does not prove the app works.</span></div></div>
        <Continue onClick={() => dispatch({ type: "BUILD" })}>Try version 2</Continue>
      </>}
      {state.stage === 8 && <>
        <div className="m2-heading"><p className="eyebrow">VERSION {state.buildCount + 1} · TRY THE SAME STEPS</p><h1>Can Jordan still take two shifts at once?</h1><p>Repeat the signup and overlap check. If the first change missed, you can send a clearer follow-up.</p></div>
        <div className="m5-app-layout"><Shifts state={state} area="retest"/><aside className="m5-task"><span className="eyebrow">REPEAT JORDAN’S TASK</span><strong>Try the welcome table and info booth.</strong><ol><li>Sign Jordan up for the welcome table</li><li>Try the info booth shift</li><li>Check the message and both shift times</li></ol><p>{!state.retestSignup ? "Begin with the welcome-table signup." : !state.retestOverlapTried ? "Now try the overlapping time." : retest ? "The second signup was stopped." : "Jordan still has overlapping shifts."}</p></aside></div>
        {state.retestOverlapTried && !retest && <section className="m5-followup"><div><span className="eyebrow">THE CHANGE DID NOT FIX IT</span><p>Tell the Builder what happened and what you expected.</p></div><SelectCard selected={state.followUp === "evidence"} title="Describe the result" onClick={() => dispatch({ type: "FOLLOW_UP", id: "evidence" })}>Jordan signed up for 1–2 PM and 1:30–2:30 PM. Stop the second signup and keep the space count right.</SelectCard><SelectCard selected={state.followUp === "vague"} title="Ask again without details" onClick={() => dispatch({ type: "FOLLOW_UP", id: "vague" })}>Please improve the signup flow.</SelectCard>{state.followUp && <button className="button button-primary" type="button" onClick={() => dispatch({ type: "BUILD" })}>Send follow-up and rebuild <span aria-hidden="true">→</span></button>}</section>}
        {retest && <Continue onClick={() => dispatch({ type: "ADVANCE" })}>Check one more thing</Continue>}
      </>}
      {state.stage === 9 && <>
        <div className="m2-heading"><p className="eyebrow">ONE MORE TASK</p><h1>Does a full shift stay full?</h1><p>Jordan and one volunteer have taken the two welcome-table spaces. Try one more signup.</p></div>
        <div className="m5-app-layout"><Shifts state={state} area="nearby"/><aside className="m5-task"><span className="eyebrow">LEE’S TASK</span><strong>Keep a job from taking too many volunteers.</strong><ol><li>Check the one remaining space</li><li>Try one more signup</li><li>See if the full job stops it</li></ol><p>{!state.nearbyFirst ? "Open the full-shift check in the app." : !state.nearbyOverbookTried ? "Try one more signup." : nearby ? "The extra signup was stopped." : "The full shift accepted another volunteer."}</p></aside></div>
        <Continue disabled={!state.nearbyFirst || !state.nearbyOverbookTried} onClick={() => dispatch({ type: "ADVANCE" })}>Decide what ships</Continue>
      </>}
      {state.stage === 10 && <>
        <div className="m2-heading"><p className="eyebrow">YOUR CHECKS · ATTEMPT {attempt}</p><h1>Is this version ready to share?</h1><p>{summary.retest} {summary.nearby}</p></div>
        <div className={`m5-decision-card${retest && nearby ? " is-ready" : " is-not-ready"}`}><strong>{retest && nearby ? "Both event-day tasks worked." : "At least one important check still needs work."}</strong><span>Choose what you would do next.</span></div>
        <div className="m6-decision-options">{([ ["share", "Share it", "Let volunteers try this version."], ["improve", "Make one more focused change", "Hold the version and work on what failed."], ["features", "Add more features", "Build another request first."], ["rebuild", "Start over", "Throw away this version and rebuild."] ] as const).map(([id, title, detail]) => <button key={id} className={`m5-decision${state.finalChoice === id ? " is-selected" : ""}`} aria-pressed={state.finalChoice === id} disabled={Boolean(state.finalChoice)} type="button" onClick={() => dispatch({ type: "DECIDE", choice: id })}><strong>{title}</strong><span>{detail}</span></button>)}</div>
      </>}
      {state.stage === 11 && <>
        <div className="m2-heading"><p className="eyebrow">MISSION COMPLETE · ATTEMPT {progress.attempts.length}</p><h1>{state.finalChoice === "share" && retest && nearby ? "You checked it before sharing." : state.finalChoice === "share" ? "You chose to share this version." : "You carried the project through."}</h1><p>You followed a problem from the people who have it, through a build and real tasks, to a decision about what happens next.</p></div>
        <section className="m5-story-card m6-course-card"><span className="eyebrow">ALL SIX MISSIONS COMPLETE</span><p>Ask people what they need. Choose a first version. Tell the Builder what should happen. Try it, learn from what happened, and decide what is ready.</p><div className="m6-course-skills"><strong>Skills you practiced across the course</strong><div>{courseSkills.map((skill) => <span key={skill.name}>{skill.name} · {skill.score}</span>)}</div><p><strong>Strongest so far:</strong> {strongest.map((skill) => skill.name).join(", ")}. <strong>Worth practicing:</strong> {practice.length ? practice.map((skill) => skill.name).join(", ") : "any skill you want to strengthen"}.</p></div></section>
        <section className="m3-summary m5-summary"><span className="eyebrow">BUILDER SUMMARY</span>{[["UNDERSTANDING", summary.investigation], ["VERSION 1", summary.version], ["YOUR INSTRUCTION", summary.instruction], ["FIRST TRY", summary.firstTry], ["FEEDBACK", summary.feedback.join(" · ") || "No comments selected"], ["NEXT GOAL", summary.goal], ["BUILDER FOLLOW-UP", summary.followUp], ["BUILDER UPDATE", summary.builder], ["REPEAT THE TASK", summary.retest], ["NEARBY TASK", summary.nearby], ["YOUR DECISION", summary.decision]].map(([label, value]) => <div className="m3-summary-item" key={label}><span>{label}</span><p>{value}</p></div>)}</section>
        <section className="m2-skill-results"><h2>Builder skills</h2>{mission6Scores(state).map((skill) => { const best = progress.bestSkillResults.find((item) => item.name === skill.name)?.score ?? skill.score; return <div key={skill.name}><div><strong>{skill.name}</strong><span>Latest {skill.score}/100 · Best {best}/100 · {skillLabel(skill.score)}</span></div><div className="skill-track"><span style={{ width: `${skill.score}%` }}/></div><p>{skill.explanation}</p></div>; })}</section>
        {progress.attempts.length > 1 && <details className="m4-history"><summary>Previous Mission 6 attempts ({progress.attempts.length - 1})</summary>{progress.attempts.slice(0, -1).map((item) => <p key={item.number}>Attempt {item.number}: {item.summary.decision}</p>)}</details>}
        <div className="m6-studio-finish"><span className="eyebrow">YOUR NEXT STEP</span><h2>You practiced the workflow. Now use it on something you care about.</h2><button className="button button-primary" type="button" onClick={onStartStudio}>Start your own project →</button></div>
        <div className="m2-continue"><span>Saved on this device</span><button className="button button-quiet" type="button" onClick={() => dispatch({ type: "RETURN" })}>Return to Missions</button><button className="button button-quiet" type="button" onClick={() => dispatch({ type: "START" })}>Replay Mission 6</button></div>
      </>}
    </main>
  </div>;
}
