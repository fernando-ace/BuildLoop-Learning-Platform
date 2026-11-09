import "server-only";
import { getPlatformPool } from "./database";
import { PlatformError } from "./repository";

const stages = new Set(["idea", "scope", "brief", "try", "feedback", "goal", "retest", "summary"]);
const noteFields = ["user", "problem", "why", "behavior", "constraints", "instruction", "brief", "nextGoal", "shareDecision"] as const;
export interface StudioLearnerSnapshot {
  stage: string;
  projectNotes: Record<string, unknown>;
  features: unknown[];
  observations: unknown[];
  feedback: unknown[];
  versionNotes: unknown[];
}
export interface StoredStudioLearnerProgress extends StudioLearnerSnapshot { appId: string; revision: number; updatedAt: string; archived: boolean; }

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }

function isBoundedText(value: unknown, limit = 5_000): value is string { return typeof value === "string" && value.length <= limit; }

export function validateStudioLearnerSnapshot(value: unknown): StudioLearnerSnapshot {
  if (!isObject(value) || typeof value.stage !== "string" || !stages.has(value.stage) || !isObject(value.projectNotes)
    || !Array.isArray(value.features) || !Array.isArray(value.observations) || !Array.isArray(value.feedback) || !Array.isArray(value.versionNotes)) {
    throw new PlatformError("invalid", "The Studio learning record could not be saved.");
  }
  for (const key of noteFields) {
    const note = value.projectNotes[key];
    if (key === "brief") {
      if (note !== null && (!isObject(note) || !isBoundedText(note.user) || !isBoundedText(note.problem) || !isBoundedText(note.behavior) || !isBoundedText(note.constraints)
        || !Array.isArray(note.scope) || note.scope.length > 100 || !note.scope.every((item) => isBoundedText(item, 1_000)))) throw new PlatformError("invalid", "The Studio learning record could not be saved.");
    } else if (!isBoundedText(note, 10_000)) throw new PlatformError("invalid", "A Studio note is too long to save.");
  }
  const featuresValid = value.features.length <= 500 && value.features.every((feature) => isObject(feature) && isBoundedText(feature.id, 200) && isBoundedText(feature.text, 1_000) && typeof feature.inV1 === "boolean");
  const observationsValid = value.observations.length <= 500 && value.observations.every((item) => isObject(item) && isBoundedText(item.action) && isBoundedText(item.expected) && isBoundedText(item.happened)
    && (item.kind === "core" || item.kind === "nearby") && Number.isInteger(item.version) && Number(item.version) > 0);
  const feedbackValid = value.feedback.length <= 500 && value.feedback.every((item) => isObject(item) && isBoundedText(item.from, 300) && isBoundedText(item.note) && Number.isInteger(item.version) && Number(item.version) > 0);
  const versionNotesValid = value.versionNotes.length <= 100 && value.versionNotes.every((item) => isObject(item) && Number.isInteger(item.number) && Number(item.number) > 0
    && isBoundedText(item.instruction, 10_000) && isBoundedText(item.builtAt, 100) && isBoundedText(item.notes, 10_000) && typeof item.tested === "boolean" && Array.isArray(item.observations) && item.observations.length <= 100
    && item.observations.every((note) => isBoundedText(note)) && Array.isArray(item.feedback) && item.feedback.length <= 100 && item.feedback.every((note) => isBoundedText(note))
    && (item.retestedVersion === undefined || item.retestedVersion === null || Number.isInteger(item.retestedVersion)));
  if (!featuresValid || !observationsValid || !feedbackValid || !versionNotesValid || JSON.stringify(value).length > 400_000) throw new PlatformError("invalid", "The Studio learning record is too large or incomplete to save.");
  if (value.projectNotes.shareDecision !== "" && value.projectNotes.shareDecision !== "ready" && value.projectNotes.shareDecision !== "keep_working") {
    throw new PlatformError("invalid", "The Studio learning record could not be saved.");
  }
  return value as unknown as StudioLearnerSnapshot;
}

function mapRow(row: Record<string, unknown>): StoredStudioLearnerProgress {
  return {
    appId: String(row.app_id), stage: String(row.stage), projectNotes: row.project_notes as Record<string, unknown>,
    features: row.features as unknown[], observations: row.observations as unknown[], feedback: row.feedback as unknown[], versionNotes: row.version_notes as unknown[],
    revision: Number(row.revision), updatedAt: new Date(String(row.updated_at)).toISOString(), archived: row.archived === true,
  };
}

export async function listStudioLearnerProgress(userId: string): Promise<StoredStudioLearnerProgress[]> {
  const result = await getPlatformPool().query(
    "SELECT p.app_id,p.stage,p.project_notes,p.features,p.observations,p.feedback,p.version_notes,p.revision,p.updated_at,p.archived FROM studio_learner_progress p JOIN application_memberships m ON m.app_id=p.app_id AND m.user_id=$1 WHERE p.user_id=$1 ORDER BY p.updated_at DESC",
    [userId],
  );
  return result.rows.map(mapRow);
}

export async function listStudioApplications(userId: string) {
  const result = await getPlatformPool().query(
    `SELECT a.id,a.project_id AS "projectId",a.name,CASE WHEN sp.owner_user_id=$1 THEN sp.brief ELSE '{}'::jsonb END AS brief,sp.created_at AS "createdAt",
      COALESCE(jsonb_agg(jsonb_build_object(
        'number',v.version_number,'versionId',v.version_id,'title',v.artifact->>'title','description',v.artifact->>'summary',
        'provider',COALESCE(v.metadata->>'provider','demo'),
        'attempts',CASE WHEN v.metadata->>'attempts' ~ '^[0-9]{1,3}$' THEN (v.metadata->>'attempts')::integer ELSE 1 END,'builtAt',v.created_at
      ) ORDER BY v.version_number) FILTER (WHERE v.version_id IS NOT NULL), '[]'::jsonb) AS versions
    FROM applications a
    JOIN application_memberships m ON m.app_id=a.id AND m.user_id=$1
    JOIN studio_projects sp ON sp.id=a.project_id
    LEFT JOIN application_versions v ON v.app_id=a.id
    LEFT JOIN studio_learner_progress lp ON lp.app_id=a.id AND lp.user_id=$1
    WHERE COALESCE(lp.archived,false)=false
    GROUP BY a.id,sp.id
    ORDER BY sp.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function archiveStudioProject(userId: string, appId: string) {
  const client = await getPlatformPool().connect();
  try {
    const membership = await client.query("SELECT 1 FROM application_memberships WHERE app_id=$1 AND user_id=$2", [appId, userId]);
    if (!membership.rowCount) throw new PlatformError("not_found", "That Studio project is unavailable to your account.");
    await client.query(
      "INSERT INTO studio_learner_progress(user_id,app_id,archived) VALUES($1,$2,true) ON CONFLICT(user_id,app_id) DO UPDATE SET stage='idea',project_notes='{}'::jsonb,features='[]'::jsonb,observations='[]'::jsonb,feedback='[]'::jsonb,version_notes='[]'::jsonb,archived=true,revision=studio_learner_progress.revision+1,updated_at=now()",
      [userId, appId],
    );
  } finally { client.release(); }
}

export async function writeStudioLearnerProgress(userId: string, appId: string, expectedRevision: number | null, value: StudioLearnerSnapshot): Promise<StoredStudioLearnerProgress> {
  const pool = getPlatformPool();
  const client = await pool.connect();
  try {
    const membership = await client.query("SELECT 1 FROM application_memberships WHERE app_id=$1 AND user_id=$2", [appId, userId]);
    if (!membership.rowCount) throw new PlatformError("not_found", "That Studio project is unavailable to your account.");
    const params = [userId, appId, value.stage, JSON.stringify(value.projectNotes), JSON.stringify(value.features), JSON.stringify(value.observations), JSON.stringify(value.feedback), JSON.stringify(value.versionNotes)];
    const columns = "user_id,app_id,stage,project_notes,features,observations,feedback,version_notes";
    let result;
    if (expectedRevision === null) {
      result = await client.query(
        `INSERT INTO studio_learner_progress (${columns}) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb) ON CONFLICT(user_id,app_id) DO NOTHING RETURNING *`,
        params,
      );
    } else {
      result = await client.query(
        "UPDATE studio_learner_progress SET stage=$3,project_notes=$4::jsonb,features=$5::jsonb,observations=$6::jsonb,feedback=$7::jsonb,version_notes=$8::jsonb,revision=revision+1,updated_at=now() WHERE user_id=$1 AND app_id=$2 AND revision=$9 RETURNING *",
        [...params, expectedRevision],
      );
    }
    if (result.rows[0]) return mapRow(result.rows[0]);
    throw new PlatformError("conflict", "This Studio learning record changed on another device. Reload or choose which copy to keep.");
  } finally { client.release(); }
}
