# BuildLoop

BuildLoop helps learners turn a real problem into a useful first version, try it, learn from evidence, and decide what to improve. It includes six guided Missions and BuildLoop Studio for applying the same workflow to an original project.

## Run locally

```sh
npm install
```

Create `.env.local` in the repository root and add a server-only API key:

```dotenv
OPENAI_API_KEY=your_api_key
# Optional: BUILDLOOP_OPENAI_MODEL=gpt-4.1-mini
```

Then run:

```sh
npm run dev
```

The API key is read only by the server Builder route. Do not prefix it with `NEXT_PUBLIC_` or commit `.env.local`. The default provider is the OpenAI Responses API. The default model is `gpt-4.1-mini`; set `BUILDLOOP_OPENAI_MODEL` to another Responses API model available to your account if needed. Studio makes no model calls while pages render; a request is made only after the learner starts or retries a build.

When the key is missing, Studio preserves the project and shows a setup message. There is no silent demo success in the normal app. For deterministic browser testing, the Playwright server explicitly sets `BUILDLOOP_BUILDER_MODE=deterministic`; this is a test provider and is not the production path.

## Missions 1–6

The Missions teach product thinking through deterministic scenarios. They cover understanding a user and problem, narrowing Version 1, writing clear goals, learning from feedback, reporting and retesting bugs, checking nearby behavior, and making a shipping decision. Mission 6 transitions into Studio. Mission outcomes and skill feedback remain in the existing learner store; Studio does not rewrite or reset mission progress.

## BuildLoop Studio

Studio guides a learner through an original idea, Version 1 scope and Later Ideas, a structured Builder Brief, an executable first build, explicit try tasks, observations, feedback, a focused next goal, another build, retesting, version history, and reflection. The learner remains responsible for choosing the user, scope, goal, and whether the app works.

The Builder returns a constrained `buildloop-app-v2`, `buildloop-app-v3`, or `buildloop-app-v4` artifact rather than a repository or arbitrary code. V2 supports named screens, typed collections, forms, safe actions, and derived counters. V3 adds relational links, constraints, computed values, and workflows. V4 adds test personas, roles, ownership checks, field visibility, and workflow permissions for apps that need different actions for different users. Existing V1 artifacts still open in the V1 interpreter.

Generated versions, history, observations, and feedback are saved locally under `buildloop-studio-v1`. V2/V3 preview records live separately under project and version keyed browser snapshots. V4 can publish a role-based app to a local SQLite database at `.buildloop-data/shared.sqlite` (or the server-only `BUILDLOOP_SHARED_DB_PATH`). Published records are shared across browser sessions on that one server host, and app/version IDs keep them separate from Builder history. Publishing and rollback migrate the latest shared records transactionally and require review for permission widening or destructive schema changes. Each mutation is checked against server-held schema and a signed demo identity, then saved together with its audit entry. Mission data is unchanged. The shared record cap is 500 per collection; V4 artifacts are capped at 110 KB, with bounded roles, test users, permissions, and ownership expressions. This local runtime requires persistent writable disk and Node's built-in experimental `node:sqlite` in Node 22. It is not a multi-instance cloud service.

Studio now supports iterative declarative app evolution, compatible runtime-data preservation, structured schema comparison and migration planning, version-local historical state, and safe handling of incompatible values. Existing V1 apps and V2 artifacts remain readable; legacy V2 runtime maps are upgraded on their next save.

See [docs/BUILDER-ARCHITECTURE.md](docs/BUILDER-ARCHITECTURE.md) for the provider boundary, artifact format, preview sandbox, validation, privacy and current limitations.

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
- Generated apps still cannot run arbitrary JavaScript, custom backend logic, cloud databases, verified authentication, realtime multiplayer, external APIs, deployment, or arbitrary npm packages. V4 demo personas are selectable by any visitor and must never be used for real personal or sensitive data.
- Reference fields support one-way links between collections; this is not a general relational database.
- The deterministic provider is a regression fixture selector, not evidence that a live model can design every brief well.
- V1-V3 preview data stays local to one browser. V4 published data is shared across sessions that reach the same local server database; it has no real account sync, identity provider, realtime delivery, or teacher view. Deployments must add persistent shared transactional storage and real authentication before multi-host or production use.
- The live server provider keeps a process-local cap of five builds per minute per forwarded client address. The zero-cost deterministic test provider skips that cap. Production deployments with multiple instances should add a shared rate limiter before exposing paid generation broadly.
- The Builder accepts up to 20 versions per project in this milestone.
- OpenAI live generation requires a valid API key, enabled Responses API access, and a supported model. Deterministic test success is not evidence of live provider availability.
- Learner-generated app changes are summarized from validated artifact structure, not semantic correctness.
- Mission scores are formative feedback, not a validated measurement of long-term ability.
