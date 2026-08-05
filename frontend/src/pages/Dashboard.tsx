import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Send, 
  Clock, 
  AlertOctagon, 
  CheckCircle, 
  Calendar,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { request } from '../utils/api';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useToast } from '../context/ToastContext';

interface DashboardMetrics {
  totalEmployees: number;
  emailsSent: number;
  pending: number;
  failed: number;
  successRate: number;
  todaysEmails: number;
}

interface ChartTrends {
  month: string;
  Sent: number;
  Failed: number;
}

interface DeptData {
  name: string;
  value: number;
}

interface ActivityLog {
  id: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const { addToast } = useToast();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trends, setTrends] = useState<ChartTrends[]>([]);
  const [departments, setDepartments] = useState<DeptData[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data
  const loadDashboardData = async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        request('/dashboard/stats'),
        request('/dashboard/recent-activity'),
      ]);
      
      setMetrics(statsRes.metrics);
      setTrends(statsRes.charts.trends);
      setDepartments(statsRes.charts.departments);
      setActivities(logsRes);
    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Failed to fetch dashboard data.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return <LoadingSkeleton rows={5} />;
  }

  // Pie chart colors
  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'];

  const cardData = [
    { title: 'Total Employees', value: metrics?.totalEmployees || 0, icon: Users, color: 'text-primary-500 bg-primary-500/10' },
    { title: 'Emails Sent', value: metrics?.emailsSent || 0, icon: Send, color: 'text-emerald-500 bg-emerald-500/10' },
    { title: 'Pending Queue', value: metrics?.pending || 0, icon: Clock, color: 'text-amber-500 bg-amber-500/10' },
    { title: 'Failed dispatches', value: metrics?.failed || 0, icon: AlertOctagon, color: 'text-red-500 bg-red-500/10' },
    { title: 'Success Rate', value: `${metrics?.successRate || 100}%`, icon: CheckCircle, color: 'text-purple-500 bg-purple-500/10' },
    { title: "Today's Sends", value: metrics?.todaysEmails || 0, icon: Calendar, color: 'text-cyan-500 bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Enterprise Overview</h2>
          <p className="text-sm text-slate-500 dark:text-dark-400">Welcome to your HR automation cockpit. Here is your delivery performance.</p>
        </div>
        
        {/* Quick Report Download buttons */}
        <div className="flex items-center gap-2">
          <a
            href={`/api/reports/download?format=xlsx&token=${localStorage.getItem('auth_token') || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 font-semibold text-white text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download Excel Report
          </a>
          <a
            href={`/api/reports/download?format=pdf&token=${localStorage.getItem('auth_token') || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 font-semibold text-white text-xs rounded-xl transition-all shadow-md shadow-red-500/10"
          >
            <ArrowUpRight className="h-4 w-4" />
            Export PDF Audit
          </a>
        </div>
      </div>

      {/* Grid statistics summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cardData.map((card, i) => {
          const Icon = card.icon;
          return (
            <div 
              key={i} 
              className="glass p-5 rounded-2xl border hover:scale-[1.02] transition-transform duration-200 shadow-sm flex flex-col justify-between h-32"
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500 dark:text-dark-400">{card.title}</span>
                <div className={`p-2 rounded-xl ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (Spans 2 columns) */}
        <div className="lg:col-span-2 glass border p-6 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-primary-500" />
              Monthly Delivery Trends
            </h3>
            <span className="text-xs text-slate-400">Last 6 Months</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    borderRadius: '12px', 
                    border: '1px solid #334155',
                    color: '#f8fafc' 
                  }} 
                />
                <Area type="monotone" dataKey="Sent" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="Failed" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFailed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Distribution Pie Chart */}
        <div className="glass border p-6 rounded-2xl flex flex-col gap-4">
          <h3 className="font-bold text-base">Department Distribution</h3>
          
          <div className="h-56 w-full flex items-center justify-center">
            {departments.length === 0 ? (
              <p className="text-sm text-slate-400">No department data recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departments}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {departments.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      borderRadius: '12px', 
                      border: '1px solid #334155',
                      color: '#f8fafc' 
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent activity timeline */}
      <div className="glass border p-6 rounded-2xl">
        <h3 className="font-bold text-base mb-6">Recent System Activity</h3>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No audits recorded yet.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 items-start text-sm border-b pb-3 last:border-0 last:pb-0 dark:border-dark-800">
                <div className={`p-1.5 rounded-lg text-xs font-semibold ${
                  activity.action.includes('UPLOAD') ? 'bg-cyan-500/10 text-cyan-500' :
                  activity.action.includes('START') ? 'bg-indigo-500/10 text-indigo-500' :
                  activity.action.includes('DELETE') ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {activity.action.replace('USER_', '').replace('RECIPIENTS_', '')}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-700 dark:text-dark-200">{activity.details}</p>
                  <p className="text-xs text-slate-400">{activity.userName} ({activity.userEmail})</p>
                </div>
                <div className="text-xs text-slate-400 font-medium shrink-0">
                  {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
