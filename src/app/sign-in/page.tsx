import { AuthForm } from "@/app/components/auth-form";
import { allowPreviewUnverifiedSignups, getPublicAppUrl } from "@/lib/platform/config";

export const dynamic = "force-dynamic";

export default function SignInPage() { return <AuthForm publicAppUrl={getPublicAppUrl()} allowUnverifiedPreviewSignup={allowPreviewUnverifiedSignups()} />; }
