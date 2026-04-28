import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable strict-mode double-invoke of effects. Our /wizard/generating
  // page kicks off a long-running LLM pipeline in useEffect; letting
  // strict mode cancel-and-restart burns tokens and leaks draft articles.
  // Prod behaviour (single invoke) matches this setting, so dev is now
  // faithful to what the user will actually see.
  reactStrictMode: false,
};

export default nextConfig;
