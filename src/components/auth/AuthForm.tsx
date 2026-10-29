"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { DEFAULT_SECTION } from '@/lib/sections';
import styles from './auth.module.css';

type Mode = 'sign-in' | 'sign-up' | 'recover' | 'password' | 'confirm';

export function AuthForm({ mode, tokenHash, tokenType }: { mode: Mode; tokenHash?: string; tokenType?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const heading = { 'sign-in': 'Sign in to your account', 'sign-up': 'Access is by invitation',
    recover: 'Reset your password', password: 'Set your BOSS password', confirm: 'Confirm your BOSS access' }[mode];

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get('password') ?? '');
    if (mode === 'password' && password !== fields.get('confirm')) {
      setError('The passwords do not match.'); setBusy(false); return;
    }
    const action = mode === 'sign-in' ? 'login' : mode;
    try {
      const response = await fetch(`/api/auth/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: fields.get('email'), password, token_hash: tokenHash, type: tokenType }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Please try again.');
      if (mode === 'recover') { setMessage(result.message); return; }
      // Remove invitation/recovery secrets from browser history, and discard cached workspace data.
      window.location.replace(mode === 'confirm' ? '/set-password' : `/${DEFAULT_SECTION}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image src="/brand/boss-logo.png" alt="" width={32} height={32} className={styles.logo} priority />
          <span className={styles.brandName}>BOSS</span>
        </div>
        <p className={styles.subtitle}>Business Operating Systems Solutions</p>
        <h1 className={styles.heading}>{heading}</h1>
        {mode === 'sign-up' ? <p>Contact your BOSS administrator to request access. Public registration is disabled.</p> : (
          <form className={styles.form} onSubmit={onSubmit}>
            {(mode === 'sign-in' || mode === 'recover') && <TextField label="Email Address" type="email" name="email" autoComplete="username" required maxLength={254} disabled={busy} />}
            {(mode === 'sign-in' || mode === 'password') && <TextField label="Password" reveal name="password" autoComplete={mode === 'password' ? 'new-password' : 'current-password'} minLength={mode === 'password' ? 12 : undefined} maxLength={256} required disabled={busy} />}
            {mode === 'password' && <>
              <TextField label="Confirm Password" reveal name="confirm" autoComplete="new-password" minLength={12} maxLength={256} required disabled={busy} />
              <p>Use at least 12 characters. A long, unique passphrase is recommended.</p>
            </>}
            {mode === 'confirm' && <p>Continue to accept your invitation or reset your password. This link can only be used once.</p>}
            {error && <p role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            <Button type="submit" size="auth" className={styles.submit} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign In' : mode === 'recover' ? 'Send recovery email' : mode === 'password' ? 'Save password' : 'Continue securely'}
            </Button>
            {mode === 'sign-in' && <Link className={styles.forgot} href="/forgot-password">Forgot Password?</Link>}
          </form>
        )}
        <p className={styles.switch}>
          <Link href={mode === 'sign-in' ? '/sign-up' : '/sign-in'}>{mode === 'sign-in' ? 'Need access?' : 'Back to sign in'}</Link>
        </p>
      </div>
    </main>
  );
}
