"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Mail, Lock, Shield, User, Loader2, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (isSignUp) {
        // Sign Up flow
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          setErrorMsg('An account with this email already exists.');
        } else {
          setInfoMsg('Check your email for a confirmation link!');
        }
      } else {
        // Sign In flow
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push('/');
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An authentication error occurred.';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/20 blur-[120px]" />

      <div className="relative w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-violet-950/20 mx-4">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-violet-500/10 border border-violet-500/25 rounded-2xl text-violet-400 mb-4 shadow-lg shadow-violet-500/10">
            <Shield className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
            <Sparkles className="h-5 w-5 text-violet-400 animate-pulse" />
            Supabase Gatekeeper
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSignUp ? 'Create your secure account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs font-semibold text-rose-400 text-center">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs font-semibold text-emerald-400 text-center">
            {infoMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-slate-950/50 border border-slate-800 focus:border-violet-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-750 active:bg-violet-800 disabled:bg-violet-900/50 disabled:text-slate-400 disabled:cursor-not-allowed font-semibold text-white text-xs rounded-xl py-3 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-500/10 mt-6"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isSignUp ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        {/* Mode Switcher */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
