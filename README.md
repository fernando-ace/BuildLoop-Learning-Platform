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

The Builder returns a constrained `buildloop-app-v1` artifact rather than a repository or arbitrary code. Supported building blocks are headings, text, notices, interactive collections, and counters. A collection can add, edit, filter, and remove entries, with simple required-value feedback; a counter can increase and decrease. The current milestone is intended for small trackers, signup lists, checklists, simple voting and study tools, and similar single-screen apps. It does not install packages or create a backend, accounts, databases, or public deployments.

Generated versions, history, observations, and feedback are saved locally under `buildloop-studio-v1`. Existing mission data remains separate. Artifacts are capped at 24 KB each and the complete Studio save is capped at 480 KB to stay within practical browser storage limits. The app warns if the browser cannot save the current state. A refresh during a build marks that build failed and preserves the project for retry. Learner data stays in that browser; it is included in a provider request only when the learner asks to build, and only the current project context is sent.

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

The Chromium suite covers all six Missions and Studio creation, brief coaching, a successful interactive build and test, feedback, iteration, retesting, three-version history, older-version preview, failure and retry, unsafe output rejection, refresh/resume, and responsive overflow at phone and desktop sizes. E2E runs use the deterministic server provider and never call the live model.

## Current limitations

- Generated apps use the fixed component/action format described above; arbitrary software is not supported.
- The preview has in-memory state. It does not retain entries after the preview reloads.
- Data is local to one browser with no account sync, sharing, or teacher view.
- The live server provider keeps a process-local cap of five builds per minute per forwarded client address. The zero-cost deterministic test provider skips that cap. Production deployments with multiple instances should add a shared rate limiter before exposing paid generation broadly.
- The Builder accepts up to 20 versions per project in this milestone.
- OpenAI live generation requires a valid API key, enabled Responses API access, and a supported model. Deterministic test success is not evidence of live provider availability.
- Learner-generated app changes are summarized from the artifact structure. The summary describes added/removed block types and preserved blocks, not semantic correctness.
- Mission scores are formative feedback, not a validated measurement of long-term ability.
