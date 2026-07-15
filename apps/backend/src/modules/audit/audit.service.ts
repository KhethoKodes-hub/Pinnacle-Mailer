import { AuditAction, AuditEntity } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEventInput {
  entity: AuditEntity;
  entityId: string;
  action: AuditAction;
  actorUserId?: string;
  actorClientId?: string;
  beforeJson?: string;
  afterJson?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditEventInput) {
    return this.prisma.auditLog.create({ data: input });
  }

  async listRecent(input?: {
    limit?: number;
    entity?: AuditEntity;
    action?: AuditAction;
    requestId?: string;
  }) {
    const limit = input?.limit || 50;
    return this.prisma.auditLog.findMany({
      where: {
        entity: input?.entity,
        action: input?.action,
        requestId: input?.requestId?.trim()
          ? {
              contains: input.requestId.trim(),
            }
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
