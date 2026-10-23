import type { MetadataRoute } from "next";

// No service-worker caching: auth, inbox, bookings and wallet always need
// an authoritative live response. A Home Screen install is not an offline app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Hustle — The Economy of You",
    short_name: "Hustle",
    description: "Discover, trust and connect with skilled people through their work.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#efede6",
    theme_color: "#111111",
    icons: [
      { src: "/apple-icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }
    ]
  };
}
