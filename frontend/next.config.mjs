const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const backendOrigin = (() => {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return "http://localhost:3001";
  }
})();
const backendWebSocketOrigin = backendOrigin.replace(/^http/, "ws");

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${backendOrigin} ${backendWebSocketOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Prevent webpack from bundling jsdom (used by isomorphic-dompurify server-side).
  // Without this, webpack replaces __dirname with the bundle output path, causing
  // jsdom to fail when looking for its default-stylesheet.css at build time.
  serverExternalPackages: ["jsdom", "isomorphic-dompurify"],
  experimental: {
    typedRoutes: true
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
