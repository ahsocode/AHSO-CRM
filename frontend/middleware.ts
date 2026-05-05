import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
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
    "/admin/:path*",
    "/notifications/:path*",
    "/customers/:path*",
    "/projects/:path*",
    "/quotes/:path*",
    "/contracts/:path*",
    "/activities/:path*",
    "/calendar/:path*",
    "/reports/:path*",
    "/users/:path*",
    "/documents/:path*",
    "/login",
    "/forgot-password",
    "/reset-password"
  ]
};
