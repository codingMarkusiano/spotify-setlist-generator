import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify requires 127.0.0.1 (not "localhost") in HTTP redirect URIs, so we
  // run dev on 127.0.0.1. Next 15+ blocks dev-resource requests from non-host
  // origins by default — explicitly allow it here.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
