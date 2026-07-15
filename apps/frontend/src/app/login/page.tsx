import { redirect } from 'next/navigation';
import { LoginForm } from '../../components/login-form';
import { getAuthSession } from '../../lib/session';

export default async function LoginPage() {
  const session = await getAuthSession();

  if (session?.accessToken) {
    redirect('/admin/templates');
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
<img src="/pinnacle-logo.png" alt="Pinnacle Mailer Logo" className="logo"   style={{ width: '200px', height: 'auto' }} 
 />        <h4>Admin sign-in</h4>
        <p>Use your account to access templates, layouts, and media.</p>
        <LoginForm />
      </section>
    </main>
  );
}
