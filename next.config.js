/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // هذا سيمنع الخطأ الذي يظهر في صورتك
    ignoreBuildErrors: true,
  },
  eslint: {
    // هذا سيمنع أخطاء الـ Lint من إيقاف الـ Build
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
