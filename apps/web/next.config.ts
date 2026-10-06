import type { NextConfig } from "next";

const hustleApiUrl = process.env.HUSTLE_API_URL?.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hustle/types", "@hustle/ui"],
  async rewrites() {
    if (!hustleApiUrl) return [];

    return {
      beforeFiles: [
        {
          source: "/api/hustle/:path*",
          destination: `${hustleApiUrl}/:path*`
        }
      ],
      afterFiles: [],
      fallback: []
    };
  }
};

export default nextConfig;
