import './global.css';
import { AppSessionProvider } from '../components/session-provider';

export const metadata = {
  title: 'Pinnacle Mailer',
  description: 'WYSIWYG email template manager for Pinnacle Rewards',
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
