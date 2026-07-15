import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Scopes('admin')
  list() {
    return this.usersService.list();
  }
}
