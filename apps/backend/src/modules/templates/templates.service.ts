import { AuditAction, AuditEntity, TemplateStatus } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BodyBlock } from '@pinnacle-mailer/shared-types';
import { renderBlocksToMjml, renderPreview } from '@pinnacle-mailer/shared-renderer';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { normalizeTemplateBlocks } from './template-blocks.util';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.emailTemplate
      .findMany({
      where: { deletedAt: null },
      include: {
        headerLayout: true,
        footerLayout: true,
      },
      orderBy: { updatedAt: 'desc' },
      })
      .then((rows) => rows.map((template) => this.hydrateBlocks(template)));
  }

  async create(input: CreateTemplateDto, principal?: AuthenticatedPrincipal) {
    const blocks = this.normalizeBlocks(input.blocks);
    const bodyMjml = this.resolveBodyMjml(blocks, input.bodyMjml);

    const created = await this.prisma.emailTemplate.create({
      data: {
        name: input.name,
        slug: input.slug,
        subject: input.subject,
        headerLayoutId: input.headerLayoutId,
        footerLayoutId: input.footerLayoutId,
        bodyMjml,
        blocksJson: JSON.stringify(blocks),
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.prisma.templateVersion.create({
      data: {
        templateId: created.id,
        version: 1,
        subject: created.subject,
        bodyMjml: created.bodyMjml,
        blocksJson: created.blocksJson,
        createdById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.template,
      entityId: created.id,
      action: AuditAction.create,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      afterJson: JSON.stringify(created),
    });

    return this.hydrateBlocks(created);
  }

  async update(id: string, input: UpdateTemplateDto, principal?: AuthenticatedPrincipal) {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Template not found');
    }

    const blocks = this.normalizeBlocks(input.blocks, existing.blocksJson);
    const generatedMjml = this.resolveBodyMjml(blocks, input.bodyMjml || existing.bodyMjml);

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        subject: input.subject,
        bodyMjml: generatedMjml,
        headerLayoutId: input.headerLayoutId,
        footerLayoutId: input.footerLayoutId,
        blocksJson: JSON.stringify(blocks),
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.template,
      entityId: id,
      action: AuditAction.update,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
    });

    return this.hydrateBlocks(updated);
  }

  async publish(id: string, principal?: AuthenticatedPrincipal) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template || template.deletedAt) {
      throw new NotFoundException('Template not found');
    }

    const lastVersion = await this.prisma.templateVersion.findFirst({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (lastVersion?.version || 0) + 1;

    await this.prisma.templateVersion.create({
      data: {
        templateId: id,
        version: nextVersion,
        subject: template.subject,
        bodyMjml: template.bodyMjml,
        blocksJson: template.blocksJson,
        createdById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    const published = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        status: TemplateStatus.published,
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.template,
      entityId: id,
      action: AuditAction.publish,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      afterJson: JSON.stringify({ status: published.status, version: nextVersion }),
    });

    return { template: published, version: nextVersion };
  }

  async rollback(id: string, version: number, principal?: AuthenticatedPrincipal) {
    const snapshot = await this.prisma.templateVersion.findUnique({
      where: {
        templateId_version: {
          templateId: id,
          version,
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException('Template version not found');
    }

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: snapshot.subject,
        bodyMjml: snapshot.bodyMjml,
        blocksJson: snapshot.blocksJson,
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.template,
      entityId: id,
      action: AuditAction.rollback,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      afterJson: JSON.stringify({ restoredVersion: version }),
    });

    return this.hydrateBlocks(updated);
  }

  async exportHtml(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
      include: {
        headerLayout: true,
        footerLayout: true,
      },
    });

    if (!template || template.deletedAt) {
      throw new NotFoundException('Template not found');
    }

    if (!template.headerLayout || !template.footerLayout) {
      throw new NotFoundException('Template layout is missing');
    }

    const rendered = await renderPreview({
      headerMjml: template.headerLayout.mjml,
      bodyMjml: template.bodyMjml,
      footerMjml: template.footerLayout.mjml,
    });

    if (rendered.errors.length > 0) {
      throw new BadRequestException({
        message: 'Unable to export template due to render issues.',
        errors: rendered.errors,
      });
    }

    const latestVersion = await this.prisma.templateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const version = latestVersion?.version || 1;

    const timestamp = new Date().toISOString().replace(/:/g, '-');

    return {
      templateId: template.id,
      slug: template.slug,
      version,
      exportedAt: new Date().toISOString(),
      filename: `${template.slug}-v${version}-${timestamp}.html`,
      html: rendered.html,
    };
  }

  async preview(input: PreviewTemplateDto) {
    return await renderPreview(input);
  }

  private normalizeBlocks(blocks: unknown[] | undefined, fallbackJson = '[]'): BodyBlock[] {
    return normalizeTemplateBlocks(blocks, fallbackJson);
  }

  private resolveBodyMjml(blocks: BodyBlock[], fallback?: string): string {
    if (blocks.length > 0) {
      return renderBlocksToMjml(blocks);
    }

    return fallback || renderBlocksToMjml([]);
  }

  private hydrateBlocks<T extends { blocksJson: string }>(template: T): T & { blocks: BodyBlock[] } {
    return {
      ...template,
      blocks: this.normalizeBlocks(undefined, template.blocksJson),
    };
  }
}
