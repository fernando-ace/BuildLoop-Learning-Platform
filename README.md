# BuildLoop — Learn to build with AI

BuildLoop is a browser game about learning to build useful software with AI. Four short missions follow people as they find a real problem, ask an AI to build something useful, try what it made, and decide what should happen next.

## Run locally

```sh
npm install
npm run dev
```

The app is local-first. Mission progress is saved in browser storage; no account, backend, database, or real AI service is used.

## The learning loop

Understand what matters, choose the next goal, give the AI enough context, try the result, and respond to what happened. Each mission uses a different fictional product and deterministic AI simulation.

Mission 4, **What Should We Build Next?**, starts from a working study-session app and a student’s feedback. Learners explore the problem, choose a goal for the Builder, try the updated app, give focused feedback when it needs work, and decide whether to share it.

Mission scenarios and deterministic build outcomes live in `src/lib/missions/`. Mission state is saved with the shared local progress record in [store.ts](src/lib/store.ts). Each mission has its own screen; existing saves continue to use the same browser storage key.

## Product decisions

- Product evidence guides choices, while weaker but playable paths still show realistic consequences.
- The simulated Builder is deterministic: the same choices produce the same result.
- Learners try the product after a build and use observed behavior to guide any follow-up.
- Scores explain which choices they reflect instead of awarding generic XP.

## Validation

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm test` — Vitest unit coverage
- `npm run build` — optimized Next.js build
- `npm run test:e2e` (after `npm run build`) — Chromium coverage of mission progression and completion, including desktop and 390px mobile layouts against the production server
- `npm audit` — dependency audit

## Known limits

- The build handoff is deterministic simulation, not a real model or code generator.
- The equipment tracker is an in-experience prototype with fictional seed data. It is not connected to a real club inventory.
- Progress is stored in one browser and has no account sync or teacher view.
- Scores are transparent formative feedback, not a validated measure of a learner's long-term ability.

## Recommended real-user experiment

Observe five to eight teenagers aged 13–18 completing the mission without coaching. Ask them to think aloud, then ask what they learned from the failed check, why they chose their iteration, and whether the shipped version helps Ari. Track time by stage, skipped tests, confusing controls, and whether they can explain that testing and feedback are evidence. Use those observations to revise the mission before adding another one.
