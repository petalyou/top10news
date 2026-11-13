import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // rss-parser is a server-only Node package.
  serverExternalPackages: ["rss-parser"],
};

export default nextConfig;
