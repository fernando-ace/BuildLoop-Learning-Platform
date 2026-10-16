# BuildLoop Builder architecture and security

## Request and provider boundary

Studio builds through `POST /api/studio/build`. The browser sends the active project's problem, user, Version 1 scope, Later Ideas, brief, previous artifact, observations, feedback, next goal, and version number. The route checks same-origin requests, bounds input size and fields, limits requests per client address, and returns learner-safe errors. `BuilderProvider` in `src/lib/builder/provider.ts` separates provider behavior from Studio. The OpenAI Responses API key stays server side and requests use `store: false`. The deterministic test provider returns stable fixture-based V2 artifacts. The Builder receives a single repair attempt after artifact validation fails.

The prompt keeps product policy separate from learner content, treats that content as untrusted, asks for V2 or V3 declarative JSON, and tells follow-up builds to preserve unrelated behavior and make the smallest change that meets the next goal. The deterministic provider is a test fixture and is not evidence of live model quality.

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

`validateArtifact` dispatches to the V1, V2, V3, or V4 validator. V1 remains supported at its 24 KB bound. V2 is capped at 48 KB, 10 screens, 8 collections, 16 fields per collection, 100 seed rows per collection, 8 navigation items, 40 actions, 12 metrics, and bounded labels and text. V3 has a 96 KB artifact bound, the same screen and collection caps, and at most 12 relationships, 16 computed fields, and 16 constraints per collection. It also caps workflows at 20, each workflow at 12 steps and 8 inputs, expression depth at 8, and records at 500 per collection; relationship lists are limited to 100 linked records each. V4 adds a 110 KB artifact bound, at most 12 roles, 100 seeded test users, 120 permissions, 8 ownership predicates per `and`, and a maximum ownership depth of 8. All versions reject unknown properties, unsafe strings, malformed IDs, duplicate IDs, invalid seed values, unsupported operations, and references to missing screens, collections, or fields. The server validates before returning a result; Studio validates again before appending it to history.

The iframe uses `sandbox="allow-scripts"` without `allow-same-origin`, preserving its opaque origin. Its CSP blocks network access, forms, objects, external assets, base changes, and connections. Its only script is the fixed BuildLoop interpreter. Artifact values are serialized as JSON and rendered using text nodes / `textContent`; no artifact text becomes markup. The interpreter owns input validation, events, identifiers, mutations, filters, derived values, and record serialization. Model output cannot set CSS, run JavaScript, choose packages, call APIs, or create HTML.

V2 runtime persistence uses a parent-window message channel. The parent accepts messages only from the exact iframe window, checks the project and version namespace, validates the full saved record set against the artifact schema, and stores it separately from the immutable artifact under `buildloop-runtime-v2:<projectId>:<version>`. New saves use a bounded snapshot envelope containing the project, version, artifact format, save time, and data. Earlier V2 saves stored the collection map directly; the loader validates those maps and upgrades them when it next saves.

Each version keeps its own runtime snapshot. Opening an earlier version loads only that version's records; edits in a later version cannot rewrite the earlier key. Reset restores that version's seed and field defaults. When a V2 version has no snapshot yet, Studio plans a one-step migration from the previous version before writing the target snapshot. Collections and fields are matched by stable IDs, never labels. Compatible fields keep their values, text/long-text changes are compatible, new fields receive a valid default when available, and new collections start from their own seed. Values that fail a changed type or field rule are set to a valid default or left blank. Removed fields and collections leave the runtime schema, while their source-version snapshot remains available when the learner reopens that version.

`planRuntimeMigration` is a deterministic read-only step. Its structured plan records preserved, added, removed, and incompatible schema elements, affected records, and warnings. `applyRuntimeMigration` builds a new target data map and validates it before persistence. Invalid source data or an invalid migrated result falls back to the target seed without changing the source snapshot. Studio records bounded migration provenance on the target version: source/target version, completion time, record and default counts, structured change identifiers, status, and warnings. Meaningful removal, incompatible-value reset, and required-field gaps appear in the preview summary. A required field without a default may remain blank on older records; those records remain visible and editable so a learner can fill them in.

`diffApplicationSchemas` compares validated artifacts by IDs and classifies collection, field, view, form, navigation, action, search/filter, metric, default, and sample-data changes. Adjacent version comparisons are derived from the stored artifacts, grouped into learner-facing categories, and do not rely on generated prose. The previous Builder artifact, current project brief, current goal, and bounded recent observations/feedback form the iteration context. Builder policy explicitly tells the model to keep IDs for continuing concepts, even when their labels change, and to assign new IDs to new concepts. API keys remain server-only, requests use `store: false`, and artifacts are validated again before they enter project history.

Each version is capped at 64 KB of runtime data, and each project's runtime store is capped at 1.6 MB. Studio project history is capped at 2 MB and 20 versions. Save-limit and browser-quota failures are reported in the preview; failed writes do not replace the previous version's snapshot. If a target snapshot already exists but is malformed, Studio leaves that save untouched and opens the preview with its sample data plus a visible message.

## `buildloop-app-v3`

V3 remains declarative JSON interpreted by trusted BuildLoop code. It extends the V2 application contract with explicit one-to-one and one-to-many relationships, bounded computed expressions, collection constraints, and multi-step workflows. A relationship has a stable ID separate from its stored field, a declared target, cardinality, requiredness, and an explicit delete policy (`restrict`, `nullify`, or `cascade`). Cascade paths must be acyclic. Computed expressions use a small typed AST (field/literal, arithmetic, comparisons, boolean operations, conditionals, and relationship counts); expressions cannot call code, access the network, or name undeclared fields. Constraints include unique field groups, conditional uniqueness, non-negative numbers, and relationship capacity. Workflow steps can create, update, or delete declared records, navigate to a declared screen, or show bounded feedback. Inputs and current-record values are typed and validated.

Workflow execution is copy-on-write: all steps run against a private candidate state, then full collection, relationship, uniqueness, capacity, and record-limit validation runs before the candidate can replace the displayed state. Any failed step leaves the source data unchanged. The native React V3 preview resolves relationship labels, renders computed values, links related records, and exposes workflow availability with an accessible reason. V3 data uses `buildloop-runtime-v3:<projectId>:<version>` envelopes, independently per version, under the same 64 KB per-version and 1.6 MB per-project limits. V2 keys and artifacts are not rewritten.

When a new V3 version follows V2 or V3, the migration planner matches collections, fields, and relationships by stable IDs, retaining V2 reference values when they match a declared V3 relationship. It reports added, removed, incompatible, and newly required relationships, and never guesses missing links. Migration builds and validates a target copy before persistence; if required links or changed constraints make that copy invalid, the target uses its valid seed with a visible warning and the source snapshot remains intact. V2-to-V3 and V3-to-V3 comparisons are derived from schemas and classify structural risk. The V3 regression fixtures cover volunteer shift registration and capacity, equipment checkout and return, and club attendance. Deterministic fixtures test runtime behavior, not live model quality.

## `buildloop-app-v4` and published shared apps

V4 extends the V3 artifact with declared roles, seeded demo users, collection permissions, field visibility, ownership predicates, and role allowlists for workflows. It remains declarative JSON interpreted by trusted BuildLoop code. Ownership predicates are limited to equality between a stored record field and the signed-in user's `id`, `displayName`, or a bounded profile field, optionally combined with `and`. Negation, disjunction, scripts, and free-form formulas are rejected so a predicate cannot invert an owner check. Public visibility is read-only; activity records are read-only and are returned only to roles with an explicit activity permission. Returned record fields are filtered on the server before JSON serialization.

The current platform stores published records in PostgreSQL, partitioned by app and environment. A publication selects an immutable saved version, validates a schema and security diff, migrates current production records, and switches the production pointer in one transaction. Permission changes and destructive schema changes require explicit review. Failed migration or stale-version checks leave production records and its pointer intact. Rollback applies the same migration checks to an earlier version; it does not rewind the live record snapshot. Mutations and audit events commit together. The prior SQLite repository remains available for legacy tests but is not the current authenticated platform runtime.

The platform uses Better Auth email/password accounts and real PostgreSQL memberships. The signed test identity endpoint is enabled only for a local development test server and is unavailable in production. V4 seeded personas remain available in the local Studio role preview, but published app requests resolve the signed-in account and its tenant membership on the server. Platform roles (owner, administrator, member) are distinct from the app roles defined by the artifact. Use same-origin mutation requests, session cookies, tenant-scoped queries, and server-side authorization; never treat a browser-supplied role as authority.

PostgreSQL row locks and optimistic expected-version checks serialize publication and runtime writes across app instances using the same database. Database constraints reinforce app/environment foreign keys and identity uniqueness. Realtime delivery is not implemented; clients reload after a successful or rejected mutation. Hosted infrastructure and external production traffic were not verified by this repository change.

## Change summaries and learner testing

V2 change summaries and the comparison surface are derived from adjacent validated artifacts and identify added, changed, and removed collections and fields, views and forms, navigation, actions, search and filters, metrics, defaults, and sample data. V1 comparisons continue to summarize block structure. These summaries describe artifact changes, not whether the app works. Suggested tasks help the learner decide what to try; the learner records the action, expectation, and observed result, then supplies focused feedback and a next goal before rebuilding and retesting against the migrated target snapshot.

## Compatibility, storage, and recovery

Studio continues using `buildloop-studio-v1`; existing project and V1 artifact data is retained and V1 previews continue through the V1 interpreter. Existing V2 artifacts already include collection, field, and screen IDs, so they remain valid without rewriting the artifact. Legacy V2 runtime maps are read through a compatibility path. V1 artifacts continue to open, but V1's block model has no typed collections to migrate. Missions remain in their own store. Runtime app records use a separate key space from the Studio project document. A failed or interrupted build leaves existing versions available and the brief retryable. If browser storage fails, the open project and preview remain usable for that session, though the change cannot survive a later refresh.

## Deliberate limits

V2 and V3 support small browser-local previews. V4 apps can use the authenticated PostgreSQL platform described above. V2 reference fields remain one-way links; V3/V4 relationships provide bounded relational behavior. There is no arbitrary generated network access, arbitrary HTML/CSS/JavaScript, package installation, or terminal/GitHub access. Deterministic fixtures cover representative shapes for regression; live generation still requires a configured OpenAI key and has to be evaluated separately.
