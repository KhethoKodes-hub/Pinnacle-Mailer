import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthSession } from '../lib/session';

export default async function Index() {
  const session = await getAuthSession();

  if (session?.accessToken) {
    redirect('/admin/templates');
  }

  return (
    <main className="landing-root">
      <section className="hero-panel">
        <p className="eyebrow">Pinnacle Mailer</p>
        <h1>Authenticated Admin Workspace</h1>
        <p>
          Secure browser-facing BFF for template operations, layout reuse, and media
          management.
        </p>
        <Link href="/login" className="primary-button inline-button">
          Sign in to admin
        </Link>
      </section>

      <section className="cards-grid">
        <article className="info-card">
          <h2>Security baseline</h2>
          <ul>
            <li>Auth.js-backed admin sessions with protected admin routes</li>
            <li>Next.js BFF routes for templates, layouts, and media operations</li>
            <li>Scoped backend authorization and structured audit-ready request flow</li>
          </ul>
        </article>

        <article className="info-card">
          <h2>Current admin scope</h2>
          <ul>
            <li>Templates list</li>
            <li>Layouts list with impact lookups</li>
            <li>Media listing and uploads</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
