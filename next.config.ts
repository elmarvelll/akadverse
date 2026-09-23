import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep secrets and bulky non-runtime files out of the serverless bundles. The Prisma-generated E-Learning client locates its
  // engine with a dynamic process.cwd() path, which makes Next trace the WHOLE project into every function that uses it; this
  // bounds what that pulls in (measured: it included .env* files, the 9 MB CCMAS PDF and scripts). None of these are read at runtime.
  outputFileTracingExcludes: {
    "*": ["./.env*", "./.cleanup-backups/**", "./.vercel/**", "./docs/**", "./scripts/**", "./prisma/migrations/**", "./src/lib/resources/**"],
  },
  images: {
    remotePatterns: [
      // Mock "Popular Products"/"Popular Skills" listings (see
      // services/marketplace/) are hotlinked from Unsplash.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Real product/business photos uploaded via
      // services/external_utils/cloudinary.ts — e.g. product search
      // results on the Explore page.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
    allowedDevOrigins: ["192.168.101.20"],
};

export default nextConfig;
