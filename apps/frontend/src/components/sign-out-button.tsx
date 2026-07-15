'use client';

import { signOut } from 'next-auth/react';

async function onSignOut() {
  await fetch('/api/bff/auth/logout', {
    method: 'POST',
    cache: 'no-store',
  });

  await signOut({ callbackUrl: '/login' });
}

export function SignOutButton() {
  return (
    <button
      className="secondary-button"
      type="button"
      onClick={onSignOut}
    >
      Sign out
    </button>
  );
}
