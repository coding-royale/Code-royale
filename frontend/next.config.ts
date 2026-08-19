import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All dev origins are allowed so the site works over the local network.
  allowedDevOrigins: ["192.168.0.23", "localhost"],
};

export default nextConfig;
