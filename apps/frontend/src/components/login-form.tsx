'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function buildLockoutMessage(rawError: string): string {
  const lockoutTimestampRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/i;
  const lockoutTimestampMatch = lockoutTimestampRegex.exec(rawError);

  if (!lockoutTimestampMatch) {
    return 'Too many failed attempts. Your account is temporarily locked.';
  }

  const lockedUntil = new Date(lockoutTimestampMatch[1]);
  const secondsRemaining = Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 1000));

  if (secondsRemaining <= 0) {
    return 'Too many failed attempts. Your account is temporarily locked.';
  }

  if (secondsRemaining < 60) {
    return `Too many failed attempts. Try again in ${secondsRemaining} seconds.`;
  }

  const minutesRemaining = Math.ceil(secondsRemaining / 60);
  return `Too many failed attempts. Try again in ${minutesRemaining} minutes.`;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@pinnacle.local');
  const [password, setPassword] = useState('admin1234');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/admin/templates',
    });

    setIsLoading(false);

    if (!result || result.error) {
      const rawError = decodeURIComponent(result?.error || '');
      const normalizedError = rawError.toLowerCase();

      if (normalizedError.includes('locked')) {
        setError(buildLockoutMessage(rawError));
      } else {
        setError('Invalid credentials. Please try again.');
      }
      return;
    }

    router.push('/admin/templates');
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      {error ? <p className="form-error">{error}</p> : null}

      <button type="submit" className="primary-button" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
