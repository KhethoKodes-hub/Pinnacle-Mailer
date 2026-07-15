import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getAuthSecret, tryGetBackendApiBaseUrl } from '../../../../../lib/env';

export async function POST(request: NextRequest) {
  const secret = getAuthSecret();

  const token = await getToken({ req: request, secret });
  const refreshToken = typeof token?.refreshToken === 'string' ? token.refreshToken : null;

  if (!refreshToken) {
    return Response.json({ ok: true });
  }

  const backendApiBaseUrl = tryGetBackendApiBaseUrl();
  if (!backendApiBaseUrl) {
    return Response.json({ ok: true });
  }

  await fetch(`${backendApiBaseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });

  return Response.json({ ok: true });
}
