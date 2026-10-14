# BuildLoop — Mission 1

BuildLoop is a browser game about learning to build useful software with AI. In **The Missing Cameras**, the player helps Ari, a photography club officer, replace an unreliable group chat and memory with a small equipment tracker.

## Run locally

```sh
npm install
npm run dev
```

The app is local-first. Mission progress is saved in browser storage; no account, backend, database, or real AI service is used.

## Mission loop

1. Ask Ari up to three questions and collect clues.
2. Choose a specific problem statement.
3. Scope an MVP with a seven point build budget.
4. Write a build brief and see its context, behavior, boundaries, and checks coverage.
5. Review a deterministic simulated AI build.
6. Use the embedded equipment app and run targeted checks.
7. Select feedback signals, choose one focused iteration, and review the second build.
8. Ship and receive a skills breakdown plus a Builder Summary of the choices made.

The narrative and catalog data are in [mission.ts](src/lib/mission.ts). Reducer transitions are in [reducer.ts](src/lib/reducer.ts), with local persistence in [store.ts](src/lib/store.ts). Individual mission screens and the shared navigation shell are separate React components in [page.tsx](src/app/page.tsx); the rendering switch is small and the mission rules stay outside the page component.

## Product decisions

- Useful discovery questions lead to user evidence; weak feature questions get an honest answer without a right/wrong label.
- The MVP budget permits several different choices, while making core equipment tracking affordable.
- The simulated developer produces issues from missing brief details or omitted persistence. Repeating the same decisions produces the same result.
- Product checks focus on the core path, invalid input, double checkout, and saved state. Learners choose which checks to run.
- Feedback separates observed behavior from requests and preferences. A focused change keeps the working product intact.
- Scores explain the choices and checks they reflect instead of awarding generic XP.

## Validation

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm test` — Vitest unit coverage
- `npm run build` — optimized Next.js build
- `npm run test:e2e` (after `npm run build`) — Chromium desktop mission completion and 390px mobile overflow through the full mission against the production server
- `npm audit` — dependency audit

## Known limits

- The build handoff is deterministic simulation, not a real model or code generator.
- The equipment tracker is an in-experience prototype with fictional seed data. It is not connected to a real club inventory.
- Progress is stored in one browser and has no account sync or teacher view.
- Scores are transparent formative feedback, not a validated measure of a learner's long-term ability.

## Recommended real-user experiment

Observe five to eight teenagers aged 13–18 completing the mission without coaching. Ask them to think aloud, then ask what they learned from the failed check, why they chose their iteration, and whether the shipped version helps Ari. Track time by stage, skipped tests, confusing controls, and whether they can explain that testing and feedback are evidence. Use those observations to revise the mission before adding another one.
