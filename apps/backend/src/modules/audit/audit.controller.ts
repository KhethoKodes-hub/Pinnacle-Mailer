import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@ApiTags('audit')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Scopes('audit:read')
  list(@Query() query: AuditQueryDto) {
    return this.auditService.listRecent({
      limit: query.limit,
      entity: query.entity,
      action: query.action,
      requestId: query.requestId,
    });
  }
}
