import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import { LayoutType } from '@prisma/client';
import { LayoutVisualModel } from '@pinnacle-mailer/shared-types';

export class CreateLayoutDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(LayoutType)
  type!: LayoutType;

  @ValidateIf((value: CreateLayoutDto) => !value.layoutModel)
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  mjml?: string;

  @IsObject()
  @IsOptional()
  layoutModel?: LayoutVisualModel;
}
