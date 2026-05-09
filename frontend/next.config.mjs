/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // /api/* + Swagger 관련 경로를 backend 컨테이너로 프록시 — 외부엔 frontend 한 포트만 노출
  async rewrites() {
    const backend = process.env.BACKEND_URL || "http://backend:8000";
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      // Swagger UI / OpenAPI / ReDoc — 외부에서도 /docs 접근 가능
      { source: "/docs", destination: `${backend}/docs` },
      { source: "/redoc", destination: `${backend}/redoc` },
      { source: "/openapi.json", destination: `${backend}/openapi.json` },
    ];
  },
};
export default nextConfig;
