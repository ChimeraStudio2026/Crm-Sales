'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CrmLogo } from '@/components/ui/crm-logo';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/analysis';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase non configurato.');
      setIsSubmitting(false);
      return;
    }
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di autenticazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card glass-card">
        <div className="login-logo">
          <div className="logo-icon">
            <CrmLogo size={48} />
          </div>
          <h1>CRM Sales</h1>
          <p>Accedi per gestire clienti, OKR e task.</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="current-password" />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Attendere...' : 'Entra nel CRM'}
          </button>
        </form>
      </div>
    </div>
  );
}
