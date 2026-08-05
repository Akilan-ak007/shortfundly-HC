import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Mail, 
  Play, 
  Loader2, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  CheckCircle,
  FileSpreadsheet,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { request } from '../utils/api';
import { useToast } from '../context/ToastContext';

interface DocTemplate {
  id: string;
  name: string;
  type: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
}

interface Anomaly {
  recipientId: string;
  name: string;
  email: string;
  anomaly: string;
}

export const Automation: React.FC = () => {
  const { addToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selections
  const [selectedDocId, setSelectedDocId] = useState('');
  const [selectedEmailId, setSelectedEmailId] = useState('');

  // AI data integrity check & time recommendation
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [isScanningData, setIsScanningData] = useState(false);
  const [aiTime, setAiTime] = useState({ recommendedTime: '', rationale: '' });

  // Execution Progress
  const [isAutomating, setIsAutomating] = useState(false);
  const [progress, setProgress] = useState({
    stats: { queued: 0, sending: 0, sent: 0, failed: 0, bounced: 0, total: 0 },
    progressPercent: 0,
    isFinished: false,
    aiSummary: '',
  });

  // Load selection arrays
  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const [docs, emails] = await Promise.all([
        request('/templates/doc'),
        request('/templates/email'),
      ]);
      setDocTemplates(docs);
      setEmailTemplates(emails);
      
      if (docs.length > 0) setSelectedDocId(docs[0].id);
      if (emails.length > 0) setSelectedEmailId(emails[0].id);
    } catch (err: any) {
      addToast('Failed to fetch templates.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Poll progress during execution
  useEffect(() => {
    let interval: any = null;

    if (isAutomating && !progress.isFinished) {
      interval = setInterval(async () => {
        try {
          const res = await request('/automation/progress');
          setProgress({
            stats: res.stats,
            progressPercent: res.progressPercent,
            isFinished: res.isFinished,
            aiSummary: res.aiSummary,
          });

          if (res.isFinished) {
            setIsAutomating(false);
            clearInterval(interval);
            
            // Trigger WOW Confetti burst
            confetti({
              particleCount: 150,
              spread: 80,
              origin: { y: 0.6 }
            });
            
            addToast('Automation execution completed!', 'success');
          }
        } catch (err) {
          console.error('Error fetching progress:', err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutomating, progress.isFinished]);

  // Run AI Scan & Recommendations
  const runAiInspect = async () => {
    setIsScanningData(true);
    try {
      const [anomalyRes, timeRes] = await Promise.all([
        request('/templates/ai/detect-anomalies'),
        request('/templates/ai/sending-time'),
      ]);
      setAnomalies(anomalyRes.anomalies);
      setAiTime(timeRes);
      setStep(2);
    } catch (err: any) {
      addToast(err.message || 'AI Scan failed. Proceeding anyway.', 'warning');
      setStep(2);
    } finally {
      setIsScanningData(false);
    }
  };

  // Start automation
  const startAutomation = async () => {
    try {
      const res = await request('/automation/start', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedDocId,
          emailTemplateId: selectedEmailId,
        }),
      });

      addToast(res.message, 'success');
      setProgress({
        stats: { queued: res.count, sending: 0, sent: 0, failed: 0, bounced: 0, total: res.count },
        progressPercent: 0,
        isFinished: false,
        aiSummary: '',
      });
      setIsAutomating(true);
      setStep(3);
    } catch (err: any) {
      addToast(err.message || 'Failed to start automation.', 'error');
    }
  };

  const handleReset = () => {
    setStep(1);
    setIsAutomating(false);
    setProgress({
      stats: { queued: 0, sending: 0, sent: 0, failed: 0, bounced: 0, total: 0 },
      progressPercent: 0,
      isFinished: false,
      aiSummary: '',
    });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-500" />
        Configuring workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Automation Control Room</h2>
        <p className="text-sm text-slate-500 dark:text-dark-400">Assemble templates, check data integrity, and run bulk dispatch loops.</p>
      </div>

      {/* Progress Wizard Indicators */}
      <div className="flex items-center justify-between border-b pb-5 dark:border-dark-850 text-xs font-semibold">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary-500' : 'text-slate-400'}`}>
          <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${step === 1 ? 'border-primary-500 bg-primary-500/10' : 'border-slate-350'}`}>1</span>
          Choose Templates
        </div>
        <div className="h-0.5 flex-1 mx-4 bg-slate-200 dark:bg-dark-850" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary-500' : 'text-slate-400'}`}>
          <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${step === 2 ? 'border-primary-500 bg-primary-500/10' : 'border-slate-350'}`}>2</span>
          AI Integrity Check
        </div>
        <div className="h-0.5 flex-1 mx-4 bg-slate-200 dark:bg-dark-850" />
        <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary-500' : 'text-slate-400'}`}>
          <span className={`h-6 w-6 rounded-full flex items-center justify-center border ${step === 3 ? 'border-primary-500 bg-primary-500/10' : 'border-slate-350'}`}>3</span>
          Execution Status
        </div>
      </div>

      {/* Main wizard cards */}
      <div className="glass border p-6 rounded-3xl space-y-6">
        {step === 1 && (
          /* Step 1: Select Templates */
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg">Select Templates</h3>
              <p className="text-xs text-slate-400">Pick which document to generate and which email copy to send</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Doc Templates Select Card */}
              <div className="p-5 border dark:border-dark-800 rounded-2xl space-y-3">
                <div className="flex gap-3 items-center">
                  <div className="p-2.5 bg-primary-500/10 text-primary-500 rounded-xl">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold">PDF Document Layout</p>
                    <p className="text-[10px] text-slate-400">Offer Letter, Certificates, etc.</p>
                  </div>
                </div>
                <select
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2.5 px-3.5 text-xs font-semibold cursor-pointer focus:outline-none"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                >
                  {docTemplates.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.type.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>

              {/* Email Templates Select Card */}
              <div className="p-5 border dark:border-dark-800 rounded-2xl space-y-3">
                <div className="flex gap-3 items-center">
                  <div className="p-2.5 bg-primary-500/10 text-primary-500 rounded-xl">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold">Email Message Copy</p>
                    <p className="text-[10px] text-slate-400">Subject lines and welcoming texts</p>
                  </div>
                </div>
                <select
                  className="w-full bg-slate-100 dark:bg-dark-850 rounded-xl py-2.5 px-3.5 text-xs font-semibold cursor-pointer focus:outline-none"
                  value={selectedEmailId}
                  onChange={(e) => setSelectedEmailId(e.target.value)}
                >
                  {emailTemplates.map(em => (
                    <option key={em.id} value={em.id}>{em.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4 dark:border-dark-850">
              <button
                onClick={runAiInspect}
                disabled={isScanningData || !selectedDocId || !selectedEmailId}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary-500/15"
              >
                {isScanningData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Run AI Integrity Scan
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          /* Step 2: Quality Inspection and AI Scan */
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg">AI Quality Inspection</h3>
                <p className="text-xs text-slate-400">Auditing recipient lists and finding scheduling windows</p>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:underline"
              >
                Back to Selections
              </button>
            </div>

            {/* AI Recommended Send Time */}
            {aiTime.recommendedTime && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex gap-3 text-xs">
                <Clock className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-purple-600 dark:text-purple-400">AI Scheduling Recommendation</p>
                  <p className="font-semibold text-slate-700 dark:text-dark-200 mt-0.5">Recommended: {aiTime.recommendedTime}</p>
                  <p className="text-[10.5px] text-slate-500 dark:text-dark-400 mt-1">{aiTime.rationale}</p>
                </div>
              </div>
            )}

            {/* Anomalies results */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Recipient Data Integrity Check</h4>
              
              {anomalies.length === 0 ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-3 text-xs items-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">100% clean check! AI detected zero data anomalies in the pending queue.</span>
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-dark-800 rounded-2xl overflow-hidden">
                  <div className="p-3 bg-amber-500/10 border-b dark:border-dark-800 flex gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400 items-center">
                    <AlertTriangle className="h-4.5 w-4.5" />
                    We identified {anomalies.length} entries that may have parsing/formatting anomalies.
                  </div>
                  
                  <div className="max-h-48 overflow-y-auto divide-y dark:divide-dark-800">
                    {anomalies.map((anom, idx) => (
                      <div key={idx} className="p-3 text-[11px] flex justify-between items-start gap-4 hover:bg-slate-100/30">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-dark-200">{anom.name}</p>
                          <p className="text-slate-400 text-[10px] mt-0.5">{anom.email}</p>
                        </div>
                        <p className="text-amber-500 font-medium text-right max-w-sm">{anom.anomaly}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between border-t pt-4 dark:border-dark-850">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-dark-800 dark:hover:bg-dark-700 text-xs font-semibold rounded-xl border text-slate-600 dark:text-dark-200"
              >
                Go Back
              </button>

              <button
                onClick={startAutomation}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-primary-500/15"
              >
                <Play className="h-4 w-4" />
                Start Automation Queue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          /* Step 3: Execution queue progress */
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg">Execution Status</h3>
              <p className="text-xs text-slate-400">Processing background queues and sending emails</p>
            </div>

            {/* Progress Indicators */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Compilation Progress</span>
                <span className="text-primary-500">{progress.progressPercent}%</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-200 dark:bg-dark-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary-500 rounded-full transition-all duration-300 shadow-md"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Counts breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 border dark:border-dark-800 rounded-xl text-center">
                <p className="text-[10px] font-semibold text-slate-400">Total Enqueued</p>
                <p className="text-xl font-bold mt-1 text-slate-800 dark:text-dark-100">{progress.stats.total}</p>
              </div>
              <div className="p-3 border border-indigo-500/10 bg-indigo-500/5 rounded-xl text-center">
                <p className="text-[10px] font-semibold text-indigo-500">Currently Sending</p>
                <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{progress.stats.sending}</p>
              </div>
              <div className="p-3 border border-emerald-500/10 bg-emerald-500/5 rounded-xl text-center">
                <p className="text-[10px] font-semibold text-emerald-500">Sent Successfully</p>
                <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{progress.stats.sent}</p>
              </div>
              <div className="p-3 border border-red-500/10 bg-red-500/5 rounded-xl text-center">
                <p className="text-[10px] font-semibold text-red-500">Failed / Retrying</p>
                <p className="text-xl font-bold mt-1 text-red-650 dark:text-red-400">{progress.stats.failed}</p>
              </div>
              <div className="p-3 border border-pink-500/10 bg-pink-500/5 rounded-xl text-center">
                <p className="text-[10px] font-semibold text-pink-500">Server Bounces</p>
                <p className="text-xl font-bold mt-1 text-pink-655 dark:text-pink-400">{progress.stats.bounced}</p>
              </div>
            </div>

            {/* AI Summary report once completed */}
            {progress.isFinished && progress.aiSummary && (
              <div className="p-4.5 bg-gradient-to-r from-primary-500/10 via-purple-500/10 to-indigo-500/10 border border-primary-500/20 rounded-2xl text-xs space-y-2 animate-scale-up">
                <h4 className="font-bold text-sm text-primary-500 flex items-center gap-1.5">
                  <Sparkles className="h-4.5 w-4.5" />
                  AI Summary Output
                </h4>
                <div 
                  className="text-slate-600 dark:text-dark-200 leading-relaxed" 
                  dangerouslySetInnerHTML={{ __html: progress.aiSummary }} 
                />
              </div>
            )}

            {/* Controls */}
            {progress.isFinished && (
              <div className="flex flex-col md:flex-row gap-3 pt-4 border-t dark:border-dark-850 justify-between items-center">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-200 hover:bg-slate-350 dark:bg-dark-800 dark:hover:bg-dark-700 text-xs font-semibold rounded-xl border"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Wizard / Start New
                </button>

                <div className="flex gap-2">
                  <a
                    href="/api/reports/download?format=xlsx"
                    target="_blank"
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download Excel Report
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
