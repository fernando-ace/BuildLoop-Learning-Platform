# BuildLoop Builder architecture and security

## Request and provider boundary

Studio builds through `POST /api/studio/build`. The browser sends the active project's problem, user, Version 1 scope, Later Ideas, brief, previous artifact, observations, feedback, next goal, and version number. The route checks same-origin requests, bounds input size and fields, limits requests per client address, and returns learner-safe errors. `BuilderProvider` in `src/lib/builder/provider.ts` separates provider behavior from Studio. The OpenAI Responses API key stays server side and requests use `store: false`. The deterministic test provider returns stable fixture-based V2 artifacts. The Builder receives a single repair attempt after artifact validation fails.

The prompt keeps product policy separate from learner content, treats that content as untrusted, asks for V2 declarative JSON, and tells follow-up builds to preserve unrelated behavior and make the smallest change that meets the next goal. The deterministic provider is a test fixture and is not evidence of live model quality.

## `buildloop-app-v2`

V2 is JSON data interpreted by trusted BuildLoop code. It does not contain executable source.

Top-level keys are `format`, `title`, `summary`, `defaultScreen`, `screens`, `navigation`, `collections`, `actions`, `metrics`, `changeSummary`, and `testTasks`.

- Screens have stable IDs, titles, and one of `list`, `table`, `cards`, `detail`, `form`, or `about` views. Collection views choose a collection and can name displayed fields, a primary field, search, enum filters, and an empty state. Form screens identify a collection, create or edit mode, and cancel screen.
- Collections have stable lowercase IDs, labels, typed fields, and optional seed records. Fields have stable IDs within their collection. IDs identify the stored concept; labels are presentation copy and may change without changing identity. Fields support short and long text, number, boolean, date, select/status choices, and a reference to another collection. A field may declare a type-checked default. The runtime creates record IDs when omitted.
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

V2 runtime persistence uses a parent-window message channel. The parent accepts messages only from the exact iframe window, checks the project and version namespace, validates the full saved record set against the artifact schema, and stores it separately from the immutable artifact under `buildloop-runtime-v2:<projectId>:<version>`. New saves use a bounded snapshot envelope containing the project, version, artifact format, save time, and data. Earlier V2 saves stored the collection map directly; the loader validates those maps and upgrades them when it next saves.

Each version keeps its own runtime snapshot. Opening an earlier version loads only that version's records; edits in a later version cannot rewrite the earlier key. Reset restores that version's seed and field defaults. When a V2 version has no snapshot yet, Studio plans a one-step migration from the previous version before writing the target snapshot. Collections and fields are matched by stable IDs, never labels. Compatible fields keep their values, text/long-text changes are compatible, new fields receive a valid default when available, and new collections start from their own seed. Values that fail a changed type or field rule are set to a valid default or left blank. Removed fields and collections leave the runtime schema, while their source-version snapshot remains available when the learner reopens that version.

`planRuntimeMigration` is a deterministic read-only step. Its structured plan records preserved, added, removed, and incompatible schema elements, affected records, and warnings. `applyRuntimeMigration` builds a new target data map and validates it before persistence. Invalid source data or an invalid migrated result falls back to the target seed without changing the source snapshot. Studio records bounded migration provenance on the target version: source/target version, completion time, record and default counts, structured change identifiers, status, and warnings. Meaningful removal, incompatible-value reset, and required-field gaps appear in the preview summary. A required field without a default may remain blank on older records; those records remain visible and editable so a learner can fill them in.

`diffApplicationSchemas` compares validated artifacts by IDs and classifies collection, field, view, form, navigation, action, search/filter, metric, default, and sample-data changes. Adjacent version comparisons are derived from the stored artifacts, grouped into learner-facing categories, and do not rely on generated prose. The previous Builder artifact, current project brief, current goal, and bounded recent observations/feedback form the iteration context. Builder policy explicitly tells the model to keep IDs for continuing concepts, even when their labels change, and to assign new IDs to new concepts. API keys remain server-only, requests use `store: false`, and artifacts are validated again before they enter project history.

Each version is capped at 64 KB of runtime data, and each project's runtime store is capped at 1.6 MB. Studio project history is capped at 2 MB and 20 versions. Save-limit and browser-quota failures are reported in the preview; failed writes do not replace the previous version's snapshot. If a target snapshot already exists but is malformed, Studio leaves that save untouched and opens the preview with its sample data plus a visible message.

## Change summaries and learner testing

V2 change summaries and the comparison surface are derived from adjacent validated artifacts and identify added, changed, and removed collections and fields, views and forms, navigation, actions, search and filters, metrics, defaults, and sample data. V1 comparisons continue to summarize block structure. These summaries describe artifact changes, not whether the app works. Suggested tasks help the learner decide what to try; the learner records the action, expectation, and observed result, then supplies focused feedback and a next goal before rebuilding and retesting against the migrated target snapshot.

## Compatibility, storage, and recovery

Studio continues using `buildloop-studio-v1`; existing project and V1 artifact data is retained and V1 previews continue through the V1 interpreter. Existing V2 artifacts already include collection, field, and screen IDs, so they remain valid without rewriting the artifact. Legacy V2 runtime maps are read through a compatibility path. V1 artifacts continue to open, but V1's block model has no typed collections to migrate. Missions remain in their own store. Runtime app records use a separate key space from the Studio project document. A failed or interrupted build leaves existing versions available and the brief retryable. If browser storage fails, the open project and preview remain usable for that session, though the change cannot survive a later refresh.

## Deliberate limits

V2 supports small local applications. It is not a relational database, backend, auth system, sync service, deployment tool, or general-purpose IDE. Reference fields provide a simple one-way link and cyclic collection references are not a supported use case. There is no account, cloud storage, public publishing, generated network access, arbitrary HTML/CSS/JavaScript, package installation, or terminal/GitHub access. The deterministic provider covers four substantially different application shapes for regression; live generation still requires a configured OpenAI key and has to be evaluated separately.
