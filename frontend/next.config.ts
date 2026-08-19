import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "live.staticflickr.com",
        pathname: "/**",
      },
    ],
  },
  allowedDevOrigins: ["192.168.0.23"],
};

module.exports = {
  allowedDevOrigins: ['*'],
}
export default nextConfig;
