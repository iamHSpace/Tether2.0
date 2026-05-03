import type { NextConfig } from "next";

// CORS is handled dynamically in middleware.ts so that both localhost and
// 127.0.0.1 origins are supported without hardcoding a single allowed origin.
const nextConfig: NextConfig = {};

export default nextConfig;
