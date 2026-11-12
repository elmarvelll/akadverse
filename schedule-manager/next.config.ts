import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  // Keep this standalone app from inheriting the host's root and build inputs.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
