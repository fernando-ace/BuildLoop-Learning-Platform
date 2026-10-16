import { InvitationAccept } from "@/app/components/invitation-accept";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return <InvitationAccept token={(await params).token} />;
}
