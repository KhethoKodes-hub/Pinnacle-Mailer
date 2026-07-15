import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const AUDIT_ENTITIES = ['template', 'layout', 'media', 'api_client', 'auth_session'] as const;
const AUDIT_ACTIONS = [
  'create',
  'update',
  'publish',
  'rollback',
  'delete',
  'revoke',
  'rotate_secret',
  'login',
  'refresh',
  'logout',
  'refresh_reuse',
] as const;

export class AuditQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(AUDIT_ENTITIES)
  entity?: (typeof AUDIT_ENTITIES)[number];

  @IsOptional()
  @IsString()
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @IsOptional()
  @IsString()
  requestId?: string;
}
