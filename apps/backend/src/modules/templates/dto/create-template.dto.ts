import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

type BodyBlockType = 'text' | 'image' | 'button' | 'divider' | 'spacer';

export class TemplateBodyBlockDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsIn(['text', 'image', 'button', 'divider', 'spacer'])
  type!: BodyBlockType;

  @ValidateIf((value: TemplateBodyBlockDto) => value.type === 'image')
  @IsString()
  @IsNotEmpty()
  imageUrl?: string;

  @ValidateIf((value: TemplateBodyBlockDto) => value.type === 'image')
  @IsString()
  @IsOptional()
  altText?: string;

  @ValidateIf((value: TemplateBodyBlockDto) => value.type === 'button')
  @IsString()
  @IsNotEmpty()
  href?: string;

  @ValidateIf((value: TemplateBodyBlockDto) => value.type === 'text' || value.type === 'button')
  @IsString()
  @IsNotEmpty()
  content?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsOptional()
  bodyMjml!: string;

  @IsString()
  @IsNotEmpty()
  headerLayoutId!: string;

  @IsString()
  @IsNotEmpty()
  footerLayoutId!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBodyBlockDto)
  blocks?: TemplateBodyBlockDto[];
}
