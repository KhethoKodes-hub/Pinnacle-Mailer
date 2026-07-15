import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { ClientTokenDto } from './dto/client-token.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: LoginDto, requestId?: string) {
    const user = await this.usersService.findByEmail(input.email);
    const hash = createHash('sha256').update(input.password).digest('hex');

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      this.throwLockoutException(user.lockedUntil);
    }

    if (user?.passwordHash !== hash) {
      if (user) {
        const failedAttempt = await this.registerFailedLoginAttempt(user.id, requestId);
        if (failedAttempt.lockedUntil) {
          this.throwLockoutException(failedAttempt.lockedUntil);
        }
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const refreshTokenPair = await this.issueRefreshTokenForUser(user.id);
    await this.logAuthEvent({
      action: 'login',
      sessionId: refreshTokenPair.tokenId,
      userId: user.id,
      requestId,
      after: {
        strategy: 'password',
      },
    });

    return {
      accessToken: this.signAccessToken({
        sub: user.id,
        kind: 'user',
        scopes: ['admin'],
        email: user.email,
        displayName: user.displayName,
      }),
      refreshToken: refreshTokenPair.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenTtlSeconds(),
      refreshExpiresIn: this.getRefreshTokenTtlSeconds(),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  async refreshUserToken(refreshToken: string, requestId?: string) {
    const verification = this.verifyRefreshToken(refreshToken);
    const now = new Date();
    const session = await this.prisma.userRefreshSession.findUnique({
      where: { id: verification.tokenId },
    });

    if (session?.userId !== verification.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt || session.expiresAt <= now) {
      await this.revokeRefreshTokenFamily(session.id, now);
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!this.isSecretMatch(refreshToken, session.tokenHash)) {
      await this.revokeRefreshTokenFamily(session.id, now);
      await this.logAuthEvent({
        action: 'refresh_reuse',
        sessionId: session.id,
        userId: session.userId,
        requestId,
        before: {
          reason: 'hash_mismatch',
        },
      });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const nextPair = await this.issueRefreshTokenForUser(session.userId);

    await this.prisma.userRefreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        replacedByTokenId: nextPair.tokenId,
      },
    });
    await this.logAuthEvent({
      action: 'refresh',
      sessionId: nextPair.tokenId,
      userId: session.userId,
      requestId,
      before: {
        previousSessionId: session.id,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      accessToken: this.signAccessToken({
        sub: user.id,
        kind: 'user',
        scopes: ['admin'],
        email: user.email,
        displayName: user.displayName,
      }),
      refreshToken: nextPair.refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenTtlSeconds(),
      refreshExpiresIn: this.getRefreshTokenTtlSeconds(),
    };
  }

  async logoutUserSession(refreshToken: string, requestId?: string) {
    const verification = this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.userRefreshSession.findUnique({
      where: { id: verification.tokenId },
    });

    if (session?.userId !== verification.sub) {
      return { ok: true };
    }

    if (!this.isSecretMatch(refreshToken, session.tokenHash)) {
      await this.revokeRefreshTokenFamily(session.id, new Date());
      await this.logAuthEvent({
        action: 'refresh_reuse',
        sessionId: session.id,
        userId: session.userId,
        requestId,
        before: {
          reason: 'logout_hash_mismatch',
        },
      });
      return { ok: true };
    }

    await this.revokeRefreshTokenFamily(session.id, new Date());
    await this.logAuthEvent({
      action: 'logout',
      sessionId: session.id,
      userId: session.userId,
      requestId,
    });
    return { ok: true };
  }

  async issueClientToken(input: ClientTokenDto) {
    const apiClient = await this.prisma.apiClient.findUnique({
      where: { clientId: input.clientId },
    });

    if (!apiClient?.isActive || apiClient.revokedAt) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    if (!this.isSecretMatch(input.clientSecret, apiClient.clientSecretHash)) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    const grantedScopes = this.getGrantedScopes(apiClient, input.scope);

    return {
      accessToken: this.signAccessToken({
        sub: apiClient.id,
        kind: 'client',
        clientId: apiClient.clientId,
        scopes: grantedScopes,
        displayName: apiClient.name,
      }),
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenTtlSeconds(),
      scope: grantedScopes.join(' '),
    };
  }

  verifyAccessToken(token: string): AuthenticatedPrincipal {
    const decoded = verify(token, this.getJwtSecret()) as {
      sub: string;
      kind: 'user' | 'client';
      clientId?: string;
      scopes?: string[];
      email?: string;
      displayName?: string;
    };

    return {
      id: decoded.sub,
      kind: decoded.kind,
      clientId: decoded.clientId,
      scopes: decoded.scopes || [],
      email: decoded.email,
      displayName: decoded.displayName,
    };
  }

  private getGrantedScopes(apiClient: ApiClient, requestedScope?: string): string[] {
    const allowedScopes = JSON.parse(apiClient.scopesJson) as string[];
    if (!requestedScope?.trim()) {
      return allowedScopes;
    }

    const requestedScopes = requestedScope
      .split(' ')
      .map((scope) => scope.trim())
      .filter(Boolean);

    const invalidScope = requestedScopes.find((scope) => !allowedScopes.includes(scope));
    if (invalidScope) {
      throw new UnauthorizedException(`Requested scope is not allowed: ${invalidScope}`);
    }

    return requestedScopes;
  }

  private signAccessToken(payload: {
    sub: string;
    kind: 'user' | 'client';
    scopes: string[];
    clientId?: string;
    email?: string;
    displayName?: string;
  }): string {
    return sign(payload, this.getJwtSecret(), {
      algorithm: 'HS256',
      expiresIn: this.getAccessTokenTtlSeconds(),
      issuer: 'pinnacle-mailer',
      audience: 'pinnacle-mailer-api',
    });
  }

  private signRefreshToken(payload: { sub: string; tokenId: string }): string {
    return sign(
      {
        sub: payload.sub,
        kind: 'user',
        tokenId: payload.tokenId,
        tokenType: 'refresh',
      },
      this.getRefreshTokenSecret(),
      {
        algorithm: 'HS256',
        expiresIn: this.getRefreshTokenTtlSeconds(),
        issuer: 'pinnacle-mailer',
        audience: 'pinnacle-mailer-api',
      },
    );
  }

  private verifyRefreshToken(token: string): { sub: string; tokenId: string } {
    const decoded = verify(token, this.getRefreshTokenSecret()) as {
      sub: string;
      tokenId?: string;
      tokenType?: string;
    };

    if (decoded.tokenType !== 'refresh' || !decoded.tokenId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      sub: decoded.sub,
      tokenId: decoded.tokenId,
    };
  }

  private async issueRefreshTokenForUser(userId: string): Promise<{ tokenId: string; refreshToken: string }> {
    const tokenId = this.createRefreshTokenId();
    const refreshToken = this.signRefreshToken({ sub: userId, tokenId });
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlSeconds() * 1000);

    await this.prisma.userRefreshSession.create({
      data: {
        id: tokenId,
        userId,
        tokenHash: this.hashSecret(refreshToken),
        expiresAt,
      },
    });

    return {
      tokenId,
      refreshToken,
    };
  }

  private async revokeRefreshTokenFamily(rootTokenId: string, revokedAt: Date): Promise<void> {
    let cursor: string | null = rootTokenId;

    while (cursor) {
      const current: {
        id: string;
        revokedAt: Date | null;
        replacedByTokenId: string | null;
      } | null = await this.prisma.userRefreshSession.findUnique({
        where: { id: cursor },
        select: {
          id: true,
          revokedAt: true,
          replacedByTokenId: true,
        },
      });

      if (!current) {
        break;
      }

      if (!current.revokedAt) {
        await this.prisma.userRefreshSession.update({
          where: { id: current.id },
          data: {
            revokedAt,
          },
        });
      }

      cursor = current.replacedByTokenId;
    }
  }

  private createRefreshTokenId(): string {
    return `rt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }

  private hashSecret(plainSecret: string): string {
    return createHash('sha256').update(plainSecret).digest('hex');
  }

  private isSecretMatch(plainSecret: string, hashedSecret: string): boolean {
    const incomingHash = this.hashSecret(plainSecret);
    return timingSafeEqual(Buffer.from(incomingHash), Buffer.from(hashedSecret));
  }

  private getJwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET') || 'pinnacle-mailer-dev-secret';
  }

  private getAccessTokenTtlSeconds(): number {
    const configured = this.configService.get<string>('JWT_ACCESS_TOKEN_TTL_SECONDS');
    return configured ? Number(configured) : 3600;
  }

  private getRefreshTokenSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET') || this.getJwtSecret();
  }

  private getRefreshTokenTtlSeconds(): number {
    const configured = this.configService.get<string>('JWT_REFRESH_TOKEN_TTL_SECONDS');
    return configured ? Number(configured) : 60 * 60 * 24 * 14;
  }

  private async logAuthEvent(input: {
    action: 'login' | 'login_failed' | 'refresh' | 'logout' | 'refresh_reuse' | 'lockout';
    sessionId: string;
    userId: string;
    requestId?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditService.log({
        entity: 'auth_session',
        entityId: input.sessionId,
        action: input.action,
        actorUserId: input.userId,
        requestId: input.requestId,
        beforeJson: input.before ? JSON.stringify(input.before) : undefined,
        afterJson: input.after ? JSON.stringify(input.after) : undefined,
      });
    } catch {
      // Audit must not break auth flows.
    }
  }

  private async registerFailedLoginAttempt(
    userId: string,
    requestId?: string,
  ): Promise<{ lockedUntil: Date | null }> {
    const maxAttempts = this.getLoginMaxAttempts();
    const lockoutSeconds = this.getLoginLockoutSeconds();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        failedLoginAttempts: true,
      },
    });

    if (!user) {
      return { lockedUntil: null };
    }

    const nextAttempts = user.failedLoginAttempts + 1;
    const isLockedOut = nextAttempts >= maxAttempts;
    const lockedUntil = isLockedOut ? new Date(Date.now() + lockoutSeconds * 1000) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: isLockedOut ? 0 : nextAttempts,
        lockedUntil,
      },
    });

    await this.logAuthEvent({
      action: 'login_failed',
      sessionId: userId,
      userId,
      requestId,
      after: {
        failedLoginAttempts: nextAttempts,
      },
    });

    if (isLockedOut) {
      await this.logAuthEvent({
        action: 'lockout',
        sessionId: userId,
        userId,
        requestId,
        after: {
          lockedUntil: lockedUntil?.toISOString(),
          lockoutSeconds,
        },
      });
    }

    return {
      lockedUntil,
    };
  }

  private getLoginMaxAttempts(): number {
    return this.getNumericConfigOrDefault('LOGIN_MAX_ATTEMPTS', 5);
  }

  private getLoginLockoutSeconds(): number {
    return this.getNumericConfigOrDefault('LOGIN_LOCKOUT_SECONDS', 900);
  }

  private getNumericConfigOrDefault(key: string, fallback: number): number {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private throwLockoutException(lockedUntil: Date): never {
    throw new HttpException(
      {
        message: `Account temporarily locked until ${lockedUntil.toISOString()}.`,
        code: 'account_locked',
        lockedUntil: lockedUntil.toISOString(),
      },
      HttpStatus.LOCKED,
    );
  }
}
