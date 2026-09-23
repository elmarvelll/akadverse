import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep secrets and bulky non-runtime files out of the serverless bundles. Originally added because bundling the
  // Prisma-generated E-Learning client traced the WHOLE project (measured: .env* files, the 9 MB CCMAS PDF, scripts); that
  // client is now loaded natively (see src/lib/db/elearning.ts), so this is a guard rather than the fix. None are read at runtime.
  outputFileTracingExcludes: {
    "*": ["./.env*", "./.cleanup-backups/**", "./.vercel/**", "./docs/**", "./scripts/**", "./prisma/migrations/**", "./src/lib/resources/**"],
  },
  // src/lib/db/elearning.ts loads the E-Learning Prisma client with a native require that Turbopack deliberately doesn't
  // follow, so the files that client needs at runtime (its entry, runtime, schema and the platform's query engine
  // binary) must be traced explicitly. Keep in sync with prisma/elearning/schema.prisma's generator `output`.
  outputFileTracingIncludes: {
    "/*": [
      "./src/generated/prisma-elearning/package.json",
      "./src/generated/prisma-elearning/index.js",
      "./src/generated/prisma-elearning/runtime/library.js",
      "./src/generated/prisma-elearning/schema.prisma",
      "./src/generated/prisma-elearning/libquery_engine-*",
    ],
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
