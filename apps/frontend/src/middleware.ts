import { type NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE = 'token';
const AUTH_PAGES = ['/login', '/register'];
// Reachable regardless of auth state (the email-confirmation landing page).
const PUBLIC_PAGES = ['/confirm-email'];

/**
 * Extracts the `exp` claim without verifying the signature — verification
 * requires the JWT secret, which belongs to the backend only. This check
 * exists to route obviously-expired sessions straight to /login; a forged
 * token still fails on the first API call (401 → client clears state).
 */
function isTokenAlive(token: string): boolean {
  const payloadPart = token.split('.')[1];
  if (!payloadPart) {
    return false;
  }
  try {
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Server-side route protection. The JWT travels in an HttpOnly cookie, so the
 * Next.js server sees it on every request (same host in dev, same origin
 * behind the Nginx proxy in Docker) and can redirect before any protected page renders —
 * no client-side guard, no flash of skeletons for anonymous visitors.
 */
export function middleware(request: NextRequest): NextResponse {
  if (PUBLIC_PAGES.some((page) => request.nextUrl.pathname.startsWith(page))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const authenticated = !!token && isTokenAlive(token);
  const isAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);

  if (!authenticated && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  if (authenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)).*)'],
};
