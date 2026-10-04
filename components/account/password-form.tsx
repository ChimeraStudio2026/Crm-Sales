'use client';

import { useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

interface PasswordFormProps {
  readonly onSuccess?: () => void;
}

function validatePassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri.`;
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'Usa almeno una lettera e un numero.';
  }
  if (password !== confirmation) {
    return 'Le due password non coincidono.';
  }
  return null;
}

export function PasswordForm({ onSuccess }: PasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaved(false);
    const validationError = validatePassword(password, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError('Supabase non configurato.');
      return;
    }
    setError('');
    setIsSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSaving(false);
    if (updateError) {
      setError(
        updateError.message.toLowerCase().includes('different')
          ? 'La nuova password deve essere diversa da quella attuale.'
          : updateError.message,
      );
      return;
    }
    setPassword('');
    setConfirmation('');
    setIsSaved(true);
    onSuccess?.();
  };

  return (
    <form className="password-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-group">
        <label htmlFor="new-password">Nuova password</label>
        <div className="password-input-wrap">
          <input
            id="new-password"
            type={isVisible ? 'text' : 'password'}
            className="form-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="password-visibility-btn"
            onClick={() => setIsVisible((current) => !current)}
            aria-label={isVisible ? 'Nascondi password' : 'Mostra password'}
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <small className="password-hint">Almeno {MIN_PASSWORD_LENGTH} caratteri, con lettere e numeri.</small>
      </div>
      <div className="form-group">
        <label htmlFor="confirm-password">Ripeti la password</label>
        <input
          id="confirm-password"
          type={isVisible ? 'text' : 'password'}
          className="form-input"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <p className="login-error">{error}</p>}
      {isSaved && <p className="password-success">Password aggiornata. Dal prossimo accesso usa quella nuova.</p>}
      <button type="submit" className="btn btn-primary" disabled={isSaving}>
        <KeyRound size={16} />
        <span>{isSaving ? 'Salvataggio...' : 'Salva password'}</span>
      </button>
    </form>
  );
}
