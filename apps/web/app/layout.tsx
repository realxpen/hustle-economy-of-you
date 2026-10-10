import type { Metadata } from "next";
import "./globals.css";
import { HustleMobileNav } from "../components/navigation/hustle-mobile-nav";

export const metadata: Metadata = {
  title: "Hustle — The Economy of You",
  description: "Discover people through what they make, do, and share. Find Hustlers. Get It Done."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="h-skip-link" href="#hustle-page-content">Skip to content</a><div id="hustle-page-content" tabIndex={-1}>{children}</div><HustleMobileNav /></body></html>;
}
