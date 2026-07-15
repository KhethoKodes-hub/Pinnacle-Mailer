import { LayoutType } from '@prisma/client';
import { LayoutVisualModel } from '@pinnacle-mailer/shared-types';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class PreviewLayoutDto {
  @IsEnum(LayoutType)
  type!: LayoutType;

  @IsString()
  @IsOptional()
  mjml!: string;

  @IsString()
  @IsOptional()
  bodyMjml?: string;

  @IsObject()
  @IsOptional()
  layoutModel?: LayoutVisualModel;
}
