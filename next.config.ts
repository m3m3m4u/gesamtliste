import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://diler.schuleamsee.at;",
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://diler.schuleamsee.at',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
