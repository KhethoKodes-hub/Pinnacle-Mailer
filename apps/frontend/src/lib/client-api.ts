export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

type BffErrorPayload = {
  message?: string;
  code?: string;
};

async function readErrorPayload(response: Response): Promise<BffErrorPayload> {
  try {
    return (await response.json()) as BffErrorPayload;
  } catch {
    return {};
  }
}

export async function fetchAdminJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
  });

  if (response.ok) {
    return (await response.json()) as T;
  }

  const payload = await readErrorPayload(response);
  if (
    response.status === 401 &&
    (payload.code === 'session_expired' || payload.code === 'reauth_required')
  ) {
    throw new SessionExpiredError(payload.message || 'Your session has expired. Please sign in again.');
  }

  throw new Error(payload.message || 'Request failed');
}
