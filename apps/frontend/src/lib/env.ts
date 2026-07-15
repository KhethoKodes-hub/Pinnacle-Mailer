import 'server-only';
import { createHash } from 'node:crypto';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getBackendApiBaseUrl(): string {
  return getRequiredEnv('BACKEND_API_BASE_URL').replace(/\/$/, '');
}

export function tryGetBackendApiBaseUrl(): string | null {
  const value = process.env.BACKEND_API_BASE_URL;
  return value ? value.replace(/\/$/, '') : null;
}

export function getAuthSecret(): string {
  const configuredSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (configuredSecret) {
    return configuredSecret;
  }

  // Keep the app bootable when secrets are missing; replace with a real secret in Vercel.
  const fallbackSeed =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    'pinnacle-mailer-local';
  return createHash('sha256').update(`pinnacle-mailer:${fallbackSeed}`).digest('hex');
}
