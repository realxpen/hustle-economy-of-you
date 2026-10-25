import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./adaptive-foundation.css";
import "./glass-system.css";
import { HustleMobileNav } from "../components/navigation/hustle-mobile-nav";

export const metadata: Metadata = {
  title: "Hustle — The Economy of You",
  description: "Discover people through what they make, do, and share. Find Hustlers. Get It Done.",
  applicationName: "Hustle",
  manifest: process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW === "true" ? "/aws-test.webmanifest" : "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hustle", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/apple-icon" },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121714"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const awsPreview = process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW === "true";
  return <html lang="en"><body>
    <a className="h-skip-link" href="#hustle-page-content">Skip to content</a>
    {awsPreview && <div className="h-aws-preview-banner" role="status">
      <strong>HUSTLE · AWS TEST</strong><span>Simulated transactions only · Separate from the regular staging app</span>
    </div>}
    <div id="hustle-page-content" tabIndex={-1}>{children}</div><HustleMobileNav />
  </body></html>;
}
