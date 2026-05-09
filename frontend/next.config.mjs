/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /api/* 요청을 backend 컨테이너로 프록시 — 외부엔 frontend 한 포트만 노출
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://backend:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
