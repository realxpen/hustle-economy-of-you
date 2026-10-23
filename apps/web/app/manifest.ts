import type { MetadataRoute } from "next";

/**
 * Hustle Mobile V1 / UX004 installation identity.
 * The PWA runs the existing real Next.js routes; it does not create demo data
 * or override native app authentication.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Hustle — The Economy of You",
    short_name: "Hustle",
    description: "Find Hustlers. Get It Done. Discover people through their work.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#121714",
    theme_color: "#121714",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any maskable" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180", purpose: "any" }
    ],
    shortcuts: [
      { name: "Explore", short_name: "Explore", url: "/search" },
      { name: "Create", short_name: "Create", url: "/posts/new" },
      { name: "Inbox", short_name: "Inbox", url: "/messages" }
    ]
  };
}
