import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import pkg from "./package.json";

// Short commit for the footer build stamp. Prefer the CI-provided SHA, then
// fall back to git, then to "unknown" so a missing git never breaks a build.
function resolveCommit(): string {
  const fromEnv = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  // Inlined at build time so client components can read them.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: resolveCommit(),
  },
  // All dev origins are allowed so the site works over the local network.
  allowedDevOrigins: ["192.168.0.23", "localhost"],
};

export default nextConfig;
