import type { NextConfig } from "next";

const CREATOR_URL = process.env.NEXT_PUBLIC_CREATOR_URL ?? "https://tether-frontend.vercel.app";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      {
        source:      "/c/:username",
        destination: `${CREATOR_URL}/c/:username`,
        permanent:   false,
      },
    ];
  },
};

export default nextConfig;
