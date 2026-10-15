import { describe, expect, it } from "vitest";
import { v2Fixtures } from "./v2";
import { describeSchemaChanges, diffApplicationSchemas } from "./schema-diff";

describe("declarative app schema comparison", () => {
  it("tracks stable collection and field identities through label and field changes", () => {
    const before = structuredClone(v2Fixtures[2]);
    const after = structuredClone(before);
    after.title = "Study tracker";
    after.collections[0].label = "Study topics";
    after.collections[0].fields[0].label = "Topic name";
    after.collections[0].fields.push({ id: "due_date", label: "Due date", type: "date", required: true, default: "2026-10-20" });
    after.screens[0].title = "Topics to review";
    after.screens[0].search = false;
    after.screens[0].filters = [];
    after.navigation = [{ label: "Review", screen: after.screens[0].id }];
    after.metrics.push({ id: "topic_count", label: "Topics", op: "count", collection: "tasks" });
    after.actions.push({ id: "new_action", label: "Start review", type: "navigate", screen: "new_task" });

    const changes = diffApplicationSchemas(before, after);
    expect(changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "collection-renamed", collectionId: "tasks" }),
      expect.objectContaining({ kind: "field-relabeled", collectionId: "tasks", fieldId: "title" }),
      expect.objectContaining({ kind: "field-added", collectionId: "tasks", fieldId: "due_date" }),
      expect.objectContaining({ kind: "view-renamed", itemId: "tasks" }),
      expect.objectContaining({ kind: "search-changed", itemId: "tasks" }),
      expect.objectContaining({ kind: "filter-changed", itemId: "tasks" }),
      expect.objectContaining({ kind: "navigation-changed" }),
      expect.objectContaining({ kind: "metric-added", itemId: "topic_count" }),
      expect.objectContaining({ kind: "action-added", itemId: "new_action" }),
    ]));
    expect(describeSchemaChanges(changes)).toContain("Added Due Date to Tasks");
  });

  it("reports removed and incompatible fields as destructive and remains deterministic", () => {
    const before = structuredClone(v2Fixtures[2]);
    const after = structuredClone(before);
    after.collections[0].fields = after.collections[0].fields.filter((field) => field.id !== "owner");
    after.collections[0].fields = after.collections[0].fields.map((field) => field.id === "priority" ? { id: "priority", label: field.label, type: "text" as const } : field);
    const first = diffApplicationSchemas(before, after);
    expect(first).toEqual(diffApplicationSchemas(before, after));
    expect(first).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "field-removed", fieldId: "owner", destructive: true }),
      expect.objectContaining({ kind: "field-type-incompatible", fieldId: "priority", destructive: true }),
    ]));
  });
});
