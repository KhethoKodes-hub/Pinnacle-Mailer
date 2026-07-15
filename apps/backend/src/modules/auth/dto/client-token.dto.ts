import { IsOptional, IsString, MinLength } from 'class-validator';

export class ClientTokenDto {
  @IsString()
  clientId!: string;

  @IsString()
  @MinLength(12)
  clientSecret!: string;

  @IsOptional()
  @IsString()
  scope?: string;
}
