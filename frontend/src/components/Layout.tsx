import React from 'react';
import { Sidebar } from './Sidebar';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Navigation Drawer Sidebar */}
      <Sidebar />

      {/* Main Content scroll container */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto h-screen p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};
