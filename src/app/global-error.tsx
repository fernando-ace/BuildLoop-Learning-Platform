"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <html lang="en"><body><main><h1>BuildLoop hit a problem</h1><p>Your saved account apps and versions are still in your account. Try this page again.</p><button type="button" onClick={reset}>Try again</button></main></body></html>;
}
