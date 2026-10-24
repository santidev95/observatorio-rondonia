import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    agentUpgrade: "security",
  },
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
};
export default config;
