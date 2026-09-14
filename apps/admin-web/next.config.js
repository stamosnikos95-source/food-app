/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@food-app/design-tokens", "@food-app/shared-types"],
};

module.exports = nextConfig;
