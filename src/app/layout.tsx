import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildLoop — Learn to build real things with AI",
  description: "Practice taking a real problem from first questions to a useful product.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
