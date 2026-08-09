import type { FastifyRequest } from 'fastify';

/** JWT claims issued at login/registration. */
export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JwtPayload;
}
