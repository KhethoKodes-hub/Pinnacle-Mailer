import { IsString } from 'class-validator';

export class PreviewTemplateDto {
  @IsString()
  headerMjml!: string;

  @IsString()
  bodyMjml!: string;

  @IsString()
  footerMjml!: string;
}
