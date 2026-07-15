import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { AuditAction, AuditEntity } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpdateMediaDto } from './dto/update-media.dto';

@Injectable()
export class MediaService {
  private readonly uploadDir = join(process.cwd(), 'storage', 'uploads');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async store(file: Express.Multer.File, principal?: AuthenticatedPrincipal) {
    await fs.mkdir(this.uploadDir, { recursive: true });

    const suffix = createHash('sha1').update(`${file.originalname}-${Date.now()}`).digest('hex').slice(0, 8);
    const filename = `${suffix}-${file.originalname.replace(/\s+/g, '-').toLowerCase()}`;
    const storagePath = join(this.uploadDir, filename);

    await fs.writeFile(storagePath, file.buffer);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.media,
      entityId: asset.id,
      action: AuditAction.create,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      afterJson: JSON.stringify(asset),
    });

    return asset;
  }

  list() {
    return this.prisma.mediaAsset.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, input: UpdateMediaDto, principal?: AuthenticatedPrincipal) {
    const existing = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Media asset not found');
    }

    const updated = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...input,
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.media,
      entityId: id,
      action: AuditAction.update,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
    });

    return updated;
  }
}
