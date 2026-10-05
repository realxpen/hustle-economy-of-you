import type { NextConfig } from "next";

const supabaseTarget = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hustle/types", "@hustle/ui"],
  async rewrites() {
    if (!supabaseTarget) return [];
    return [
      {
        source: "/_supabase/:path*",
        destination: `${supabaseTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
