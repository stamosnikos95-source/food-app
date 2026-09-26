/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pure static site: all data comes from the API at runtime (JWT in the
  // browser), so it can be hosted on any CDN without a Node server.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@food-app/design-tokens", "@food-app/shared-types"],
  // Type-checking still runs during build; linting runs separately.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
