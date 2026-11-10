import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // shortcut: strict mode off because the dev double-mount starts two Vapi calls; turn on again when the call start moves out of the effect.
  reactStrictMode: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
