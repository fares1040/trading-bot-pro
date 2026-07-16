/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // هذا الإعداد يساعد في تجنب مشاكل الـ Static Generation
  output: 'standalone', 
};

module.exports = nextConfig;
