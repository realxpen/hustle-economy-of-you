import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hustle/types", "@hustle/ui"]
};

export default nextConfig;
