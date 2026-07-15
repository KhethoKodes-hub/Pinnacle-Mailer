import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { CreateLayoutDto } from './dto/create-layout.dto';
import { PreviewLayoutDto } from './dto/preview-layout.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { LayoutsService } from './layouts.service';

@ApiTags('layouts')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('layouts')
export class LayoutsController {
  constructor(private readonly layoutsService: LayoutsService) {}

  @Post()
  @Scopes('layouts:write')
  create(@Body() input: CreateLayoutDto, @CurrentPrincipal() principal?: AuthenticatedPrincipal) {
    return this.layoutsService.create(input, principal);
  }

  @Get()
  @Scopes('layouts:read')
  list() {
    return this.layoutsService.list();
  }

  @Patch(':id')
  @Scopes('layouts:write')
  update(
    @Param('id') id: string,
    @Body() input: UpdateLayoutDto,
    @CurrentPrincipal() principal?: AuthenticatedPrincipal,
  ) {
    return this.layoutsService.update(id, input, principal);
  }

  @Get(':id/impact')
  @Scopes('layouts:read')
  impact(@Param('id') id: string) {
    return this.layoutsService.impact(id);
  }

  @Post('preview')
  @Scopes('layouts:read')
  preview(@Body() input: PreviewLayoutDto) {
    return this.layoutsService.preview(input);
  }
}
