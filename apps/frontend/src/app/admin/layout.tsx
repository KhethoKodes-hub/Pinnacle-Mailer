import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AdminNav } from '../../components/admin-nav';
import { SignOutButton } from '../../components/sign-out-button';
import { getAuthSession } from '../../lib/session';

export default async function AdminLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session?.accessToken) {
    redirect('/login');
  }

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="admin-branding">
          <Image
            src="/pinnacle-logo.png"
            alt="Pinnacle Rewards"
            width={196}
            height={60}
            className="admin-logo"
            priority
          />
          <p className="eyebrow">Pinnacle Mailer</p>
          <h1>Admin workspace</h1>
          <p className="admin-subtitle">Signed in as {session.user.name || session.user.email}</p>
        </div>
        <SignOutButton />
      </header>

      <AdminNav />

      <section>{children}</section>
    </div>
  );
}
