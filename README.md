# BuildLoop — Guided Missions + BuildLoop Studio

BuildLoop teaches people to turn a real problem into a useful first version, test it, learn from feedback, and improve it. The product has two experiences: six guided Missions and BuildLoop Studio, where learners apply the same workflow to a project they choose.

## Run locally

```sh
npm install
npm run dev
```

The app is local-first. Mission progress is saved in browser storage; no account, backend, database, or real AI service is used.

## The learning loop

The course follows a growing product-building loop: human judgment → clear goal → AI implementation → human testing → evidence → focused iteration → verification → decision. Each mission uses a different fictional product and deterministic Builder simulation.

1. **The Missing Cameras:** understand a user’s problem and choose a useful first version.
2. **The Vague Request:** turn a broad request into a clear goal and learn from feedback.
3. **Build, Try, Improve:** treat building as a conversation; try the result and give a focused follow-up.
4. **What Should We Build Next?:** use real feedback to choose what matters and judge whether the result is ready.
5. **Something’s Broken:** reproduce a problem in ClubBoard, report what you expected and what happened, retest the Builder’s repair, and check that another club still works.
6. **Build It for Real:** combine the course skills to help a campus event team manage volunteer shifts, test a focused first version, and make a ship decision from what happened.

After Mission 6, the course completion screen invites learners to start an original project in Studio. Studio is also visible earlier from the Mission Hub, with a recommendation to complete the course first.

## BuildLoop Studio

Studio guides a learner through their own idea: identify a user and problem, choose focused Version 1 scope and Later Ideas, write and inspect a Builder Brief, build, try it, record observations and another person's feedback, choose a behavior-focused next goal, build another version, retest, check nearby behavior, and make a share decision. Learners can revise their project details, resume multiple projects, review build history, and delete a project after confirming.

Studio business concepts live in `src/lib/studio.ts`, separately from React. `src/lib/studio-store.ts` persists Studio under `buildloop-studio-v1` in browser local storage. It does not change the existing `buildloop-learner-v2` mission record or its `buildloop-mission-v1` migration. The store boundary can later be replaced with account-backed storage without rewriting the project workflow.

The Builder boundary is `BuilderProvider`. The current `demoBuilder` is local and simulated: it returns a text prototype concept based on the learner's instruction. It does not call an AI service, generate executable application code, or deploy a working app. No external Builder credentials were found or integrated for this milestone. To connect a real Builder, implement the provider contract in a server-side adapter, map its completed/failed results to the existing version model, keep credentials out of browser code and saves, and inject that provider at the build boundary. The deterministic engines for Missions 1–6 remain unchanged.

Mission 5’s Builder behaves deterministically. A clear report fixes the membership display on the first build. A vague report misses the display issue, while an implementation guess changes the seat-count behavior and causes another club’s seat count to stop updating. Learners can report what they observe, receive a second build, repeat the original actions, and check Robotics Club before deciding whether to share.

Mission scenarios, deterministic build outcomes, and skill scoring live in `src/lib/missions/`. Mission state is saved with the shared local progress record in [store.ts](src/lib/store.ts). Each mission has its own screen; Mission 6 adds optional fields to the existing save record and does not change its key, so earlier learner progress remains available.

## Product decisions

- Product evidence guides choices, while weaker but playable paths still show realistic consequences.
- The simulated Builder is deterministic: the same choices produce the same result.
- Learners try the product after a build, repeat the same steps after a repair, and check a nearby behavior before deciding.
- Reports work best when they describe the action, expected result, and actual result; learners do not need to guess how the app was built.
- Scores explain which choices they reflect instead of awarding generic XP.

## Validation

- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript
- `npm test` — Vitest unit coverage
- `npm run build` — optimized Next.js build
- `npm run test:e2e` (after `npm run build`) — Chromium coverage of mission progression and completion, including desktop and 390px mobile layouts against the production server
- Studio unit tests cover idea coaching, Builder Brief inspection, version lifecycle, observations, feedback, iteration goals, and project reflection. Studio Chromium journeys cover build → try → feedback → Version 2 → retest, refresh/resume, coaching, and 390px/1440px overflow checks.
- `npm audit` — dependency audit

## Known limits

- The build handoff is deterministic simulation, not a real model or code generator.
- The equipment tracker is an in-experience prototype with fictional seed data. It is not connected to a real club inventory.
- Progress is stored in one browser and has no account sync or teacher view.
- Scores are transparent formative feedback, not a validated measure of a learner's long-term ability.

## Recommended real-user experiment

Observe teenagers aged 13–18 completing the six-mission course without coaching. Ask them to think aloud, then ask how they decided what to build, what they learned from a failed check, and what evidence they wanted before sharing. Track time by mission, skipped checks, confusing controls, and whether they distinguish what they saw from guesses about how the app works. Use those observations to revise the course.
