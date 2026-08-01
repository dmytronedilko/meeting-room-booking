import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, JwtPayload } from '../../auth/auth.types';

/** Extracts the JWT payload attached to the request by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
