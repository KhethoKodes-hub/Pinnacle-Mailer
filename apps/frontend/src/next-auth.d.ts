import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    expiresAt: number;
    error?: string;
    user: {
      id: string;
      email: string;
      name: string;
    } & DefaultSession['user'];
  }

  interface User {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    refreshExpiresAt: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    refreshExpiresAt?: number;
    error?: string;
  }
}
