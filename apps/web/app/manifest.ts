import type { MetadataRoute } from "next";

/**
 * Hustle Mobile V1 / UX004 installation identity.
 * The PWA runs the existing real Next.js routes; it does not create demo data
 * or override native app authentication.
 */
export default function manifest(): MetadataRoute.Manifest {
  const awsPreview = process.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW === "true";
  return {
    id: awsPreview ? "/aws-test" : "/home",
    name: awsPreview ? "Hustle AWS Test — The Economy of You" : "Hustle — The Economy of You",
    short_name: awsPreview ? "Hustle AWS" : "Hustle",
    description: "Find Hustlers. Get It Done. Discover people through their work.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#121714",
    theme_color: "#121714",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "maskable" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "any" }
    ],
    shortcuts: [
      { name: "Explore", short_name: "Explore", url: "/search" },
      { name: "Create", short_name: "Create", url: "/posts/new" },
      { name: "Inbox", short_name: "Inbox", url: "/messages" }
    ]
  };
}
