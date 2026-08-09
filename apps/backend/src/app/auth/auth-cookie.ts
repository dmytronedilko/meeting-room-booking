import type { CookieSerializeOptions } from '@fastify/cookie';
import type { FastifyReply } from 'fastify';

/** Name of the HttpOnly session cookie carrying the JWT. */
export const AUTH_COOKIE = 'token';

/** Matches the 24h JWT TTL. */
const COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

function cookieOptions(): CookieSerializeOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // The stack is served over plain http on localhost; flip to true under TLS.
    secure: process.env['COOKIE_SECURE'] === 'true',
  };
}

export function setAuthCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(AUTH_COOKIE, token, { ...cookieOptions(), maxAge: COOKIE_MAX_AGE_SECONDS });
}

export function clearAuthCookie(reply: FastifyReply): void {
  reply.clearCookie(AUTH_COOKIE, cookieOptions());
}
