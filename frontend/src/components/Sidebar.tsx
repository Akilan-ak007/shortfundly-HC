import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Play, 
  Settings, 
  LogOut, 
  Mail, 
  Sun, 
  Moon,
  Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Recipients', to: '/recipients', icon: Users },
    { name: 'Templates', to: '/templates', icon: FileText },
    { name: 'Automation', to: '/automation', icon: Play },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 glass border-r flex flex-col h-screen sticky top-0">
      {/* Branding */}
      <div className="p-6 border-b flex items-center gap-3">
        <div className="bg-primary-500 text-white p-2 rounded-lg shadow-lg">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">MailAuto</h1>
          <p className="text-[10px] text-slate-500 dark:text-dark-400 font-medium">HR Automation Hub</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150
                ${isActive 
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/10' 
                  : 'text-slate-600 dark:text-dark-300 hover:bg-slate-100 dark:hover:bg-dark-800'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Session Footer & Mode Toggle */}
      <div className="p-4 border-t space-y-4">
        {/* Company context Indicator */}
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-dark-800 p-3 rounded-lg text-xs">
          <Building2 className="h-4 w-4 text-primary-500 shrink-0" />
          <div className="truncate">
            <p className="text-slate-500 dark:text-dark-400 font-semibold uppercase tracking-wider text-[9px]">Company</p>
            <p className="font-medium text-slate-700 dark:text-dark-200 truncate">{user?.companyName || 'Acme Solutions'}</p>
          </div>
        </div>

        {/* User Info Block */}
        <div className="flex items-center justify-between gap-2">
          <div className="truncate">
            <p className="text-sm font-semibold truncate">{user?.name || 'HR Admin'}</p>
            <p className="text-xs text-slate-500 dark:text-dark-400 truncate">{user?.email}</p>
          </div>

          {/* Toggle light/dark */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-dark-400 dark:hover:bg-dark-800 border"
            title="Toggle theme mode"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Logout Trigger */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 py-2.5 rounded-lg text-xs font-semibold transition-colors duration-150"
        >
          <LogOut className="h-4 w-4" />
          Logout Session
        </button>
      </div>
    </aside>
  );
};
