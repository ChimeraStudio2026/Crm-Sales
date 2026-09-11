import { Suspense } from 'react';
import { ClientsSection } from '@/components/sections/clients-section';

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsSection />
    </Suspense>
  );
}
