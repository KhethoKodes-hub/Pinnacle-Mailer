import 'server-only';

import { getBackendApiBaseUrl } from './env';
import { getAuthSession } from './session';

type BackendRequestInit = Omit<RequestInit, 'headers'> & {
  headers?: HeadersInit;
};

function buildHeaders(requestHeaders: Headers, headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  const requestId = requestHeaders.get('x-request-id') || crypto.randomUUID();
  merged.set('x-request-id', requestId);
  return merged;
}

async function getAccessToken(): Promise<string | null> {
  const session = await getAuthSession();
  if (!session?.accessToken) {
    return null;
  }

  if (session.error) {
    return null;
  }

  return session.accessToken;
}

async function getAuthErrorCode(): Promise<'session_expired' | 'reauth_required'> {
  const session = await getAuthSession();
  if (session?.error) {
    return 'reauth_required';
  }

  return 'session_expired';
}

export async function forwardToBackend(path: string, request: Request, init?: BackendRequestInit) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const code = await getAuthErrorCode();
    return Response.json(
      {
        message: 'Unauthorized',
        code,
      },
      { status: 401 },
    );
  }

  const headers = buildHeaders(request.headers, init?.headers);
  headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') || 'application/json';
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': contentType,
    },
  });
}

export async function forwardJson(path: string, request: Request) {
  const body = await request.json();
  return forwardToBackend(path, request, {
    method: request.method,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function forwardMultipart(path: string, request: Request) {
  const formData = await request.formData();
  return forwardToBackend(path, request, {
    method: request.method,
    body: formData,
  });
}
