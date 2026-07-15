import { AuditAction, AuditEntity } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { renderLayoutModelToMjml, renderPreview } from '@pinnacle-mailer/shared-renderer';
import { LayoutVisualModel } from '@pinnacle-mailer/shared-types';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { PreviewLayoutDto } from './dto/preview-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';

@Injectable()
export class LayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateLayoutDto, principal?: AuthenticatedPrincipal) {
    const mjml = this.resolveLayoutMjml(input.type, input.layoutModel, input.mjml, true);
    const layoutJson = JSON.stringify(input.layoutModel || {});

    const created = await this.prisma.emailLayout.create({
      data: {
        name: input.name,
        type: input.type,
        mjml,
        layoutJson,
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });
    await this.audit.log({
      entity: AuditEntity.layout,
      entityId: created.id,
      action: AuditAction.create,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      afterJson: JSON.stringify(created),
    });
    return this.hydrateLayoutModel(created);
  }

  list() {
    return this.prisma.emailLayout
      .findMany({
        where: { deletedAt: null },
        orderBy: [{ type: 'asc' }, { updatedAt: 'desc' }],
      })
      .then((rows) => rows.map((row) => this.hydrateLayoutModel(row)));
  }

  async update(id: string, input: UpdateLayoutDto, principal?: AuthenticatedPrincipal) {
    const existing = await this.prisma.emailLayout.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Layout not found');
    }

    const nextType = input.type || existing.type;
    const mjml = this.resolveLayoutMjml(nextType, input.layoutModel, input.mjml ?? existing.mjml, true);
    const layoutJson = JSON.stringify(input.layoutModel || this.parseLayoutModel(existing.layoutJson) || {});

    const updated = await this.prisma.emailLayout.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        mjml,
        layoutJson,
        version: { increment: 1 },
        lastUpdatedById: principal?.kind === 'user' ? principal.id : undefined,
      },
    });

    await this.audit.log({
      entity: AuditEntity.layout,
      entityId: id,
      action: AuditAction.update,
      actorUserId: principal?.kind === 'user' ? principal.id : undefined,
      actorClientId: principal?.kind === 'client' ? principal.id : undefined,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
    });

    return this.hydrateLayoutModel(updated);
  }

  async impact(id: string) {
    const layout = await this.prisma.emailLayout.findUnique({ where: { id } });
    if (!layout) {
      throw new NotFoundException('Layout not found');
    }

    const where = layout.type === 'header' ? { headerLayoutId: id } : { footerLayoutId: id };
    const templates = await this.prisma.emailTemplate.findMany({
      where: {
        ...where,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    return {
      layout: {
        id: layout.id,
        name: layout.name,
        type: layout.type,
      },
      affectedTemplates: templates,
      affectedCount: templates.length,
    };
  }

  async preview(input: PreviewLayoutDto) {
    const sampleBody = input.bodyMjml?.trim() || '<mj-section><mj-column><mj-text>Preview body content</mj-text></mj-column></mj-section>';
    const mjml = this.resolveLayoutMjml(input.type, input.layoutModel, input.mjml, true);

    if (input.type === 'header') {
      return await renderPreview({
        headerMjml: mjml,
        bodyMjml: sampleBody,
        footerMjml: '',
      });
    }

    return await renderPreview({
      headerMjml: '',
      bodyMjml: sampleBody,
      footerMjml: mjml,
    });
  }

  private resolveLayoutMjml(
    type: 'header' | 'footer',
    model?: LayoutVisualModel,
    fallback?: string,
    allowDefault = false,
  ) {
    if (model) {
      return renderLayoutModelToMjml(model, type);
    }

    if (fallback && fallback.trim().length > 0) {
      return fallback;
    }

    return allowDefault ? renderLayoutModelToMjml(undefined, type) : '';
  }

  private parseLayoutModel(layoutJson: string): LayoutVisualModel | undefined {
    try {
      const parsed = JSON.parse(layoutJson) as unknown;
      if (!parsed || typeof parsed !== 'object') {
        return undefined;
      }

      return parsed as LayoutVisualModel;
    } catch {
      return undefined;
    }
  }

  private hydrateLayoutModel<T extends { layoutJson: string }>(layout: T): T & { layoutModel?: LayoutVisualModel } {
    return {
      ...layout,
      layoutModel: this.parseLayoutModel(layout.layoutJson),
    };
  }
}
