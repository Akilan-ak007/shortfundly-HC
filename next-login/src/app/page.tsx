import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ShieldCheck, LogOut, Sparkles, User, Mail, Calendar } from 'lucide-react';

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Handle Logout action
  const handleLogout = async () => {
    'use server';
    const supabaseClient = await createClient();
    await supabaseClient.auth.signOut();
    redirect('/login');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-900/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-900/20 blur-[120px]" />

      <div className="relative w-full max-w-lg p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl shadow-violet-950/20 mx-4 text-center">
        <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400 mb-6 shadow-lg shadow-emerald-500/10">
          <ShieldCheck className="h-8 w-8" />
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-400 animate-pulse" />
          Access Granted!
        </h1>
        <p className="text-slate-400 text-xs mt-2">You have successfully authenticated via Supabase Auth</p>

        {/* User Card */}
        <div className="my-8 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-left space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              <User className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Name</p>
              <p className="text-sm font-semibold text-white">{user.user_metadata?.full_name || 'Not Provided'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</p>
              <p className="text-sm font-semibold text-white">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Account Created At</p>
              <p className="text-sm font-semibold text-white">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        <form action={handleLogout}>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-semibold border border-slate-700 transition-all shadow-md shadow-slate-900/10 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Sign Out Session
          </button>
        </form>
      </div>
    </div>
  );
}
