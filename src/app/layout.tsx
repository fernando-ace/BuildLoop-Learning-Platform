import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildLoop — The Missing Cameras",
  description: "Learn the product-building loop by helping Ari solve a real problem.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
