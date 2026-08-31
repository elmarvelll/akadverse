import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
