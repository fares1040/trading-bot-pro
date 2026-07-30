// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    MASSIVE_API_KEY: process.env.MASSIVE_API_KEY,
  },
};

module.exports = nextConfig;
