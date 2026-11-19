import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";
import { archiveStudioProject, listStudioApplications, listStudioLearnerProgress, validateStudioLearnerSnapshot, writeStudioLearnerProgress } from "@/lib/platform/studio-learner-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const learner = await requireIdentity(request);
    const [applications, learningRecords] = await Promise.all([
      listStudioApplications(learner.id),
      listStudioLearnerProgress(learner.id),
    ]);
    return Response.json({ learnerId: learner.id, applications, learningRecords }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const learner = await requireIdentity(request);
    const body = await readJson(request, 420_000);
    if (!isRecord(body) || typeof body.appId !== "string" || body.appId.length > 80
      || (body.expectedRevision !== null && (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 1))) {
      return Response.json({ error: "The Studio learning record could not be saved." }, { status: 400 });
    }
    const learningRecord = validateStudioLearnerSnapshot(body.learningRecord);
    const record = await writeStudioLearnerProgress(learner.id, body.appId, body.expectedRevision as number | null, learningRecord);
    return Response.json({ record }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const learner = await requireIdentity(request);
    const appId = new URL(request.url).searchParams.get("appId");
    if (!appId || appId.length > 80) return Response.json({ error: "Choose a Studio project to remove." }, { status: 400 });
    await archiveStudioProject(learner.id, appId);
    return Response.json({ archived: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}
