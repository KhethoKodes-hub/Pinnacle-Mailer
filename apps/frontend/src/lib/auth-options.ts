import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getAuthSecret, tryGetBackendApiBaseUrl } from './env';

type BackendLoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

type BackendRefreshResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
};

function shouldRefreshAccessToken(expiresAt: number | undefined): boolean {
  if (!expiresAt) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 30;
}

async function refreshAccessToken(token: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
  error?: string;
}) {
  if (!token.refreshToken) {
    return {
      ...token,
      error: 'RefreshTokenMissing',
    };
  }

  try {
    const backendApiBaseUrl = tryGetBackendApiBaseUrl();
    if (!backendApiBaseUrl) {
      return {
        ...token,
        error: 'BackendUnavailable',
      };
    }

    const response = await fetch(`${backendApiBaseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    });

    if (!response.ok) {
      return {
        ...token,
        error: 'RefreshAccessTokenError',
      };
    }

    const payload = (await response.json()) as BackendRefreshResponse;
    const now = Math.floor(Date.now() / 1000);

    return {
      ...token,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: now + payload.expiresIn,
      refreshExpiresAt: now + payload.refreshExpiresIn,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const backendApiBaseUrl = tryGetBackendApiBaseUrl();
        if (!backendApiBaseUrl) {
          throw new Error('Authentication backend is not configured.');
        }

        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : '';
        const password = typeof credentials?.password === 'string' ? credentials.password : '';

        if (!email || !password) {
          return null;
        }

        const response = await fetch(`${backendApiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          let message = 'Authentication failed';

          try {
            const payload = (await response.json()) as {
              message?: string | string[];
              code?: string;
              lockedUntil?: string;
            };
            const resolved = Array.isArray(payload.message) ? payload.message[0] : payload.message;
            if (resolved) {
              message = resolved;
            }

            if (payload.code === 'account_locked' && payload.lockedUntil) {
              message = `Account temporarily locked until ${payload.lockedUntil}.`;
            }
          } catch {
            // Keep generic message when response body is absent or unparsable.
          }

          throw new Error(message);
        }

        const payload = (await response.json()) as BackendLoginResponse;
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + payload.expiresIn;
        const refreshExpiresAt = now + payload.refreshExpiresIn;

        return {
          id: payload.user.id,
          email: payload.user.email,
          name: payload.user.displayName,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          expiresAt,
          refreshExpiresAt,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.expiresAt = user.expiresAt;
        token.refreshExpiresAt = user.refreshExpiresAt;
        token.error = undefined;
        return token;
      }

      if (shouldRefreshAccessToken(token.expiresAt)) {
        return refreshAccessToken(token);
      }

      if (
        typeof token.expiresAt === 'number' &&
        Math.floor(Date.now() / 1000) >= token.expiresAt &&
        !token.error
      ) {
        token.error = 'AccessTokenExpired';
      }

      return token;
    },
    session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub || '',
        email: token.email || '',
        name: token.name || '',
      };
      session.accessToken = typeof token.accessToken === 'string' ? token.accessToken : '';
      session.expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : 0;
      session.error = typeof token.error === 'string' ? token.error : undefined;
      return session;
    },
  },
};
