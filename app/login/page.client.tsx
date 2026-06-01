'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type AuthMode = 'signin' | 'signup';

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/analysis';
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase non configurato.');
      setIsSubmitting(false);
      return;
    }
    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(nextPath);
        router.refresh();
        return;
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (signUpError) throw signUpError;
      setMessage('Account creato. Controlla la email per confermare, poi accedi.');
      setMode('signin');
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
          <div className="logo-icon">C</div>
          <h1>CRM Sales</h1>
          <p>Accedi per gestire clienti, OKR e task.</p>
        </div>
        <div className="login-tabs">
          <button type="button" className={mode === 'signin' ? 'is-active' : ''} onClick={() => setMode('signin')}>
            Accedi
          </button>
          <button type="button" className={mode === 'signup' ? 'is-active' : ''} onClick={() => setMode('signup')}>
            Registrati
          </button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>
          {error && <p className="login-error">{error}</p>}
          {message && <p className="login-message">{message}</p>}
          <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Attendere...' : mode === 'signin' ? 'Entra nel CRM' : 'Crea account'}
          </button>
        </form>
      </div>
    </div>
  );
}
