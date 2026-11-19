import { getPlatformRepository } from "@/lib/platform/repository";
import { isRecord, readJson, requireIdentity, responseForPlatformError, sameOrigin } from "@/lib/platform/http";
import { getPublicAppUrl } from "@/lib/platform/config";
import { sendInvitationEmail } from "@/lib/platform/email";
import { operationLimitResponse } from "@/lib/platform/rate-limit";

export const runtime = "nodejs";
type Context = { params: Promise<{ appId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireIdentity(request);
    const { appId } = await context.params;
    return Response.json({ invitations: await getPlatformRepository().listInvitations(user, appId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request);
    const body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.appRole !== "string" || body.email !== undefined && typeof body.email !== "string") return Response.json({ error: "Choose a role and an optional email address." }, { status: 400 });
    const { appId } = await context.params;
    const limited = await operationLimitResponse(`invitation-create:${user.id}`, 5, 900, "Too many invitations were created recently. Try again later.");
    if (limited) return limited;
    const invitation = await getPlatformRepository().createInvitation(user, appId, body.appRole, body.email as string | undefined);
    const url = new URL(`/invite/${encodeURIComponent(invitation.token)}`, getPublicAppUrl(request.url)).toString();
    const delivery = body.email ? await sendInvitationEmail({ recipient: body.email.trim(), accountName: invitation.accountName, inviterName: user.name, expiresAt: invitation.expiresAt, invitationUrl: url }) : "link_only";
    return Response.json({ invitation: { id: invitation.id, url, expiresAt: invitation.expiresAt }, delivery }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function PATCH(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request), body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.invitationId !== "string") return Response.json({ error: "Choose an invitation to resend." }, { status: 400 });
    const { appId } = await context.params;
    const limited = await operationLimitResponse(`invitation-resend:${user.id}`, 3, 900, "Too many invitation emails were requested recently. Try again later.");
    if (limited) return limited;
    const invitation = await getPlatformRepository().resendInvitation(user, appId, body.invitationId);
    const url = new URL(`/invite/${encodeURIComponent(invitation.token)}`, getPublicAppUrl(request.url)).toString();
    const delivery = await sendInvitationEmail({ recipient: invitation.email, accountName: invitation.accountName, inviterName: user.name, expiresAt: invitation.expiresAt, invitationUrl: url });
    return Response.json({ invitation: { id: invitation.id, url, expiresAt: invitation.expiresAt }, delivery }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}

export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return Response.json({ error: "The request could not be accepted." }, { status: 403 });
  try {
    const user = await requireIdentity(request), body = await readJson(request, 4_000);
    if (!isRecord(body) || typeof body.invitationId !== "string") return Response.json({ error: "Choose an invitation to revoke." }, { status: 400 });
    await getPlatformRepository().revokeInvitation(user, (await context.params).appId, body.invitationId);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseForPlatformError(error, request); }
}
