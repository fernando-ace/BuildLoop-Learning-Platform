# BuildLoop Builder architecture and security

## Request and provider boundary

Studio builds through `POST /api/studio/build`. The browser sends the active project's problem, user, Version 1 scope, Later Ideas, brief, previous artifact, observations, feedback, next goal, and version number. The route checks same-origin requests, bounds input size and fields, limits requests per client address, and returns learner-safe errors. `BuilderProvider` in `src/lib/builder/provider.ts` separates provider behavior from Studio. The OpenAI Responses API key stays server side and requests use `store: false`. The deterministic test provider returns stable fixture-based V2 artifacts. The Builder receives a single repair attempt after artifact validation fails.

The prompt keeps product policy separate from learner content, treats that content as untrusted, asks for V2 declarative JSON, and tells follow-up builds to preserve unrelated behavior and make the smallest change that meets the next goal. The deterministic provider is a test fixture and is not evidence of live model quality.

## `buildloop-app-v2`

V2 is JSON data interpreted by trusted BuildLoop code. It does not contain executable source.

Top-level keys are `format`, `title`, `summary`, `defaultScreen`, `screens`, `navigation`, `collections`, `actions`, `metrics`, `changeSummary`, and `testTasks`.

- Screens have stable IDs, titles, and one of `list`, `table`, `cards`, `detail`, `form`, or `about` views. Collection views choose a collection and can name displayed fields, a primary field, search, enum filters, and an empty state. Form screens identify a collection, create or edit mode, and cancel screen.
- Collections have stable IDs, labels, typed fields, and optional seed records. Fields support short and long text, number, boolean, date, select/status choices, and a reference to another collection. The runtime creates record IDs when omitted.
- Navigation items target declared screens. Actions are allowlisted `navigate`, `delete`, `toggle`, `increment`, and `set` records and must reference declared screens, collections, and compatible fields. Create and edit are represented by form screens.
- Metrics are allowlisted `count`, `countEquals`, and numeric `sum` operations. No arbitrary formula or expression is evaluated.
- Test tasks are short suggestions. They are prompts for learner testing and do not represent automated correctness claims.

Example:

```json
{
  "format": "buildloop-app-v2",
  "title": "Equipment checkout",
  "summary": "Track shared equipment and its availability.",
  "defaultScreen": "inventory",
  "screens": [
    { "id": "inventory", "title": "Inventory", "view": "table", "collection": "equipment", "primaryField": "name", "fields": ["name", "category", "quantity", "checked_out"], "search": true, "emptyText": "Add equipment to start." },
    { "id": "add_item", "title": "Add equipment", "view": "form", "collection": "equipment", "formMode": "create", "cancelScreen": "inventory" }
  ],
  "navigation": [{ "label": "Inventory", "screen": "inventory" }],
  "collections": [{
    "id": "equipment", "label": "Equipment",
    "fields": [
      { "id": "name", "label": "Item", "type": "text", "required": true, "maxLength": 80 },
      { "id": "category", "label": "Category", "type": "select", "options": ["Audio", "Sports", "Lab"] },
      { "id": "quantity", "label": "Quantity", "type": "number", "min": 0, "max": 500 },
      { "id": "checked_out", "label": "Checked out", "type": "boolean" }
    ],
    "seed": [{ "name": "Projector", "category": "Audio", "quantity": 4, "checked_out": false }]
  }],
  "actions": [],
  "metrics": [{ "id": "item_count", "label": "Items", "op": "count", "collection": "equipment" }],
  "changeSummary": ["Added inventory screen"],
  "testTasks": ["Add an item and find it in inventory"]
}
```

## Validation and security boundary

`validateArtifact` dispatches to the V1 or V2 validator. V1 remains supported at its 24 KB bound. V2 is capped at 48 KB, 10 screens, 8 collections, 16 fields per collection, 100 seed rows per collection, 8 navigation items, 40 actions, 12 metrics, and bounded labels and text. It rejects unknown properties, unsafe strings, malformed IDs, duplicate IDs, invalid seed values, unsupported operations, and references to missing screens, collections, or fields. The server validates before returning a result; Studio validates again before appending it to history.

The iframe uses `sandbox="allow-scripts"` without `allow-same-origin`, preserving its opaque origin. Its CSP blocks network access, forms, objects, external assets, base changes, and connections. Its only script is the fixed BuildLoop interpreter. Artifact values are serialized as JSON and rendered using text nodes / `textContent`; no artifact text becomes markup. The interpreter owns input validation, events, identifiers, mutations, filters, derived values, and record serialization. Model output cannot set CSS, run JavaScript, choose packages, call APIs, or create HTML.

V2 runtime persistence uses a parent-window message channel. The parent accepts messages only from the exact iframe window, checks the project and version namespace, validates the full saved record set against the artifact schema, and stores it separately from the immutable artifact under `buildloop-runtime-v2:<projectId>:<version>`. Each version begins from its own artifact seed. Opening an earlier version loads only that version's saved runtime state. Reset restores its seed. There is no automatic migration between versions, so no newer version can silently alter older records. Each version is capped at 64 KB of runtime data, and each project's runtime store is capped at 1.6 MB; save-limit and browser-quota failures are reported in the preview.

## Change summaries and learner testing

V2 change summaries are derived from adjacent validated artifacts and identify added, changed, and removed screens and collections, navigation, actions, metrics, and seed data. V1 comparisons continue to summarize block structure. These summaries describe artifact changes, not whether the app works. Suggested tasks help the learner decide what to try; the learner records the action, expectation, and observed result, then supplies focused feedback and a next goal before rebuilding and retesting.

## Compatibility, storage, and recovery

Studio continues using `buildloop-studio-v1`; existing project and V1 artifact data is retained and V1 previews continue through the V1 interpreter. Missions remain in their own store. Runtime app records use a separate key space from the Studio project document. A failed or interrupted build leaves existing versions available and the brief retryable. The project document has a 2 MB storage cap. If browser storage fails, the open project and preview remain usable for that session, though the change cannot survive a later refresh.

## Deliberate limits

V2 supports small local applications. It is not a relational database, backend, auth system, sync service, deployment tool, or general-purpose IDE. Reference fields provide a simple one-way link and cyclic collection references are not a supported use case. There is no account, cloud storage, public publishing, generated network access, arbitrary HTML/CSS/JavaScript, package installation, or terminal/GitHub access. The deterministic provider covers four substantially different application shapes for regression; live generation still requires a configured OpenAI key and has to be evaluated separately.
