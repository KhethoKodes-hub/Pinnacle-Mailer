import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AuditModule } from '../modules/audit/audit.module';
import { AuthModule } from '../modules/auth/auth.module';
import { HealthModule } from '../modules/health/health.module';
import { LayoutsModule } from '../modules/layouts/layouts.module';
import { MediaModule } from '../modules/media/media.module';
import { TemplatesModule } from '../modules/templates/templates.module';
import { UsersModule } from '../modules/users/users.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        genReqId: (request, response) => {
          const incoming = request.headers['x-request-id'];
          const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
          response.setHeader('x-request-id', requestId);
          return requestId;
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                },
              },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60_000,
          limit: 120,
        },
      ],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AuditModule,
    LayoutsModule,
    TemplatesModule,
    MediaModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
