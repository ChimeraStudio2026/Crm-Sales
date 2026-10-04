'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, UserRound } from 'lucide-react';
import { PasswordForm } from '@/components/account/password-form';
import { TopHeader } from '@/components/layout/top-header';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function AccountSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get('reset') === '1';
  const [email, setEmail] = useState('');
  const [mustSetPassword, setMustSetPassword] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || '');
      setMustSetPassword(user?.user_metadata?.must_set_password === true);
    });
  }, []);

  return (
    <>
      <TopHeader />
      <div className="content-body">
        <section className="app-section active">
          <div className="account-grid">
            {mustSetPassword ? (
              <p className="account-recovery-banner">
                Per continuare a usare il CRM imposta una password personale qui sotto.
              </p>
            ) : isRecovery && (
              <p className="account-recovery-banner">
                Hai aperto il link di recupero: scegli qui sotto la tua nuova password.
              </p>
            )}
            <div className="glass-card">
              <div className="chart-header">
                <h3><UserRound size={20} /> Profilo</h3>
              </div>
              <p className="settings-copy">
                Accesso al CRM con <strong>{email || '—'}</strong>.
              </p>
            </div>
            <div className="glass-card">
              <div className="chart-header">
                <h3><KeyRound size={20} /> Password</h3>
              </div>
              <p className="settings-copy">
                Scegli una password personale per entrare nel CRM. Vale solo per il tuo account.
              </p>
              <PasswordForm
                onSuccess={() => {
                  if (!mustSetPassword) return;
                  setMustSetPassword(false);
                  // Fresh navigation so the middleware sees the cleared flag.
                  router.replace('/');
                  router.refresh();
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
