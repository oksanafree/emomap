import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE_NAME } from "./lib/session-cookie";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PATHS = ["/world", "/self", "/context", "/history", "/report"];

function getLocaleAndRest(pathname: string): { locale: string; rest: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return { locale, rest: "/" };
    if (pathname.startsWith(`/${locale}/`)) return { locale, rest: pathname.slice(locale.length + 1) };
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

function isProtectedPath(rest: string): boolean {
  return PROTECTED_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`));
}

export default async function middleware(request: NextRequest) {
  const { locale, rest } = getLocaleAndRest(request.nextUrl.pathname);

  if (isProtectedPath(rest)) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    let authenticated = false;

    if (sessionCookie) {
      try {
        const verifyUrl = new URL("/api/auth/verify", request.url);
        const res = await fetch(verifyUrl, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}` },
        });
        authenticated = res.ok;
      } catch {
        authenticated = false;
      }
    }

    if (!authenticated) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
