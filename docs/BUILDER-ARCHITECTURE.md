# BuildLoop Builder architecture and security

## Request and provider boundary

Studio builds through `POST /api/studio/build`. The browser sends only the active project's problem, user, Version 1 scope, Later Ideas, Builder Brief, prior artifact, relevant observations and feedback, the next goal, and version number. The route checks same-origin requests, bounds input size and fields, limits requests per client address, and returns learner-safe errors. It never returns stack traces or provider response bodies.

`BuilderProvider` in `src/lib/builder/provider.ts` separates the product request from model response formats. The provider module is marked with Next.js's `server-only` guard. The production provider uses the server-side OpenAI Responses API; credentials are read from `OPENAI_API_KEY`, and `store: false` is sent. Model selection is centralized in `BUILDLOOP_OPENAI_MODEL`. The deterministic provider implements the same contract for tests. Studio uses the returned provider label in its version UI.

The request prompt keeps policy text separate from learner project content and explicitly treats project content as untrusted data. The Builder is told to preserve existing behavior, follow the learner's next goal, and keep Later Ideas outside current scope. A single repair attempt can follow validation feedback; repair does not loop.

## Artifact and validation

The `buildloop-app-v1` format is JSON data, not generated source code. Its fixed block types are `heading`, `text`, `notice`, `collection`, and `counter`. A collection supports add, edit, filter, and remove actions with simple required-value feedback; a counter supports increase and decrease actions. The BuildLoop interpreter owns all event handlers and rendering behavior.

`validateArtifact` requires the expected shape, title, summary, block count, short test tasks, supported block fields, and a maximum 24 KB artifact. It rejects malformed blocks and text resembling scripts, executable URLs, external network references, or parent/BuildLoop browser access. There are no generated packages, HTML fragments, JavaScript expressions, arbitrary URLs, file access, or server execution. The browser validates the artifact again before saving a version.

The Builder Change Summary is derived after validation by comparing block types and exact block data between adjacent versions. This keeps the summary tied to the delivered artifact. It reports structural additions/removals and preserved blocks; it does not claim that a behavior works.

## Preview boundary

`buildPreviewDocument` serializes the validated artifact as JSON and renders it through a fixed interpreter. All artifact text is assigned with `textContent`, never parsed as markup. The resulting document is hosted in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`; it has an opaque origin and cannot read BuildLoop DOM or local storage. Its Content Security Policy blocks network connections, forms, objects, external styles/scripts, and base URL changes. The only permitted inline script is the fixed BuildLoop interpreter, not model output. Project data remains isolated in the parent Studio save; preview interactions are in-memory for this milestone.

The preview has no generated links and no network-enabled control. The iframe has a descriptive title and a mobile viewport. No value or API key is passed into the preview.

## Persistence and recovery

Studio keeps using `buildloop-studio-v1`; mission progress remains in its existing store. The parser adds defaults for old Studio projects and old text-only Builder results. Invalid project rows are skipped without deleting the original stored string. `building` or `validating` states found after a refresh become a recoverable failure. A later retry keeps the brief, observations, feedback, and prior immutable versions. Each new build appends a version. The save is capped at 480 KB to avoid exhausting browser storage.

## Failure and cost controls

- Missing `OPENAI_API_KEY`, provider errors, timeout, malformed output, and failed repair map to short, non-technical UI messages.
- Each provider request has a 45 second timeout and at most one repair request.
- The route limits project fields, request size, version number (maximum 20), and live-provider requests to five per minute per forwarded client address in one server process. The no-cost deterministic test provider skips the live-provider rate cap.
- There are no model calls on page render and no live model calls from the automated suite.
- Test mode is enabled only by the Playwright server through `BUILDLOOP_BUILDER_MODE=deterministic`.

The in-memory request cap is best-effort and does not coordinate multiple server instances. A public multi-instance deployment should use a shared limiter and operational monitoring. This version has no login or durable server job queue. Refresh during a request marks the build recoverable instead of claiming it completed.

## Product boundaries

The learner chooses the user, problem, scope, instruction, observation, feedback meaning, next goal, retest result, and share decision. The model supplies an app artifact and test-task suggestions. Studio does not claim that the app passed a test unless the learner records the observation. The artifact format deliberately excludes authentication, persistent generated-app data, databases, arbitrary dependencies, integrations, and deployment.
