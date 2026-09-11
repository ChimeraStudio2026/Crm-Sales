'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ColdClientsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/clients?rapporto=Freddo');
  }, [router]);
  return null;
}
