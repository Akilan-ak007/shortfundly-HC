import React, { useState } from 'react';
import { Mail, Lock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { request } from '../utils/api';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      login(data.token, data.user);
      addToast(`Welcome back, ${data.user.name}!`, 'success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid credentials. Hint: use admin@acme.com / admin123');
      addToast('Login failed. Please check credentials.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setIsForgotLoading(true);
    try {
      const data = await request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });

      addToast(data.message, 'success');
      setIsForgotOpen(false);
      setForgotEmail('');
    } catch (err: any) {
      addToast(err.message || 'Failed to request reset.', 'error');
    } finally {
      setIsForgotLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary-900/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-700/10 blur-[120px]" />

      {/* Main card */}
      <div className="w-full max-w-md p-8 glass rounded-3xl border border-slate-800 shadow-2xl relative z-10 flex flex-col gap-6 m-4 transition-all">
        {/* Branding header */}
        <div className="text-center space-y-2">
          <div className="bg-gradient-to-tr from-primary-500 to-cyan-400 text-white p-3 rounded-2xl w-fit mx-auto shadow-lg shadow-primary-500/20">
            <Mail className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">HR Email Automation</h2>
          <p className="text-sm text-slate-400">Sign in to manage company documents & dispatches</p>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="bg-red-950/30 border border-red-900/30 p-3.5 rounded-2xl flex gap-2.5 text-sm text-red-400 animate-pulse">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400" htmlFor="email-input">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                id="email-input"
                type="email"
                required
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all"
                placeholder="admin@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400" htmlFor="password-input">Password</label>
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                required
                className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 pl-10 pr-12 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-primary-500 to-cyan-500 hover:from-primary-600 hover:to-cyan-600 active:scale-[0.98] py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In To Workspace'}
          </button>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {isForgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div>
              <h3 className="text-lg font-bold">Reset Password</h3>
              <p className="text-xs text-slate-400">Request a temporary access credential</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400" htmlFor="forgot-email">Account Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  placeholder="admin@acme.com"
                  className="w-full bg-slate-950/40 border border-slate-800 rounded-xl py-3 px-4 text-sm focus:border-primary-500 focus:outline-none"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-slate-800 text-xs text-slate-400 hover:bg-slate-800/40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isForgotLoading}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isForgotLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Get Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
