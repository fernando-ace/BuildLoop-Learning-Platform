"use client";

import { dispatchMission5 } from "@/lib/store";
import {
  mission5Build,
  mission5Definition,
  mission5NearbyPassed,
  mission5RetestPassed,
  mission5Scores,
  mission5Summary,
  type Mission5Progress,
  type Mission5State,
} from "@/lib/missions/something-broken";
import { skillLabel } from "@/lib/learner";

function Continue({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
  return <div className="continue-row"><span className="continue-hint">{disabled ? "Try the app first" : "Your progress is saved as you go"}</span><button className="button button-primary" disabled={disabled} onClick={onClick} type="button">{children}<span aria-hidden="true">→</span></button></div>;
}

function ClubBoard({ state, area }: { state: Mission5State; area: "first" | "retest" | "nearby" }) {
  const build = mission5Build(state);
  const isFirst = area === "first";
  const isRetest = area === "retest";
  const club = area === "nearby" ? mission5Definition.product.clubs[1] : mission5Definition.product.clubs[0];
  const joined = isFirst ? state.firstJoined : isRetest ? state.retestJoined : state.nearbyJoined;
  const left = isFirst ? state.firstLeft : isRetest ? state.retestLeft : state.nearbyLeft;
  const behaviorWorks = isFirst || isRetest ? build.artMembership && build.artSeat : build.nearbyWorks;
  const seats = isFirst
    ? left ? club.seats : joined ? club.seats - 1 : club.seats
    : left ? club.seats + (behaviorWorks ? 0 : -1) : joined ? club.seats - 1 : club.seats;
  const stillListed = left && (isFirst || !build.artMembership);
  const join = () => isFirst ? dispatchMission5({ type: "JOIN_FIRST" }) : isRetest ? dispatchMission5({ type: "JOIN_RETEST" }) : dispatchMission5({ type: "JOIN_NEARBY" });
  const leave = () => isFirst ? dispatchMission5({ type: "LEAVE_FIRST" }) : isRetest ? dispatchMission5({ type: "LEAVE_RETEST" }) : dispatchMission5({ type: "LEAVE_NEARBY" });
  return <section className="m5-product" aria-label={`${mission5Definition.product.name} app preview`}>
    <div className="m5-product-head"><div><span className="eyebrow">{isFirst ? "LIVE APP · TRY IT" : isRetest ? state.secondBuild ? "VERSION 2 · TRY THE SAME STEPS" : "UPDATED APP · TRY THE SAME STEPS" : "ANOTHER CLUB · CHECK IT TOO"}</span><h2>{mission5Definition.product.name}</h2></div><span className="m5-app-badge">APP</span></div>
    <p>Upcoming club meetings</p>
    <article className="m5-club-card"><div className="m5-club-heading"><div><strong>{club.name}</strong><span>{club.meeting}</span></div><span className="m5-seats">{seats}<br/>seats open</span></div>
      {!joined && !left && <button className="button button-primary" type="button" onClick={join}>Join {club.name}</button>}
      {joined && !left && <div className="m5-joined-row"><span>✓ Joined {club.name}</span><button className="m5-leave" type="button" onClick={leave}>Leave</button></div>}
      {left && <p className={`m5-result${stillListed || !behaviorWorks ? " is-problem" : " is-good"}`} role="status">{stillListed ? `${club.name} still appears in My Clubs.` : !behaviorWorks ? "The seat count did not update." : `${club.name} is no longer in My Clubs. The seat is open again.`}</p>}
    </article>
    <div className="m5-my-clubs"><strong>My Clubs</strong>{joined && !left || stillListed ? <span>{club.name} <small>· {club.meeting}</small></span> : <p>No clubs here yet. Join a club to see it listed.</p>}</div>
    {!isFirst && <article className="m5-club-card m5-other-club"><div className="m5-club-heading"><div><strong>{area === "nearby" ? "Art Club" : "Robotics Club"}</strong><span>{area === "nearby" ? "Thursday · 3:30 PM" : "Friday · 3:45 PM"}</span></div><span className="m5-seats">{area === "nearby" ? "2" : "1"}<br/>seats open</span></div><button className="m5-disabled" disabled type="button">Join another club</button></article>}
  </section>;
}

function MissionHeader({ state }: { state: Mission5State }) {
  const current = state.stage === 8 ? 5 : state.stage === 7 ? 4 : state.stage === 4 || state.stage === 5 || state.stage === 6 ? 3 : state.stage === 3 ? 2 : state.stage === 2 ? 1 : 0;
  return <header className="m2-topbar m5-topbar"><div className="brand">build<span>loop</span><i /></div><div className="m2-top-title">Mission 5 <span>·</span> Something’s Broken</div><span className="m2-save"><i/> Saved</span><nav className="m5-progress" aria-label="Mission progress">{mission5Definition.steps.map((label, index) => <span key={label} className={index < current ? "is-done" : index === current && !state.finalChoice ? "is-current" : ""}><i>{index < current ? "✓" : index + 1}</i><small>{label}</small></span>)}</nav></header>;
}

export function MissionFivePlayer({ state, progress }: { state: Mission5State; progress: Mission5Progress }) {
  const dispatch = dispatchMission5;
  const attempt = progress.attempts.length + (state.stage === 1 ? 1 : 0);
  const retestPassed = mission5RetestPassed(state);
  const summary = mission5Summary(state);
  const selectReport = (id: "vague" | "assumption" | "evidence") => dispatch({ type: "SELECT_REPORT", id });
  return <div className="m2-shell m5-shell" data-mission="5">
    <MissionHeader state={state}/>
    <main className="m2-main m5-main">
      <div className="m2-stage-meta"><span>MISSION 5</span><span>{state.stage === 8 && state.finalChoice ? "COMPLETE" : `STEP ${String(Math.min(state.stage, 6)).padStart(2, "0")} / 06`}</span></div>
      {state.stage === 1 && <>
        <div className="m2-heading"><p className="eyebrow">MEET THE STUDENT</p><h1>ClubBoard is ready for a closer look.</h1><p>Sam uses this app to see club meetings and keep track of the clubs they joined.</p></div>
        <section className="m5-story-card"><span className="eyebrow">SAM · ART CLUB MEMBER</span><p>“The new Leave button is there. I’m not sure if it did what I expected. Can you try it?”</p></section>
        <section className="m5-context"><span className="eyebrow">THE BUILDER’S LAST UPDATE</span><p>{mission5Definition.product.report}</p><div><strong>{mission5Definition.product.clubs[0].name}</strong><span>Thursday · 3:30 PM · 2 seats open</span></div></section>
        <Continue onClick={() => dispatch({ type: "ADVANCE" })}>Try ClubBoard</Continue>
      </>}
      {state.stage === 2 && <>
        <div className="m2-heading"><p className="eyebrow">TRY THE APP · BEFORE YOU ASK FOR A FIX</p><h1>See what happens when you leave.</h1><p>Join Art Club, then leave it. Watch its seat count and check “My Clubs.”</p></div>
        <div className="m5-app-layout"><ClubBoard state={state} area="first"/><aside className="m5-task"><span className="eyebrow">SAM’S TASK</span><strong>Leave Art Club and check the result.</strong><ol><li>Join Art Club</li><li>Press Leave</li><li>Check the seat count and My Clubs</li></ol><p>{!state.firstJoined ? "Try joining Art Club in the app." : !state.firstLeft ? "Now press Leave and look at both parts of the app." : "The seat opened, but Art Club still appears under My Clubs."}</p></aside></div>
        <Continue disabled={!state.firstJoined || !state.firstLeft} onClick={() => dispatch({ type: "ADVANCE" })}>Tell the Builder what happened</Continue>
      </>}
      {state.stage === 3 && <>
        <div className="m2-heading"><p className="eyebrow">WHAT WILL YOU TELL THE BUILDER?</p><h1>Share what you saw.</h1><p>The Builder can investigate from your evidence. You don’t need to know which part of the app is wrong.</p></div>
        <div className="m5-observation"><span className="eyebrow">WHAT YOU TRIED</span><p>You joined Art Club, pressed Leave, and saw the seat open. Art Club still appeared in My Clubs.</p></div>
        <div className="m2-choice-list">{mission5Definition.reportChoices.map((choice) => <button type="button" key={choice.id} className={`m5-choice${state.report === choice.id ? " is-selected" : ""}`} aria-pressed={state.report === choice.id} onClick={() => selectReport(choice.id)}><strong>{choice.kind === "evidence" ? "Describe what happened" : choice.kind === "assumption" ? "Guess what caused it" : "Ask for a fix"}</strong><span>{choice.label}</span></button>)}</div>
        <Continue disabled={!state.report} onClick={() => dispatch({ type: "SEND_REPORT" })}>Build a repair</Continue>
      </>}
      {state.stage === 4 && <>
        <div className="m2-heading"><p className="eyebrow">BUILDER REPORT · TRY IT AGAIN</p><h1>The Builder made a change.</h1><p>{state.report === "evidence" ? "The Builder used your steps and expected result to update the My Clubs list." : state.report === "assumption" ? "The Builder changed how the leave action saves. Now check the app to see what that changed." : "The Builder adjusted the seat count. Now see if that fixed Sam’s problem."}</p></div>
        <div className="m5-build-report"><i/><div><strong>Builder · Update ready</strong><p>{state.report === "evidence" ? "Changed: leaving removes that club from My Clubs and returns its seat." : state.report === "assumption" ? "Changed: leaving hides the club, but the seat update was changed too." : "Changed: leaving returns the seat. The club list may still need attention."}</p><span>Try the same steps again to check the result.</span></div></div>
        <div className="m5-app-layout"><ClubBoard state={state} area="retest"/><aside className="m5-task"><span className="eyebrow">REPEAT THE SAME STEPS</span><strong>Check the original problem.</strong><ol><li>Join Art Club</li><li>Press Leave</li><li>Check My Clubs and the seat count</li></ol><p>{!state.retestJoined ? "Join Art Club to begin the check." : !state.retestLeft ? "Press Leave and look again." : retestPassed ? "The original problem is fixed. Now check another club." : stillText(state)}</p></aside></div>
        {state.retestLeft && !retestPassed && <section className="m5-followup"><div><span className="eyebrow">THE FIRST REPAIR MISSED SOMETHING</span><p>{state.report === "assumption" ? "The club left the list, but the seat count did not go back up." : "Art Club still appears in My Clubs after you left."} What will you tell the Builder?</p></div>{mission5Definition.followUps.map((item) => <button key={item.id} className={`m5-choice${state.followUp === item.id ? " is-selected" : ""}`} aria-pressed={state.followUp === item.id} type="button" onClick={() => dispatch({ type: "FOLLOW_UP", id: item.id })}><strong>{item.kind === "evidence" ? "Describe the new result" : "Ask again without details"}</strong><span>{item.label}</span></button>)}{state.followUp && <button className="button button-primary" type="button" onClick={() => dispatch({ type: "BUILD_AGAIN" })}>Send follow-up and rebuild <span aria-hidden="true">→</span></button>}</section>}
        {retestPassed && <Continue onClick={() => dispatch({ type: "ADVANCE" })}>Check another club</Continue>}
      </>}
      {state.stage === 5 && <>
        <div className="m2-heading"><p className="eyebrow">FOCUSED FOLLOW-UP</p><h1>You showed the Builder what still happened.</h1><p>{state.followUp === "evidence" ? "The Builder now has the exact result and can make another repair." : "The Builder will try again, but still has to guess what part needs to change."}</p></div>
        <div className="m5-build-report"><i/><div><strong>Builder · Second update ready</strong><p>{state.followUp === "evidence" ? "Changed: sync the club list and seat count when someone leaves." : "Changed: adjusted the club list again."}</p><span>Now repeat the original steps one more time.</span></div></div>
        <div className="m5-second-preview"><div><span className="eyebrow">UPDATED CLUBBOARD</span><strong>Art Club · 2 seats open</strong><span>Try join, then leave again.</span></div><button className="button button-primary" type="button" onClick={() => dispatch({ type: "BUILD_AGAIN" })}>Try the second update <span aria-hidden="true">→</span></button></div>
      </>}
      {state.stage === 6 && <>
        <div className="m2-heading"><p className="eyebrow">SECOND BUILD · REPEAT THE SAME STEPS</p><h1>Did the follow-up fix it?</h1><p>Run the same Art Club check again. The Builder’s report alone can’t prove it works.</p></div>
        <div className="m5-app-layout"><ClubBoard state={state} area="retest"/><aside className="m5-task"><span className="eyebrow">THE ORIGINAL CHECK</span><strong>Join and leave Art Club.</strong><ol><li>Join Art Club</li><li>Press Leave</li><li>Check the list and seat count</li></ol><p>{!state.retestJoined ? "Join Art Club to begin." : !state.retestLeft ? "Press Leave and look at both parts." : retestPassed ? "Both parts now look right." : "The original problem is still there. Keep that in mind when you decide."}</p></aside></div>
        <Continue disabled={!state.retestJoined || !state.retestLeft} onClick={() => dispatch({ type: "ADVANCE" })}>Check another club</Continue>
      </>}
      {state.stage === 7 && <>
        <div className="m2-heading"><p className="eyebrow">ONE MORE QUICK CHECK</p><h1>Make sure another club still works.</h1><p>A fix can help one screen and accidentally change another. Try the same action with Robotics Club.</p></div>
        <div className="m5-app-layout"><ClubBoard state={state} area="nearby"/><aside className="m5-task"><span className="eyebrow">CHECK A NEARBY ACTION</span><strong>Join and leave Robotics Club.</strong><ol><li>Join Robotics</li><li>Press Leave</li><li>Check its list and seat count</li></ol><p>{!state.nearbyJoined ? "Join Robotics Club to begin." : !state.nearbyLeft ? "Now leave it and check that the seat opens." : mission5NearbyPassed(state) ? "Robotics still works. The nearby check passed." : "Robotics Club’s seat count did not update."}</p></aside></div>
        <Continue disabled={!state.nearbyJoined || !state.nearbyLeft} onClick={() => dispatch({ type: "ADVANCE" })}>Choose what to do</Continue>
      </>}
      {state.stage === 8 && <>
        <div className="m2-heading"><p className="eyebrow">YOUR CHECKS · ATTEMPT {attempt || progress.attempts.length}</p><h1>Is this version ready to share?</h1><p>{summary.retest} {summary.nearby}</p></div>
        <div className={`m5-decision-card${retestPassed && mission5NearbyPassed(state) ? " is-ready" : " is-not-ready"}`}><strong>{retestPassed && mission5NearbyPassed(state) ? "The original task and another club both worked." : "At least one check still needs work."}</strong><span>Choose what matches the evidence from both checks.</span></div>
        <div className="m5-decision-options"><button className={`m5-decision${state.finalChoice === "share" ? " is-selected" : ""}`} aria-pressed={state.finalChoice === "share"} disabled={Boolean(state.finalChoice)} type="button" onClick={() => dispatch({ type: "DECIDE", choice: "share" })}><strong>Share this version</strong><span>Let students try the version you checked.</span></button><button className={`m5-decision${state.finalChoice === "change" ? " is-selected" : ""}`} aria-pressed={state.finalChoice === "change"} disabled={Boolean(state.finalChoice)} type="button" onClick={() => dispatch({ type: "DECIDE", choice: "change" })}><strong>Ask the Builder for another change</strong><span>Hold off so the Builder can update what you found.</span></button></div>
        {state.finalChoice && <div className="m5-completion"><span className="eyebrow">MISSION COMPLETE</span><h2>{retestPassed && mission5NearbyPassed(state) ? "You checked the repair before sharing." : "You found what still needs work."}</h2><p>The version and your skill results are saved on this device.</p>
          <section className="m3-summary m5-summary"><span className="eyebrow">BUILDER SUMMARY</span>{[["YOUR REPORT", summary.report], ["FIRST TRY", summary.firstTry], ["BUILDER’S REPAIR", summary.builder], ["ORIGINAL CHECK", summary.retest], ["FOLLOW-UP", summary.followUp], ["ANOTHER CLUB", summary.nearby], ["YOUR DECISION", summary.decision]].map(([label, value]) => <div className="m3-summary-item" key={label}><span>{label}</span><p>{value}</p></div>)}<div className="m3-summary-lessons"><strong>What your choices show</strong>{summary.lessons.map((lesson) => <p key={lesson}>{lesson}</p>)}</div></section>
          <section className="m2-skill-results"><h2>Builder skills</h2>{mission5Scores(state).map((skill) => { const best = progress.bestSkillResults.find((item) => item.name === skill.name)?.score ?? skill.score; return <div key={skill.name}><div><strong>{skill.name}</strong><span>Latest {skill.score}/100 · Best {best}/100 · {skillLabel(skill.score)}</span></div><div className="skill-track"><span style={{ width: `${skill.score}%` }}/></div><p>{skill.explanation}</p></div>; })}</section>
          {progress.attempts.length > 0 && <details className="m4-history"><summary>Previous attempts ({progress.attempts.length})</summary>{progress.attempts.map((item) => <p key={item.number}>Attempt {item.number}: {item.summary.decision} · {item.skills.length} skills recorded.</p>)}</details>}
          <div className="m2-continue"><span>Saved on this device</span><button className="button button-primary" type="button" onClick={() => dispatch({ type: "RETURN" })}>Return to Missions</button><button className="button button-quiet" type="button" onClick={() => dispatch({ type: "START" })}>Replay Mission</button></div>
        </div>}
      </>}
    </main>
  </div>;
}

function stillText(state: Mission5State) {
  const build = mission5Build(state);
  return build.artMembership ? "The club is out of My Clubs; check whether the seat count went back up." : "Art Club still appears in My Clubs.";
}
