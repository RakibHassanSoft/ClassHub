import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: { default: 'ClassHub — Attendance, marks & class updates', template: '%s · ClassHub' },
  description:
    'ClassHub helps teachers run their classes: verified student joining, attendance, routine, Google Drive resources, marks and instant notices.',
  applicationName: 'ClassHub',
  appleWebApp: { capable: true, title: 'ClassHub', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/favicon.ico' }],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
