import { PublishedApp } from "@/app/components/published-app";

export const dynamic = "force-dynamic";

export default async function PublishedAppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  return <PublishedApp appId={appId} />;
}
