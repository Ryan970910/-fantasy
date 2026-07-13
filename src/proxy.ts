import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

const AUTH_PAGES = ["/login", "/register"];
const PUBLIC_PATHS = [...AUTH_PAGES, "/api/nba", "/api/cron"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isAuthPage = AUTH_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Cron endpoints authenticate with CRON_SECRET inside their route handlers;
  // redirecting them here prevents Vercel Cron from ever reaching that check.
  if (isAuthPage && hasSessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
