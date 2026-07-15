import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPrincipal } from '../auth/authenticated-principal.interface';

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>();
    return request.user;
  },
);
