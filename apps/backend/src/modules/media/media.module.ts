import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [AuditModule],
  controllers: [MediaController],
  providers: [MediaService],
})
export class MediaModule {}
