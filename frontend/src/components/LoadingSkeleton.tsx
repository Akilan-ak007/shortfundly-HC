import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  return (
    <div className="animate-pulse space-y-4 w-full">
      {/* Metric row placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 dark:bg-dark-800 rounded-xl" />
        ))}
      </div>

      {/* Main card skeleton */}
      <div className="border border-slate-200 dark:border-dark-800 p-6 rounded-2xl bg-white dark:bg-dark-900 space-y-6">
        <div className="h-6 bg-slate-200 dark:bg-dark-800 rounded-md w-1/4" />
        
        <div className="space-y-3">
          {[...Array(rows)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded-md w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded-md w-1/4" />
              <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded-md w-1/6" />
              <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded-md w-1/12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse glass p-6 rounded-2xl border flex flex-col gap-4">
      <div className="h-4 bg-slate-200 dark:bg-dark-800 rounded-md w-1/3" />
      <div className="h-8 bg-slate-200 dark:bg-dark-800 rounded-md w-1/2" />
      <div className="h-3 bg-slate-200 dark:bg-dark-800 rounded-md w-3/4" />
    </div>
  );
};
