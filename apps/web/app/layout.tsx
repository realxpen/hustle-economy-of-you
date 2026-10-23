import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./adaptive-foundation.css";
import "./glass-system.css";
import { HustleMobileNav } from "../components/navigation/hustle-mobile-nav";

export const metadata: Metadata = {
  title: "Hustle — The Economy of You",
  description: "Discover people through what they make, do, and share. Find Hustlers. Get It Done.",
  applicationName: "Hustle",
  appleWebApp: { capable: true, title: "Hustle", statusBarStyle: "default" }
};

export const viewport: Viewport = { themeColor: "#111111" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="h-skip-link" href="#hustle-page-content">Skip to content</a><div id="hustle-page-content" tabIndex={-1}>{children}</div><HustleMobileNav /></body></html>;
}
