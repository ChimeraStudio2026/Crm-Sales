import { Suspense } from 'react';
import LoginPageClient from './page.client';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page"><p>Caricamento...</p></div>}>
      <LoginPageClient />
    </Suspense>
  );
}
