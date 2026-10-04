import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'CRM Sales',
    short_name: 'CRM Sales',
    description: 'Gestione clienti, OKR e task.',
    start_url: '/analysis',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#faf4ec',
    theme_color: '#faf4ec',
    lang: 'it',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/favicon.png',
        sizes: '32x32',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
