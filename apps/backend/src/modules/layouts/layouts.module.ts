import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LayoutsController } from './layouts.controller';
import { LayoutsService } from './layouts.service';

@Module({
  imports: [AuditModule],
  controllers: [LayoutsController],
  providers: [LayoutsService],
  exports: [LayoutsService],
})
export class LayoutsModule {}
