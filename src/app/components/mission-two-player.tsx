"use client";

import { useState } from "react";
import { dispatchMission2 } from "@/lib/store";
import { makeFirstBrief, mission2Definition as definition, mission2Scores, mission2Summary, type BriefField, type Mission2Progress, type Mission2State } from "@/lib/missions/the-vague-request";

const fieldLabels: Record<BriefField, string> = { audience: "Who it is for", problem: "The problem", build: "What to build", features: "Important features", boundaries: "What can wait", success: "How to know it works" };
const eventList = definition.events;
const problemText: Record<string, string> = definition.issueText;

function Choice({ selected, onClick, children, disabled = false }: { selected: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button className={`m2-choice${selected ? " selected" : ""}`} onClick={onClick} type="button" aria-pressed={selected} disabled={disabled}>{children}<span>{selected ? "Selected" : "Choose"}</span></button>;
}
function Continue({ onClick, children, disabled = false }: { onClick: () => void; children: string; disabled?: boolean }) { return <div className="m2-continue"><span>{disabled ? "Try the task above before continuing" : "Your choices are saved as you go"}</span><button className="button button-primary" onClick={onClick} type="button" disabled={disabled}>{children}</button></div>; }
function BriefBuilder({ state }: { state: Mission2State }) {
  return <div className="m2-brief-preview"><div className="m2-window-bar"><i /><i /><i /><span>Your brief to the AI developer</span></div><p>{state.brief || "Your choices will appear here as a clear build request."}</p></div>;
}

export function MissionTwoPlayer({ state, progress, attemptCount }: { state: Mission2State; progress: Mission2Progress; attemptCount: number }) {
  const [signupName, setSignupName] = useState("Jordan");
  const [showAnswer, setShowAnswer] = useState("");
  const advance = (type: "BUILD" | "BUILD_V2" | "RETEST") => dispatchMission2({ type });
  const scores = state.stage === 10 ? mission2Scores(state) : progress.latestSkillResults;
  const summary = mission2Summary(state);
  const stageLabel = definition.steps[Math.min(state.stage - 1, definition.steps.length - 1)];
  const questionCount = state.questionsAsked.length;
  const setChoice = (field: BriefField, id: string) => dispatchMission2({ type: "BRIEF", field, id });
  return <div className="m2-shell" data-mission="2">
    <header className="m2-topbar"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); dispatchMission2({ type: "RETURN" }); }}>build<span>loop</span><i /></a><div><strong>Mission 2</strong><span> · The Vague Request</span></div><button className="text-button" type="button" onClick={() => dispatchMission2({ type: "RETURN" })}>Mission Hub</button></header>
    <div className="m2-progress" aria-label={`Step ${state.stage} of 10`}><span style={{ width: `${state.stage * 10}%` }} /></div>
    <main className="m2-main">
      <div className="m2-stage-meta"><span>MISSION 2</span><span>STEP {String(state.stage).padStart(2, "0")} / 10</span></div>
      {state.stage === 1 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Start with Maya’s request.</h1><p>She helps organize a campus volunteer club. Before suggesting a solution, find out what is making sign-ups hard.</p></div>
        <div className="m2-maya-card"><div className="m2-person"><span className="m2-avatar">M</span><div><strong>Maya</strong><span>Volunteer club organizer</span></div></div><blockquote>“We need something that makes signing up for volunteer events easier.”</blockquote><p>Event details are scattered through messages. People say they’re coming, then forget which event they chose. Organizers answer the same questions again and again.</p></div>
        <section className="m2-question-section"><div className="m2-section-title"><h2>What would you ask?</h2><span>Choose up to 4 · {questionCount}/4</span></div><div className="m2-choice-list">{definition.questions.map((question) => <div className="m2-question-wrap" key={question.id}><Choice selected={state.questionsAsked.includes(question.id)} disabled={!state.questionsAsked.includes(question.id) && questionCount >= 4} onClick={() => { if (state.questionsAsked.includes(question.id)) return; dispatchMission2({ type: "ASK", id: question.id }); setShowAnswer(question.id); }}>{question.text}</Choice>{(showAnswer === question.id || state.questionsAsked.includes(question.id)) && <div className="m2-answer"><strong>Maya says</strong><p>{question.answer}</p><span>{question.insight}</span></div>}</div>)}</div></section>
        {questionCount >= 2 && <Continue onClick={() => dispatchMission2({ type: "PREVIEW_BRIEF" })}>Build the first brief</Continue>}
        {questionCount < 2 && <p className="m2-hint">Ask at least two questions to hear what Maya needs.</p>}
      </>}
      {state.stage === 2 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Give the AI a clear goal.</h1><p>Choose who it helps, what they need, and what should wait. The AI turns your choices into a build request.</p></div>
        <div className="m2-builder-grid"><div className="m2-fields">{(["audience", "problem", "build", "features", "boundaries", "success"] as BriefField[]).map((field) => <section className="m2-field" key={field}><h2>{fieldLabels[field]}</h2><div className="m2-choice-list">{definition.options[field].map((option) => {
          const selected = field === "features" ? (state.briefChoices.features ?? []).includes(option.id) : state.briefChoices[field] === option.id;
          return <Choice key={option.id} selected={selected} onClick={() => setChoice(field, option.id)}>{option.label}</Choice>;
        })}</div></section>)}</div><aside className="m2-live-brief"><span className="eyebrow">LIVE BUILD REQUEST</span><BriefBuilder state={{ ...state, brief: makeFirstBrief(state.briefChoices, state.questionsAsked) }} /><p>Useful context from Maya</p>{state.questionsAsked.map((id) => <span className="m2-context-chip" key={id}>{definition.questions.find((q) => q.id === id)?.insight}</span>)}</aside></div>
        <Continue onClick={() => dispatchMission2({ type: "PREVIEW_BRIEF" })}>Review my brief</Continue>
      </>}
      {state.stage === 3 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Here’s what you’re asking for.</h1><p>Review the assembled brief before the AI developer starts.</p></div><BriefBuilder state={{ ...state, brief: makeFirstBrief(state.briefChoices, state.questionsAsked) }} /><Continue onClick={() => advance("BUILD")}>Build version 1</Continue>
      </>}
      {state.stage === 4 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Your AI developer built version 1.</h1><p>This preview is shaped by the details in your brief. Try Jordan’s task to see what works.</p></div>
        <div className="m2-preview-shell"><div className="m2-preview-title"><div><span className="m2-product-mark">V</span><div><strong>Volunteer Together</strong><span>Campus volunteer club</span></div></div><span className="m2-version">VERSION 1</span></div>
          {state.v1Issues.includes("complexity") && <div className="m2-extra-screen"><strong>Welcome back</strong><p>Create an account to continue</p><button type="button" disabled>Set up profile</button></div>}
          <h2>Upcoming events</h2><div className="m2-event-list">{eventList.map((event) => <article className={`m2-event-card${state.v1Issues.includes("details") ? " missing-details" : ""}${state.selectedEvent === event.id ? " is-selected" : ""}`} key={event.id}><div className="m2-event-date"><strong>{event.date.split(",")[0]}</strong><span>{event.date.split(", ")[1]}</span></div><div className="m2-event-info"><h3>{event.name}</h3>{state.v1Issues.includes("details") ? <span className="m2-missing">More details needed</span> : <><p>{event.description}</p><span>{event.date} · {event.time}</span><span>{event.place}</span></>}</div><button type="button" className="button button-primary" onClick={() => dispatchMission2({ type: "SELECT_EVENT", event: event.id })}>{state.selectedEvent === event.id ? "Selected" : state.v1Issues.includes("signup") ? "View event" : "Details"}</button></article>)}</div>
          {!state.v1Issues.includes("signup") && <div className="m2-signup-bar"><label htmlFor="signup-name">Your name</label>{state.selectedEvent && <span className="m2-signup-event">Joining {eventList.find((event) => event.id === state.selectedEvent)?.name}</span>}<input id="signup-name" value={signupName} onChange={(event) => setSignupName(event.target.value)} /><button className="button button-primary" type="button" disabled={!state.selectedEvent} onClick={() => dispatchMission2({ type: "SIGN_UP" })}>Sign Up</button>{state.joined && <p className="m2-inline-note">{state.v1Issues.includes("confirmation") ? "The button was clicked, but the page did not confirm the event." : "You’re signed up."}</p>}</div>}
          <p className="m2-preview-foot">A preview of the app the AI made from your brief.</p>
        </div><div className="m2-task-card"><span className="eyebrow">TEST THIS TASK</span><strong>Jordan wants to volunteer Saturday morning.</strong><p>Find an event that works and sign Jordan up. What happens when you try?</p><div className="m2-task-status">{state.joined ? state.v1Issues.includes("confirmation") ? "Signup was attempted, but the app did not confirm it." : "Signup confirmation is visible." : state.selectedEvent ? `Selected: ${eventList.find((item) => item.id === state.selectedEvent)?.name}` : "Choose a Saturday event to begin"}</div></div>
        <Continue disabled={!state.selectedEvent} onClick={() => dispatchMission2({ type: "ADVANCE" })}>What went wrong?</Continue>
      </>}
      {state.stage === 5 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>What did Jordan run into?</h1><p>Choose the clearest issue you observed in the product. A build can look complete and still miss the task.</p></div><div className="m2-observation-list">{(state.v1Issues.length ? state.v1Issues : ["confirmation"]).map((item) => <Choice key={item} selected={state.observedProblem === item} onClick={() => dispatchMission2({ type: "OBSERVE", problem: item })}>{problemText[item]}</Choice>)}{state.v1Issues.length === 0 && <p className="m2-all-good">The core flow works. Choose a small improvement you noticed, such as making event details easier to scan.</p>}</div>
      </>}
      {state.stage === 6 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Tell the AI what to change.</h1><p>Point to what you saw and describe the result you want. The choices below range from vague to specific.</p></div><div className="m2-observed-callout"><span>YOU OBSERVED</span><strong>{problemText[state.observedProblem] ?? "The signup needs a clearer result."}</strong></div><div className="m2-choice-list">{definition.options.feedback.map((option) => <Choice key={option.id} selected={state.feedback === option.id} onClick={() => dispatchMission2({ type: "FEEDBACK", id: option.id })}>{option.label}</Choice>)}</div><Continue onClick={() => advance("BUILD_V2")}>Ask the AI to update it</Continue>
      </>}
      {state.stage === 7 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>The AI made a focused change.</h1><p>You asked: “{definition.options.feedback.find((option) => option.id === state.feedback)?.label ?? "Make it better."}”</p></div><div className="m2-before-after"><div><span>VERSION 1</span><p>{problemText[state.observedProblem] ?? "The first version did not clearly confirm the signup."}</p></div><span className="m2-update-label">UPDATED TO</span><div className="m2-after"><span>VERSION 2</span><p>{state.v2Changes.includes("confirmation") ? "After sign-up, Jordan sees: You’re signed up for Park clean-up · Saturday, Oct 17 · 9:00 AM." : state.v2Changes.includes("details") ? "Each event card now shows its date, time, and location." : state.v2Changes.includes("added-features") ? "The AI added account setup, reminders, and messaging. Jordan has more steps before reaching events." : "No visible change: the instruction did not say what outcome to create."}</p></div></div><Continue onClick={() => dispatchMission2({ type: "ADVANCE" })}>Retest Jordan’s task</Continue>
      </>}
      {state.stage === 8 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>Try Jordan’s task again.</h1><p>Same Saturday morning task. Check that the product now gives Jordan a clear result.</p></div><div className="m2-retest-card"><span className="m2-product-mark">V</span><div><h2>Park clean-up</h2><p>Saturday, Oct 17 · 9:00–11:00 AM</p><p>Riverside Park</p><button className="button button-primary" type="button" onClick={() => { dispatchMission2({ type: "SELECT_EVENT", event: "park" }); dispatchMission2({ type: "SIGN_UP" }); }}>Sign Jordan up</button>{state.retestJoined && state.v2Changes.includes("confirmation") && <p className="m2-confirmation">You’re signed up for Park clean-up · Saturday, Oct 17 · 9:00 AM.</p>}{!state.retestTried && <p className="m2-retest-hint">Sign Jordan up to run the same task again.</p>}</div></div><Continue disabled={!state.retestTried} onClick={() => advance("RETEST")}>Check the result</Continue>
      </>}
      {state.stage === 9 && <>
        <div className="m2-heading"><p className="eyebrow">{stageLabel}</p><h1>{state.retestPassed ? "Jordan’s task works now." : "The retest still found a gap."}</h1><p>{state.retestPassed ? "The update addressed the issue you observed. The change was verified by repeating the task." : "The follow-up did not fix the missing event information or signup. You can still see where the brief needs work."}</p></div><div className={`m2-test-result ${state.retestPassed ? "passed" : "failed"}`}><span>{state.retestPassed ? "RETEST PASSED" : "RETEST NEEDS WORK"}</span><p>{state.retestPassed ? "Jordan can find the event, sign up, and see the event details in the confirmation." : problemText[state.v1Issues.find((item) => !state.v2Changes.includes(item)) ?? "confirmation"]}</p></div><h2 className="m2-section-heading">What should happen next?</h2><div className="m2-choice-list">{definition.shipping.map((option) => <Choice key={option.id} selected={state.shipChoice === option.id} onClick={() => dispatchMission2({ type: "SHIP", choice: option.id })}>{option.label}</Choice>)}</div>
      </>}
      {state.stage === 10 && <>
        <div className="m2-heading"><p className="eyebrow">MISSION COMPLETE · ATTEMPT {attemptCount}</p><h1>{state.shipChoice === "ship" ? "You shipped a better brief." : "You finished the build."}</h1><p>Your choices shaped the first build, the observed gap, and the change you asked for.</p></div>
        <section className="m2-summary"><div className="m2-summary-head"><span className="eyebrow">BUILDER SUMMARY</span><button className="button button-quiet" type="button" onClick={() => dispatchMission2({ type: "RETURN" })}>Return to Missions</button></div><div className="m2-summary-item"><span>Original request</span><p>“{summary.original}”</p></div><div className="m2-summary-item"><span>What you learned from Maya</span><p>{summary.learned.length ? summary.learned.join(" ") : "You did not ask Maya any questions."}</p></div><div className="m2-summary-item"><span>Your first brief</span><p>{summary.brief || "No build brief was assembled."}</p></div><div className="m2-summary-item"><span>What version 1 got wrong</span><p>{summary.v1.length ? summary.v1.join(" ") : "The selected core task worked in the first build."}</p></div><div className="m2-summary-item"><span>What you spotted</span><p>{summary.observed}</p></div><div className="m2-summary-item"><span>Your follow-up instruction</span><p>{summary.feedback}</p></div><div className="m2-summary-item"><span>What changed</span><p>{summary.changes.length ? summary.changes.join(" ") : "No specific product change was made."}</p></div><div className="m2-summary-item"><span>Ship decision</span><p>{summary.ship}</p></div><div className="m2-summary-lessons"><strong>From this run</strong>{summary.lessons.slice(0, 3).map((lesson) => <p key={lesson}>{lesson}</p>)}</div></section>
        <section className="m2-skill-results"><h2>Skills practiced</h2>{scores.map((skill) => <div key={skill.name}><div><strong>{skill.name}</strong><span>{skill.score}%</span></div><div className="skill-track"><span style={{ width: `${skill.score}%` }} /></div><p>{skill.explanation}</p></div>)}</section>
        {progress.attempts.length > 1 && <details className="m2-history"><summary>Attempt history ({progress.attempts.length})</summary>{progress.attempts.map((attempt) => <p key={attempt.number}>Attempt {attempt.number}: {attempt.summary.ship}</p>)}</details>}
        <p className="m2-footer-note">These skill scores reflect your choices in the mission, not a formal assessment.</p>
      </>}
      {state.stage > 0 && state.stage < 10 && <div className="m2-step-label">{stageLabel}</div>}
    </main>
  </div>;
}
