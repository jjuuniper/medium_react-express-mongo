import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Enable standalone output for Docker deployment
  outputFileTracingRoot: process.cwd(), // Moved out of experimental in Next.js 15
};

export default nextConfig;
