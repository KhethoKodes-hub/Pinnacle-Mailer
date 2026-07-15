import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthenticatedPrincipal } from '../../common/auth/authenticated-principal.interface';
import { CurrentPrincipal } from '../../common/decorators/current-principal.decorator';
import { Scopes } from '../../common/decorators/scopes.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth('bearer')
@UseGuards(AccessTokenGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @Scopes('media:write')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new Error('Only image uploads are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @CurrentPrincipal() principal?: AuthenticatedPrincipal) {
    return this.mediaService.store(file, principal);
  }

  @Get()
  @Scopes('media:read')
  list() {
    return this.mediaService.list();
  }

  @Patch(':id')
  @Scopes('media:write')
  update(
    @Param('id') id: string,
    @Body() input: UpdateMediaDto,
    @CurrentPrincipal() principal?: AuthenticatedPrincipal,
  ) {
    return this.mediaService.update(id, input, principal);
  }
}
