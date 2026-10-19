'use client';

import React, { useState } from 'react';
import { signInWithEmail, demoSignIn, UserProfile } from '@/lib/firebase';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const fieldClass =
  'w-full h-10 px-3 rounded border border-paper-control bg-paper text-[15px] text-ink placeholder:text-muted focus:outline-2 focus:outline-accent focus:-outline-offset-1';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Enter both your email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await signInWithEmail(email.trim(), password);
      onLoginSuccess(user);
    } catch (err: unknown) {
      console.warn('Sign-in failed:', err);
      const code = (err as { code?: string } | null)?.code;
      const message = (err as { message?: string } | null)?.message;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMessage('Email or password is wrong. Check them, or use the offline sign-in below.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Wait a moment, or use the offline sign-in.');
      } else {
        setErrorMessage(message || 'Sign-in failed. Use the offline sign-in to keep working.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoBypass = () => {
    setIsLoading(true);
    try {
      const demoUser = demoSignIn(email.trim() || 'operator@quickpic.io', 'Alex Pratama (Operator)');
      onLoginSuccess(demoUser);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-paper text-ink font-display px-6 md:px-[27vw] py-14 select-none">
      <div className="max-w-[380px]">
        <div className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <svg viewBox="0 0 14 34" className="w-3.5 h-9" aria-hidden="true">
            <rect width="14" height="10" fill="currentColor" />
            <rect y="12" width="14" height="10" fill="currentColor" />
            <rect y="24" width="14" height="10" fill="#1a4be0" />
          </svg>
          QuickPic
        </div>

        <h1 className="mt-44 text-[27px] leading-[1.25] font-medium tracking-tight">
          Sign in to run your QuickPic booths.
        </h1>
        <p className="mt-3 text-muted text-base leading-normal">
          Use your operator account. Booths keep taking photos offline once they are set up.
        </p>

        {errorMessage && (
          <p role="alert" className="mt-6 text-[15px] text-negative">
            {errorMessage}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="email" className="text-sm font-medium">Operator email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className={fieldClass}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
              className={fieldClass}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-5">
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 min-w-28 px-4 rounded bg-accent text-white font-medium text-[15px] hover:bg-accent-press disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={handleDemoBypass}
              disabled={isLoading}
              className="text-accent font-medium text-[15px] hover:underline underline-offset-4 cursor-pointer disabled:opacity-50"
            >
              Offline demo sign-in →
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
