import type { Metadata, Viewport } from 'next';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PwaRegister } from '@/components/pwa/pwa-register';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#266df0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'CRM Sales | Dashboard & Gestione Clienti',
  description: 'Custom CRM Sales — clienti, OKR, task e recall',
  applicationName: 'CRM Sales',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CRM Sales',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>
        {children}
        <PwaRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
