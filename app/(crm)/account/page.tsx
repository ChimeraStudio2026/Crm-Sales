import { Suspense } from 'react';
import { AccountSection } from '@/components/sections/account-section';

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountSection />
    </Suspense>
  );
}
