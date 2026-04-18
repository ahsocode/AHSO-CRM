import { NextRequest, NextResponse } from "next/server";

const ACCESS_TOKEN_KEY = "ahso_access_token";
const REFRESH_TOKEN_KEY = "ahso_refresh_token";
const PUBLIC_ROUTES = ["/login", "/forgot-password"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/customers",
  "/projects",
  "/quotes",
  "/contracts",
  "/calendar",
  "/reports"
] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = Boolean(request.cookies.get(ACCESS_TOKEN_KEY)?.value);
  const hasRefreshToken = Boolean(request.cookies.get(REFRESH_TOKEN_KEY)?.value);
  const isAuthenticated = hasAccessToken || hasRefreshToken;
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isProtectedRoute = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = isAuthenticated ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  if (!isAuthenticated && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthenticated && isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/customers/:path*",
    "/projects/:path*",
    "/quotes/:path*",
    "/contracts/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/login",
    "/forgot-password"
  ]
};
