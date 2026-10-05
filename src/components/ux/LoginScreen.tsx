'use client';

import React, { useState } from 'react';
import {
  Camera,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  Layers
} from 'lucide-react';
import { signInWithEmail, demoSignIn, UserProfile } from '@/lib/firebase';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const user = await signInWithEmail(email.trim(), password);
      onLoginSuccess(user);
    } catch (err: any) {
      console.warn('Sign-in failed:', err);
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        setErrorMessage('Invalid email or password. Please verify your credentials or use the Quick Demo Sign-In below.');
      } else if (err?.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please wait a moment or use the Offline Demo Sign-In.');
      } else {
        setErrorMessage(err?.message || 'Authentication failed. Use the Quick Demo Sign-In for offline access.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoBypass = () => {
    setIsLoading(true);
    try {
      const demoUser = demoSignIn(
        email.trim() || 'operator@quickpic.io',
        'Alex Pratama (Operator)'
      );
      onLoginSuccess(demoUser);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen w-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4 select-none overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-3xl p-7 shadow-2xl backdrop-blur-xl flex flex-col gap-6 z-10">
        
        {/* Header / Brand */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20 ring-4 ring-pink-500/20">
            <Camera className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              QuickPic <span className="text-pink-500 text-xs px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 font-bold uppercase tracking-wider">Terminal</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">Operator & Venue Kiosk Sign-In</p>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Operator Email
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@quickpic.io"
                autoComplete="email"
                required
                className="w-full pl-10 pr-4 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Terminal Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-10 py-3 bg-zinc-950/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Sign In to Terminal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-900 px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 absolute">
            Or Kiosk Fast Pass
          </span>
        </div>

        {/* Demo / Offline Bypass Button */}
        <button
          type="button"
          onClick={handleDemoBypass}
          disabled={isLoading}
          className="w-full py-2.5 px-3 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Quick Operator Sign-In (Demo / Offline)</span>
        </button>

        {/* Footer info badge */}
        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/60">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Firebase Protected
          </span>
          <span className="flex items-center gap-1 font-mono">
            <Cpu className="w-3 h-3 text-zinc-500" />
            Kiosk v2.5
          </span>
        </div>
      </div>
    </div>
  );
};
