# BuildLoop

BuildLoop helps learners turn a real problem into a useful first version, try it, learn from evidence, and decide what to improve. It includes six guided Missions and BuildLoop Studio for applying the same workflow to an original project.

## Run locally

```sh
npm install
```

Create `.env.local` in the repository root and configure PostgreSQL and Better Auth:

```dotenv
DATABASE_URL=postgresql://buildloop:password@localhost:5432/buildloop
BETTER_AUTH_SECRET=replace-with-a-random-secret-of-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
# Optional live Builder access:
OPENAI_API_KEY=your_api_key
```

Then run:

```sh
npm run db:migrate
npm run dev
```

Database credentials, auth secrets, and the optional API key are server-only. Do not prefix them with `NEXT_PUBLIC_` or commit `.env.local`. Studio makes no model calls while pages render; a request is made only after the learner starts or retries a build.

When the key is missing, Studio preserves the project and shows a setup message. There is no silent demo success in the normal app. For deterministic browser testing, the Playwright server explicitly sets `BUILDLOOP_BUILDER_MODE=deterministic`; this is a test provider and is not the production path.

## Missions 1–6

The Missions teach product thinking through deterministic scenarios. They cover understanding a user and problem, narrowing Version 1, writing clear goals, learning from feedback, reporting and retesting bugs, checking nearby behavior, and making a shipping decision. Mission 6 transitions into Studio. Mission outcomes and skill feedback remain in the existing learner store; Studio does not rewrite or reset mission progress.

## BuildLoop Studio

Studio guides a learner through an original idea, Version 1 scope and Later Ideas, a structured Builder Brief, an executable first build, explicit try tasks, observations, feedback, a focused next goal, another build, retesting, version history, and reflection. The learner remains responsible for choosing the user, scope, goal, and whether the app works.

The Builder returns a constrained `buildloop-app-v2`, `buildloop-app-v3`, or `buildloop-app-v4` artifact rather than a repository or arbitrary code. V2 supports named screens, typed collections, forms, safe actions, and derived counters. V3 adds relational links, constraints, computed values, and workflows. V4 adds test personas, roles, ownership checks, field visibility, and workflow permissions for apps that need different actions for different users. Existing V1 artifacts still open in the V1 interpreter.

Studio creates an account-owned application in PostgreSQL before building. V4 artifacts are saved as immutable versions; preview and production have separate version pointers and runtime records. Publishing uses an explicitly selected saved version, validates migration safety, and updates records, migration history, publication history, and audit events in a transaction. Safe rollback uses the same checks. Platform roles (owner, administrator, member) are separate from generated app roles. Invitations store hashed tokens, require a signed-in account, and can be revoked. When Resend is configured, invitations are sent by email; copied links remain available as a fallback.

When signed in, Mission checkpoints and skill/attempt history sync to a private PostgreSQL record for that learner. Studio coaching notes, observations, and version reflections use a separate per-learner record, even when the app has collaborators. Existing browser saves are retained locally and imported when safe; when both the account and browser have different progress, Studio and Missions ask which copy to keep. Generated app artifacts and project versions remain in the account app model. See [docs/PLATFORM.md](docs/PLATFORM.md) for the current boundary, and [DEPLOYMENT.md](DEPLOYMENT.md), [OPERATIONS.md](OPERATIONS.md), [SECURITY.md](SECURITY.md), and [PRODUCTION_LAUNCH_CHECKLIST.md](PRODUCTION_LAUNCH_CHECKLIST.md) for production operations.

Studio now supports iterative declarative app evolution, compatible runtime-data preservation, structured schema comparison and migration planning, version-local historical state, and safe handling of incompatible values. Existing V1 apps and V2 artifacts remain readable; legacy V2 runtime maps are upgraded on their next save.

See [docs/BUILDER-ARCHITECTURE.md](docs/BUILDER-ARCHITECTURE.md) for the provider boundary, artifact format, preview sandbox, validation, privacy and current limitations. See [docs/GOAL15_EVIDENCE.md](docs/GOAL15_EVIDENCE.md), [docs/PUBLIC_BETA_LAUNCH_CHECKLIST.md](docs/PUBLIC_BETA_LAUNCH_CHECKLIST.md), and [docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md) for beta readiness, operational procedures, and open release gates.

## Deterministic Builder mode

The test provider returns stable, interactive artifacts without network calls or API credits. It is selected by `BUILDLOOP_BUILDER_MODE=deterministic` on the server. Unit tests call it directly; the Playwright web server sets it in `playwright.config.ts`. It is labeled **Deterministic Test Builder** in Studio. The legacy `demo` result shape remains readable for versions already saved before interactive apps were introduced; it is not a provider for new builds.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The Chromium suite covers all six Missions and Studio creation, brief coaching, a successful interactive build and test, feedback, iteration, retesting, a four-version migration chain, incompatible-change warnings, historical snapshots, older-version previews, failure and retry, unsafe output rejection, refresh/resume, and responsive overflow at phone and desktop sizes. E2E runs use the deterministic server provider and never call the live model.

## Current limitations

- Generated apps use the fixed data, action, and screen model described above; arbitrary software is not supported.
- Generated apps still cannot run arbitrary JavaScript, custom backend logic, realtime multiplayer, external APIs, deployment, or arbitrary npm packages. Test personas are limited to local Studio role previews; published app access uses real signed-in accounts and memberships.
- Reference fields support one-way links between collections; this is not a general relational database.
- The deterministic provider is a regression fixture selector, not evidence that a live model can design every brief well.
- Mission progress and Studio learning records sync through the authenticated PostgreSQL platform when it is configured; browser-only saves remain available in development. Cross-device behavior still requires hosted account verification before public beta.
- Hosted Builder requests use a PostgreSQL-backed per-account rate limit. Deterministic generation is restricted to development/test and does not establish live model quality or availability.
- Production and Preview require email verification before sign-in and support password reset. Configure a verified `EMAIL_FROM` sender and `RESEND_API_KEY`; until then, those email actions are unavailable and new accounts cannot complete verification.
- The Builder accepts up to 20 versions per project in this milestone.
- OpenAI live generation requires a valid API key, enabled Responses API access, and a supported model. Deterministic test success is not evidence of live provider availability.
- Learner-generated app changes are summarized from validated artifact structure, not semantic correctness.
- Mission scores are formative feedback, not a validated measurement of long-term ability.
