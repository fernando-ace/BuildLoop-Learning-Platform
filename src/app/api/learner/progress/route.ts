import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";
import { readLearnerProgress, validateLearnerSnapshot, writeLearnerProgress } from "@/lib/platform/learner-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const learner = await requireIdentity(request);
    return Response.json({ learnerId: learner.id, progress: await readLearnerProgress(learner.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const learner = await requireIdentity(request);
    const body = await readJson(request, 1_100_000);
    if (!isRecord(body) || (body.expectedRevision !== null && (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 1))) {
      return Response.json({ error: "The learner progress could not be saved." }, { status: 400 });
    }
    const snapshot = validateLearnerSnapshot(body.progress);
    const progress = await writeLearnerProgress(learner.id, body.expectedRevision as number | null, snapshot);
    return Response.json({ progress }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}
