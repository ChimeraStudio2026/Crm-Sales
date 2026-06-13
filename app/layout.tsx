import type { Metadata, Viewport } from 'next';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { PwaRegister } from '@/components/pwa/pwa-register';
import { PwaInstallProvider } from '@/providers/pwa-install-provider';
import { UiPreferencesProvider } from '@/providers/ui-preferences-provider';
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
      { url: '/icons/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'CRM Sales',
    description: 'Gestione clienti, OKR, task e recall.',
    type: 'website',
    locale: 'it_IT',
    siteName: 'CRM Sales',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'CRM Sales' }],
  },
  twitter: {
    card: 'summary',
    title: 'CRM Sales',
    description: 'Gestione clienti, OKR, task e recall.',
    images: ['/icons/icon-512.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('crm_sales_theme_mode');document.documentElement.setAttribute('data-theme',m==='dark'?'dark':'light');document.documentElement.style.colorScheme=m==='dark'?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <UiPreferencesProvider>
          <PwaInstallProvider>
            {children}
            <PwaRegister />
            <InstallPrompt />
          </PwaInstallProvider>
        </UiPreferencesProvider>
      </body>
    </html>
  );
}
