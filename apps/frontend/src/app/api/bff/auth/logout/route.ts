import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getBackendApiBaseUrl } from '../../../../../lib/env';

export async function POST(request: NextRequest) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return Response.json({ message: 'Missing auth secret' }, { status: 500 });
  }

  const token = await getToken({ req: request, secret });
  const refreshToken = typeof token?.refreshToken === 'string' ? token.refreshToken : null;

  if (!refreshToken) {
    return Response.json({ ok: true });
  }

  await fetch(`${getBackendApiBaseUrl()}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ refreshToken }),
  });

  return Response.json({ ok: true });
}
