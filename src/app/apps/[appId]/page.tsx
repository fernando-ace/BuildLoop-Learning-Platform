import { PublishedApp } from "@/app/components/published-app";

export const dynamic = "force-dynamic";

export default async function PublishedAppPage({ params, searchParams }: { params: Promise<{ appId: string }>; searchParams: Promise<{ environment?: string }> }) {
  const { appId } = await params;
  const { environment } = await searchParams;
  return <PublishedApp appId={appId} environment={environment === "preview" ? "preview" : "production"} />;
}
