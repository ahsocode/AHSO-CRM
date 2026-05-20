import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/admin/ai-providers/callback"
]);
const REFRESH_COOKIE = "ahso_refresh_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasRefreshToken ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    if (hasRefreshToken && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (!hasRefreshToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|offline.html|.*\\..*).*)"
  ]
};
