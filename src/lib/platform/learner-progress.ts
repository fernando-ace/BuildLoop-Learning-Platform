import "server-only";
import { getPlatformPool } from "./database";
import { PlatformError } from "./repository";

const fields = [
  ["activeMission", "active_mission"],
  ["mission1State", "mission_1_state"], ["mission1Progress", "mission_1_progress"],
  ["mission2State", "mission_2_state"], ["mission2Progress", "mission_2_progress"], ["mission2AttemptCount", "mission_2_attempt_count"],
  ["mission3State", "mission_3_state"], ["mission3Progress", "mission_3_progress"],
  ["mission4State", "mission_4_state"], ["mission4Progress", "mission_4_progress"],
  ["mission5State", "mission_5_state"], ["mission5Progress", "mission_5_progress"],
  ["mission6State", "mission_6_state"], ["mission6Progress", "mission_6_progress"],
] as const;

export type LearnerSnapshot = Record<(typeof fields)[number][0], unknown>;
export interface StoredLearnerProgress extends LearnerSnapshot { revision: number; updatedAt: string; }

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateLearnerSnapshot(value: unknown): LearnerSnapshot {
  if (!isObject(value) || !Number.isInteger(value.activeMission) || Number(value.activeMission) < 0 || Number(value.activeMission) > 6) {
    throw new PlatformError("invalid", "The learner progress could not be saved.");
  }
  for (const [key] of fields.slice(1)) {
    if (key === "mission2AttemptCount") {
      if (!Number.isInteger(value[key]) || Number(value[key]) < 0) throw new PlatformError("invalid", "The learner progress could not be saved.");
    } else if (!isObject(value[key])) throw new PlatformError("invalid", "The learner progress could not be saved.");
  }
  if (JSON.stringify(value).length > 1_000_000) throw new PlatformError("invalid", "The learner progress is too large to save.");
  return value as LearnerSnapshot;
}

function mapRow(row: Record<string, unknown>): StoredLearnerProgress {
  const record: Record<string, unknown> = {};
  for (const [key, column] of fields) record[key] = row[column];
  record.revision = row.revision;
  record.updatedAt = new Date(String(row.updated_at)).toISOString();
  return record as unknown as StoredLearnerProgress;
}

export async function readLearnerProgress(userId: string): Promise<StoredLearnerProgress | null> {
  const result = await getPlatformPool().query("SELECT * FROM learner_progress WHERE user_id = $1", [userId]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

/** Compare-and-swap prevents one browser from silently replacing a newer device's checkpoint. */
export async function writeLearnerProgress(userId: string, expectedRevision: number | null, snapshot: LearnerSnapshot): Promise<StoredLearnerProgress> {
  const columns = fields.map(([, column]) => `"${column}"`);
  const values = fields.map(([key]) => snapshot[key]);
  const jsonIndexes = new Set([1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13]);
  const valueSql = fields.map((_, index) => `$${index + 2}${jsonIndexes.has(index) ? "::jsonb" : ""}`);
  const client = await getPlatformPool().connect();
  try {
    let result;
    if (expectedRevision === null) {
      const insertValues = values.map((value, index) => jsonIndexes.has(index) ? JSON.stringify(value) : value);
      result = await client.query(
        `INSERT INTO learner_progress (user_id, ${columns.join(", ")}) VALUES ($1, ${valueSql.join(", ")}) ON CONFLICT (user_id) DO NOTHING RETURNING *`,
        [userId, ...insertValues],
      );
    } else {
      const updateAssignments = fields.map(([, column], index) => `"${column}" = $${index + 2}${jsonIndexes.has(index) ? "::jsonb" : ""}`);
      updateAssignments.push(`revision = revision + 1`, "updated_at = now()");
      const updateValues = values.map((value, index) => jsonIndexes.has(index) ? JSON.stringify(value) : value);
      result = await client.query(
        `UPDATE learner_progress SET ${updateAssignments.join(", ")} WHERE user_id = $1 AND revision = $${values.length + 2} RETURNING *`,
        [userId, ...updateValues, expectedRevision],
      );
    }
    if (result.rows[0]) return mapRow(result.rows[0]);
    const current = await readLearnerProgress(userId);
    throw new PlatformError("conflict", current ? "This learning record changed on another device. Reload it before saving again." : "The learning record could not be initialized. Try again.");
  } finally { client.release(); }
}
