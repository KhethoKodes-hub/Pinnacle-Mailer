import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CreateTemplateDto } from './dto/create-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TemplatesService } from './templates.service';

@ApiTags('templates')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Scopes('templates:read')
  list() {
    return this.templatesService.list();
  }

  @Post()
  @Scopes('templates:write')
  create(@Body() input: CreateTemplateDto, @CurrentPrincipal() principal?: AuthenticatedPrincipal) {
    return this.templatesService.create(input, principal);
  }

  @Patch(':id')
  @Scopes('templates:write')
  update(
    @Param('id') id: string,
    @Body() input: UpdateTemplateDto,
    @CurrentPrincipal() principal?: AuthenticatedPrincipal,
  ) {
    return this.templatesService.update(id, input, principal);
  }

  @Post(':id/publish')
  @Scopes('templates:write')
  publish(@Param('id') id: string, @CurrentPrincipal() principal?: AuthenticatedPrincipal) {
    return this.templatesService.publish(id, principal);
  }

  @Post(':id/rollback/:version')
  @Scopes('templates:write')
  rollback(
    @Param('id') id: string,
    @Param('version') version: string,
    @CurrentPrincipal() principal?: AuthenticatedPrincipal,
  ) {
    return this.templatesService.rollback(id, Number(version), principal);
  }

  @Get(':id/export-html')
  @Scopes('templates:read')
  exportHtml(@Param('id') id: string) {
    return this.templatesService.exportHtml(id);
  }

  @Post('preview')
  @Scopes('templates:read')
  preview(@Body() input: PreviewTemplateDto) {
    return this.templatesService.preview(input);
  }
}
