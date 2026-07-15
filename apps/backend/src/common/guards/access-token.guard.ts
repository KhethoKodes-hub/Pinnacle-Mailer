import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedPrincipal } from '../auth/authenticated-principal.interface';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { AuthService } from '../../modules/auth/auth.service';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedPrincipal }>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const principal = this.authService.verifyAccessToken(token);
    request.user = principal;

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScopes?.length) {
      return true;
    }

    if (principal.scopes.includes('admin')) {
      return true;
    }

    const hasAllScopes = requiredScopes.every((scope) => principal.scopes.includes(scope));
    if (!hasAllScopes) {
      throw new UnauthorizedException('Insufficient scope');
    }

    return true;
  }
}
